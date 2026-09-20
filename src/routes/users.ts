import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { users } from '../db/schema';

const userBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
});

const userParams = t.Object({
  id: t.Numeric(),
});

/** PostgreSQL menandai pelanggaran unique constraint dengan kode 23505. */
function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', () => db.select().from(users))
  .get(
    '/:id',
    async ({ params, status }) => {
      const [user] = await db.select().from(users).where(eq(users.id, params.id));

      if (!user) {
        return status(404, { message: 'User tidak ditemukan' });
      }

      return user;
    },
    { params: userParams },
  )
  .post(
    '/',
    async ({ body, status }) => {
      try {
        const [created] = await db.insert(users).values(body).returning();

        if (!created) {
          return status(500, { message: 'User terbuat, tapi gagal dibaca kembali' });
        }

        return status(201, created);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return status(409, { message: 'Email sudah terdaftar' });
        }

        throw error;
      }
    },
    { body: userBody },
  )
  .put(
    '/:id',
    async ({ params, body, status }) => {
      const [updated] = await db
        .update(users)
        .set(body)
        .where(eq(users.id, params.id))
        .returning();

      if (!updated) {
        return status(404, { message: 'User tidak ditemukan' });
      }

      return updated;
    },
    { params: userParams, body: userBody },
  )
  .delete(
    '/:id',
    async ({ params, status }) => {
      const [deleted] = await db
        .delete(users)
        .where(eq(users.id, params.id))
        .returning();

      if (!deleted) {
        return status(404, { message: 'User tidak ditemukan' });
      }

      return { message: 'User berhasil dihapus' };
    },
    { params: userParams },
  );
