import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users } from '../db/schema';

/** Kolom yang aman dikirim ke client (tanpa password). */
const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
};

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email sudah terdaftar');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email atau password salah');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Melakukan normalisasi string email (menghapus spasi di awal/akhir dan mengubah ke huruf kecil).
 * Digunakan secara konsisten pada proses register, login, dan update user.
 */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Mengecek apakah error yang terjadi merupakan pelanggaran unique constraint di database (misal: email duplikat).
 * PostgreSQL menandai pelanggaran unique constraint dengan kode 23505.
 * Drizzle membungkus error query dalam DrizzleQueryError, sehingga kode asli
 * bisa berada di error itu sendiri atau di rantai `cause`-nya (PostgresError).
 */
function isUniqueViolation(error: unknown) {
  let current: unknown = error;

  // Maksimal 10 level `cause`: drizzle membungkus 1 level, sisanya jaring pengaman.
  for (let depth = 0; depth < 10 && current !== null && current !== undefined; depth++) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: unknown }).code === '23505'
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** Sesi berlaku 7 hari sejak login. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Menghasilkan hash SHA-256 (format hex, 64 karakter) dari token sesi.
 * Digunakan agar database tidak menyimpan token mentah client untuk keamanan.
 */
function hashToken(token: string) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

/**
 * Mendaftarkan user baru ke dalam database.
 * Melakukan normalisasi email, hashing password dengan bcrypt, dan menyimpan data user.
 * Melempar EmailAlreadyRegisteredError jika email sudah digunakan.
 */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const password = await Bun.password.hash(input.password, {
    algorithm: 'bcrypt',
    cost: 10,
  });

  try {
    await db.insert(users).values({ name: input.name.trim(), email, password });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyRegisteredError();
    }

    throw error;
  }
}

/**
 * Melakukan autentikasi user berdasarkan email dan password.
 * Memverifikasi hash password, membersihkan sesi lama yang sudah kedaluwarsa,
 * membuat token sesi baru (UUID), menyimpannya ke database dalam bentuk hash SHA-256 dengan masa aktif 7 hari,
 * dan mengembalikan token UUID mentah ke client.
 * Email tidak dikenal atau password salah melempar InvalidCredentialsError.
 */
export async function loginUser(input: { email: string; password: string }) {
  const [user] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.email, normalizeEmail(input.email)));

  if (!user) {
    throw new InvalidCredentialsError();
  }

  let isValid = false;

  try {
    isValid = await Bun.password.verify(input.password, user.password);
  } catch {
    // Hash tersimpan rusak / algoritmanya tidak dikenal: perlakukan sebagai gagal login,
    // jangan bocorkan detail ke client.
    throw new InvalidCredentialsError();
  }

  if (!isValid) {
    throw new InvalidCredentialsError();
  }

  const now = new Date();

  // Bersihkan sesi kedaluwarsa milik user ini — pembersihan tanpa cron:
  // sesi mati dihapus tepat saat pemiliknya login lagi.
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, now)));

  const token = crypto.randomUUID();

  await db.insert(sessions).values({
    token: hashToken(token), // DB menyimpan hash; token asli hanya untuk client
    userId: user.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });

  return token;
}

/**
 * Mengambil daftar seluruh user dari database tanpa menyertakan kolom password (hanya public columns).
 */
export async function findUsers() {
  return db.select(publicColumns).from(users);
}

/**
 * Mencari data spesifik seorang user berdasarkan ID-nya.
 * Mengembalikan data user publik tanpa password jika ditemukan, atau null jika tidak ditemukan.
 */
export async function findUserById(id: number) {
  const [user] = await db.select(publicColumns).from(users).where(eq(users.id, id));

  return user ?? null;
}

/**
 * Memperbarui data nama dan/atau email user berdasarkan ID.
 * Melakukan trim pada nama dan normalisasi pada email, lalu mengembalikan data user yang telah diperbarui atau null jika user tidak ditemukan.
 */
export async function updateUser(id: number, input: { name: string; email: string }) {
  const [updated] = await db
    .update(users)
    .set({ name: input.name.trim(), email: normalizeEmail(input.email) })
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}

/**
 * Menghapus data user dari database berdasarkan ID.
 * Mengembalikan true jika user berhasil dihapus, atau false jika user tidak ditemukan.
 */
export async function deleteUser(id: number) {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  return deleted !== undefined;
}

/**
 * Mengambil data profil user yang sedang aktif berdasarkan token sesi (Bearer token).
 * Mencocokkan hash SHA-256 token di tabel sessions serta memverifikasi bahwa sesi belum kedaluwarsa.
 * Mengembalikan data publik user jika valid, atau null jika token tidak dikenal atau sudah kedaluwarsa.
 */
export async function findCurrentUser(token: string) {
  const [user] = await db
    .select(publicColumns)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, hashToken(token)), gt(sessions.expiresAt, new Date())));

  return user ?? null;
}

/**
 * Mengakhiri sesi login user dengan menghapus baris sesi berdasarkan hash token dari tabel sessions.
 * Mengembalikan true jika sesi berhasil dihapus, atau false jika token tidak ditemukan / sudah tidak valid.
 */
export async function logoutUser(token: string) {
  const [deleted] = await db
    .delete(sessions)
    .where(eq(sessions.token, hashToken(token)))
    .returning({ id: sessions.id });

  return deleted !== undefined;
}
