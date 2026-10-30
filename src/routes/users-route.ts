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
    {
      body: registerBody,
      detail: {
        tags: ['Users'],
        summary: 'Registrasi user baru',
        description: 'Mendaftarkan user baru dengan nama, email, dan password.',
        responses: {
          201: {
            description: 'Registrasi berhasil',
          },
          400: {
            description: 'Validasi input gagal',
          },
          409: {
            description: 'Email sudah terdaftar',
          },
        },
      },
    },
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
    {
      body: loginBody,
      detail: {
        tags: ['Users'],
        summary: 'Login user',
        description: 'Autentikasi user dan buat token sesi baru (UUID).',
        responses: {
          200: {
            description: 'Login berhasil, mengembalikan token sesi UUID',
          },
          400: {
            description: 'Validasi format email atau password gagal',
          },
          401: {
            description: 'Email atau password salah',
          },
        },
      },
    },
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
    {
      detail: {
        tags: ['Users'],
        summary: 'Ambil profil user yang sedang login',
        description: 'Mendapatkan profil publik user berdasarkan header Authorization Bearer token.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil user berhasil didapatkan',
          },
          401: {
            description: 'Unauthorized (token tidak ditemukan, salah, atau kedaluwarsa)',
          },
        },
      },
    },
  )
  .get(
    '/',
    () => findUsers(),
    {
      detail: {
        tags: ['Users'],
        summary: 'Mendapatkan semua daftar user',
        description: 'Mengambil seluruh list user publik tanpa kolom password.',
        responses: {
          200: {
            description: 'Daftar user berhasil didapatkan',
          },
        },
      },
    },
  )
  .get(
    '/:id',
    async ({ params, status }) => {
      const user = await findUserById(params.id);

      if (!user) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return user;
    },
    {
      params: userParams,
      detail: {
        tags: ['Users'],
        summary: 'Mendapatkan data user berdasarkan ID',
        description: 'Mengambil data detail user publik berdasarkan parameter ID.',
        responses: {
          200: {
            description: 'Data user ditemukan',
          },
          400: {
            description: 'Format ID tidak valid',
          },
          404: {
            description: 'User tidak ditemukan',
          },
        },
      },
    },
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
    {
      params: userParams,
      body: updateBody,
      detail: {
        tags: ['Users'],
        summary: 'Memperbarui data user berdasarkan ID',
        description: 'Mengubah nama dan/atau email user berdasarkan ID.',
        responses: {
          200: {
            description: 'Data user berhasil diperbarui',
          },
          400: {
            description: 'Validasi input tidak sesuai',
          },
          404: {
            description: 'User tidak ditemukan',
          },
        },
      },
    },
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
    {
      detail: {
        tags: ['Users'],
        summary: 'Logout dan hapus sesi aktif',
        description: 'Menghapus token sesi aktif milik user dari database.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Berhasil logout',
          },
          401: {
            description: 'Unauthorized (token tidak ditemukan atau tidak valid)',
          },
        },
      },
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
    {
      params: userParams,
      detail: {
        tags: ['Users'],
        summary: 'Menghapus user berdasarkan ID',
        description: 'Menghapus data user dari sistem berdasarkan ID.',
        responses: {
          200: {
            description: 'User berhasil dihapus',
          },
          400: {
            description: 'Format ID tidak valid',
          },
          404: {
            description: 'User tidak ditemukan',
          },
        },
      },
    },
  );
