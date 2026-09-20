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

/** MySQL menandai pelanggaran unique constraint dengan kode ER_DUP_ENTRY. */
function isDuplicateEntry(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ER_DUP_ENTRY'
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
        const [result] = await db.insert(users).values(body);
        const [created] = await db.select().from(users).where(eq(users.id, result.insertId));

        if (!created) {
          return status(500, { message: 'User terbuat, tapi gagal dibaca kembali' });
        }

        return status(201, created);
      } catch (error) {
        if (isDuplicateEntry(error)) {
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
      const [result] = await db.update(users).set(body).where(eq(users.id, params.id));

      if (result.affectedRows === 0) {
        return status(404, { message: 'User tidak ditemukan' });
      }

      const [updated] = await db.select().from(users).where(eq(users.id, params.id));

      return updated;
    },
    { params: userParams, body: userBody },
  )
  .delete(
    '/:id',
    async ({ params, status }) => {
      const [result] = await db.delete(users).where(eq(users.id, params.id));

      if (result.affectedRows === 0) {
        return status(404, { message: 'User tidak ditemukan' });
      }

      return { message: 'User berhasil dihapus' };
    },
    { params: userParams },
  );
