import { eq } from 'drizzle-orm';
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

/** PostgreSQL menandai pelanggaran unique constraint dengan kode 23505. */
function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
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

  const token = crypto.randomUUID();

  await db.insert(sessions).values({ token, userId: user.id });

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
 * Cari user pemilik token sesi. Token tidak dikenal -> null.
 */
export async function findCurrentUser(token: string) {
  const [user] = await db
    .select(publicColumns)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token));

  return user ?? null;
}
