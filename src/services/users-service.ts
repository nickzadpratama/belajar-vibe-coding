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

/** Satu-satunya tempat normalisasi email, dipakai register/login/update. */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
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

/** Token client disimpan sebagai hash SHA-256 (hex, 64 char) — bukan plaintext. */
function hashToken(token: string) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

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
 * Verifikasi kredensial lalu buat sesi baru. Mengembalikan token sesi.
 * Email tidak dikenal dan password salah menghasilkan error yang sama.
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

export async function findUsers() {
  return db.select(publicColumns).from(users);
}

export async function findUserById(id: number) {
  const [user] = await db.select(publicColumns).from(users).where(eq(users.id, id));

  return user ?? null;
}

export async function updateUser(id: number, input: { name: string; email: string }) {
  const [updated] = await db
    .update(users)
    .set({ name: input.name.trim(), email: normalizeEmail(input.email) })
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}

export async function deleteUser(id: number) {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  return deleted !== undefined;
}

/**
 * Cari user pemilik token sesi. Token tidak dikenal / sesi kedaluwarsa -> null.
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
 * Hapus sesi pemilik token. Token tidak dikenal / sudah tidak ada -> false.
 */
export async function logoutUser(token: string) {
  const [deleted] = await db
    .delete(sessions)
    .where(eq(sessions.token, hashToken(token)))
    .returning({ id: sessions.id });

  return deleted !== undefined;
}
