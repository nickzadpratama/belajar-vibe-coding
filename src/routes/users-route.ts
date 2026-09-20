import { Elysia, t } from 'elysia';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  findCurrentUser,
  deleteUser,
  findUserById,
  findUsers,
  loginUser,
  logoutUser,
  registerUser,
  updateUser,
} from '../services/users-service';

/** Ambil token dari header `Authorization: Bearer <token>`. */
function extractBearerToken(header: string | undefined) {
  return /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '')?.[1] ?? null;
}

const registerBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
  // minLength sengaja 1: contoh di spec memakai password "rahasia" (7 karakter).
  // maxLength 72 mengikuti batas bcrypt standar.
  password: t.String({ minLength: 1, maxLength: 72 }),
});

const loginBody = t.Object({
  email: t.String({ format: 'email', maxLength: 255 }),
  // minLength 1 (bukan 8): contoh password di spec hanya 7 karakter.
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
  .post(
    '/login',
    async ({ body, status }) => {
      try {
        const token = await loginUser(body);

        return status(200, { data: token });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return status(401, { error: 'Email atau password salah' });
        }

        throw error;
      }
    },
    { body: loginBody },
  )
  .get(
    '/current',
    async ({ headers, status }) => {
      const token = extractBearerToken(headers.authorization);
      const user = token ? await findCurrentUser(token) : null;

      if (!user) {
        return status(401, { error: 'Unauthorized' });
      }

      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.createdAt,
        },
      };
    },
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
    '/logout',
    async ({ headers, status }) => {
      const token = extractBearerToken(headers.authorization);

      if (!token || !(await logoutUser(token))) {
        return status(401, { error: 'Unauthorized' });
      }

      return { data: 'OK' };
    },
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
