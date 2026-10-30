import { Elysia, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
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
  name: t.String({ minLength: 1, maxLength: 255, examples: ['Nickzad'] }),
  email: t.String({ format: 'email', maxLength: 255, examples: ['nickzad@gmail.com'] }),
  // minLength sengaja 1: contoh di spec memakai password "rahasia" (7 karakter).
  // maxLength 72 mengikuti batas bcrypt standar.
  password: t.String({ minLength: 1, maxLength: 72, examples: ['rahasia'] }),
});

const loginBody = t.Object({
  email: t.String({ format: 'email', maxLength: 255, examples: ['nickzad@gmail.com'] }),
  // minLength 1 (bukan 8): contoh password di spec hanya 7 karakter.
  // maxLength 72 mengikuti batas bcrypt standar.
  password: t.String({ minLength: 1, maxLength: 72, examples: ['rahasia'] }),
});

const updateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255, examples: ['Nickzad Pratama'] }),
  email: t.String({ format: 'email', maxLength: 255, examples: ['nickzad.pratama@gmail.com'] }),
});

const userParams = t.Object({
  id: t.Numeric({ examples: [1] }),
});

// --- Helper & Definisi Response OpenAPI Lengkap dengan Contoh Body ---

function jsonResponse(
  description: string,
  schema: OpenAPIV3.SchemaObject,
  example?: unknown,
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema,
        ...(example !== undefined ? { example } : {}),
      },
    },
  };
}

const okResponse = jsonResponse(
  'Operasi berhasil',
  {
    type: 'object',
    properties: {
      data: { type: 'string', example: 'OK' },
    },
    required: ['data'],
  },
  { data: 'OK' },
);

const validationErrorResponse = jsonResponse(
  'Validasi input gagal',
  {
    type: 'object',
    properties: {
      type: { type: 'string', example: 'validation' },
      on: { type: 'string', example: 'body' },
      message: { type: 'string', example: 'Format email tidak valid atau field wajib belum diisi' },
    },
    required: ['type', 'message'],
  },
  {
    type: 'validation',
    on: 'body',
    message: 'Format email tidak valid atau field wajib belum diisi',
  },
);

const unauthorizedResponse = jsonResponse(
  'Unauthorized (token tidak ditemukan, salah, atau kedaluwarsa)',
  {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Unauthorized' },
    },
    required: ['error'],
  },
  { error: 'Unauthorized' },
);

const notFoundResponse = jsonResponse(
  'User tidak ditemukan',
  {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'User tidak ditemukan' },
    },
    required: ['error'],
  },
  { error: 'User tidak ditemukan' },
);

const duplicateEmailResponse = jsonResponse(
  'Email sudah terdaftar',
  {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Email sudah terdaftar' },
    },
    required: ['error'],
  },
  { error: 'Email sudah terdaftar' },
);

const invalidCredentialsResponse = jsonResponse(
  'Email atau password salah',
  {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Email atau password salah' },
    },
    required: ['error'],
  },
  { error: 'Email atau password salah' },
);

const loginSuccessResponse = jsonResponse(
  'Login berhasil, mengembalikan token sesi UUID',
  {
    type: 'object',
    properties: {
      data: {
        type: 'string',
        format: 'uuid',
        example: '7b96e95c-9d66-4c40-9a25-97e3fbe3f6b4',
      },
    },
    required: ['data'],
  },
  { data: '7b96e95c-9d66-4c40-9a25-97e3fbe3f6b4' },
);

const currentUserResponse = jsonResponse(
  'Profil user berhasil didapatkan',
  {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Nickzad' },
          email: { type: 'string', format: 'email', example: 'nickzad@gmail.com' },
          created_at: { type: 'string', format: 'date-time', example: '2026-10-30T10:00:00.000Z' },
        },
        required: ['id', 'name', 'email', 'created_at'],
      },
    },
    required: ['data'],
  },
  {
    data: {
      id: 1,
      name: 'Nickzad',
      email: 'nickzad@gmail.com',
      created_at: '2026-10-30T10:00:00.000Z',
    },
  },
);

const listUsersResponse = jsonResponse(
  'Daftar user berhasil didapatkan',
  {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        name: { type: 'string', example: 'Nickzad' },
        email: { type: 'string', format: 'email', example: 'nickzad@gmail.com' },
        createdAt: { type: 'string', format: 'date-time', example: '2026-10-30T10:00:00.000Z' },
      },
      required: ['id', 'name', 'email', 'createdAt'],
    },
  },
  [
    {
      id: 1,
      name: 'Nickzad',
      email: 'nickzad@gmail.com',
      createdAt: '2026-10-30T10:00:00.000Z',
    },
    {
      id: 2,
      name: 'Budi Pratama',
      email: 'budi@gmail.com',
      createdAt: '2026-10-30T11:00:00.000Z',
    },
  ],
);

const singleUserResponse = jsonResponse(
  'Data user ditemukan',
  {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Nickzad' },
      email: { type: 'string', format: 'email', example: 'nickzad@gmail.com' },
      createdAt: { type: 'string', format: 'date-time', example: '2026-10-30T10:00:00.000Z' },
    },
    required: ['id', 'name', 'email', 'createdAt'],
  },
  {
    id: 1,
    name: 'Nickzad',
    email: 'nickzad@gmail.com',
    createdAt: '2026-10-30T10:00:00.000Z',
  },
);

const singleUserUpdatedResponse = jsonResponse(
  'Data user berhasil diperbarui',
  {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Nickzad Pratama' },
      email: { type: 'string', format: 'email', example: 'nickzad.pratama@gmail.com' },
      createdAt: { type: 'string', format: 'date-time', example: '2026-10-30T10:00:00.000Z' },
    },
    required: ['id', 'name', 'email', 'createdAt'],
  },
  {
    id: 1,
    name: 'Nickzad Pratama',
    email: 'nickzad.pratama@gmail.com',
    createdAt: '2026-10-30T10:00:00.000Z',
  },
);

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
          201: okResponse,
          400: validationErrorResponse,
          409: duplicateEmailResponse,
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
          200: loginSuccessResponse,
          400: validationErrorResponse,
          401: invalidCredentialsResponse,
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
          200: currentUserResponse,
          401: unauthorizedResponse,
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
          200: listUsersResponse,
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
          200: singleUserResponse,
          400: validationErrorResponse,
          404: notFoundResponse,
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
          200: singleUserUpdatedResponse,
          400: validationErrorResponse,
          404: notFoundResponse,
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
          200: okResponse,
          401: unauthorizedResponse,
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
          200: okResponse,
          400: validationErrorResponse,
          404: notFoundResponse,
        },
      },
    },
  );
