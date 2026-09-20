import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

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
  const email = input.email.trim().toLowerCase();
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
    .set({ name: input.name.trim(), email: input.email.trim().toLowerCase() })
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
