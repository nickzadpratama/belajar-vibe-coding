import { Elysia, t } from 'elysia';
import {
  EmailAlreadyRegisteredError,
  deleteUser,
  findUserById,
  findUsers,
  registerUser,
  updateUser,
} from '../services/users-service';

const registerBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
  // minLength sengaja 1: contoh di spec memakai password "rahasia" (7 karakter).
  // maxLength 72 mengikuti batas bcrypt standar.
  password: t.String({ minLength: 1, maxLength: 72 }),
});

const updateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
});

const userParams = t.Object({
  id: t.Numeric(),
});

export const usersRoutes = new Elysia({ prefix: '/api/users' })
  .post(
    '/',
    async ({ body, status }) => {
      try {
        await registerUser(body);

        return status(201, { data: 'OK' });
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          return status(409, { error: 'Email sudah terdaftar' });
        }

        throw error;
      }
    },
    { body: registerBody },
  )
  .get('/', () => findUsers())
  .get(
    '/:id',
    async ({ params, status }) => {
      const user = await findUserById(params.id);

      if (!user) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return user;
    },
    { params: userParams },
  )
  .put(
    '/:id',
    async ({ params, body, status }) => {
      const updated = await updateUser(params.id, body);

      if (!updated) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return updated;
    },
    { params: userParams, body: updateBody },
  )
  .delete(
    '/:id',
    async ({ params, status }) => {
      const deleted = await deleteUser(params.id);

      if (!deleted) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return { data: 'OK' };
    },
    { params: userParams },
  );
