import { expect, mock, test } from 'bun:test';
import { Elysia, t } from 'elysia';

// --- db palsu: mencatat panggilan & argumen, tanpa PostgreSQL ---

let selectRows: unknown[] = [];
let deletedRows: unknown[] = [];
let insertArg: unknown = null;
let insertError: unknown = null;
let deleteWhereArg: unknown = null;
let selectWhereArg: unknown = null;
let returningArg: unknown = null;
const calls: string[] = [];

const selectQuery = {
  from() {
    calls.push('select.from');
    return selectQuery;
  },
  innerJoin() {
    return selectQuery;
  },
  where(cond: unknown) {
    calls.push('select.where');
    selectWhereArg = cond;
    return Promise.resolve(selectRows);
  },
};

const deleteQuery = {
  where(cond: unknown) {
    calls.push('delete.where');
    deleteWhereArg = cond;
    return deleteQuery;
  },
  returning(arg: unknown) {
    calls.push('delete.returning');
    returningArg = arg;
    return Promise.resolve(deletedRows);
  },
};

const insertQuery = {
  values(value: unknown) {
    calls.push('insert.values');
    insertArg = value;
    return insertError ? Promise.reject(insertError) : Promise.resolve();
  },
};

const fakeDb = {
  select() {
    calls.push('select');
    return selectQuery;
  },
  delete() {
    calls.push('delete');
    return deleteQuery;
  },
  insert() {
    calls.push('insert');
    return insertQuery;
  },
};

mock.module('../src/db', () => ({ db: fakeDb }));

const { usersRoutes } = await import('../src/routes/users-route');

/** Hash yang sama dengan implementasi service (SHA-256 hex). */
const sha256hex = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex');

/** Ambil nilai parameter yang dikirim ke SQL (chunk bertipe Param). */
function collectParams(node: unknown, out: unknown[] = []): unknown[] {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectParams(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (obj.constructor?.name === 'Param' && 'value' in obj) out.push(obj.value);
  if (Array.isArray(obj.queryChunks)) collectParams(obj.queryChunks, out);
  return out;
}

async function call(
  options: { url?: string; method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const url = options.url ?? 'http://localhost/api/users/logout';
  const res = await usersRoutes.handle(
    new Request(url, {
      method: options.method ?? 'DELETE',
      headers: options.headers,
      body: options.body,
    }),
  );
  return { status: res.status, body: await res.text() };
}

test('logout: header tidak ada / kosong / skema salah -> 401 tanpa menyentuh DB', async () => {
  for (const headers of [undefined, { Authorization: 'Bearer' }, { Authorization: 'Token abc' }] as const) {
    calls.length = 0;
    deletedRows = [{ id: 3 }];
    const res = await call({ headers });
    expect(res.status).toBe(401);
    expect(res.body).toBe('{"error":"Unauthorized"}');
    expect(calls.filter((c) => c === 'delete').length).toBe(0);
  }
});

test('logout: token tidak dikenal -> 401; SQL memakai hash 64-char, bukan token mentah', async () => {
  deletedRows = [];
  calls.length = 0;
  const res = await call({ headers: { Authorization: 'Bearer tok-unknown' } });
  expect(res.status).toBe(401);
  expect(res.body).toBe('{"error":"Unauthorized"}');
  const params = collectParams(deleteWhereArg);
  expect(params).toEqual([sha256hex('tok-unknown')]);
  expect((params[0] as string).length).toBe(64);
  expect(params).not.toContain('tok-unknown');
});

test('login: client dapat UUID, DB menyimpan hash + expires_at 7 hari, sesi kedaluwarsa user dibersihkan', async () => {
  selectRows = [
    { id: 7, password: await Bun.password.hash('rahasia', { algorithm: 'bcrypt', cost: 10 }) },
  ];
  calls.length = 0;
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'Nickzad@Gmail.com', password: 'rahasia' }),
    }),
  );
  const body = (await res.json()) as { data: string };
  expect(res.status).toBe(200);
  expect(body.data).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(collectParams(selectWhereArg)).toEqual(['nickzad@gmail.com']); // email dinormalisasi
  expect(insertArg).toEqual({
    token: sha256hex(body.data),
    userId: 7,
    expiresAt: expect.any(Date),
  });
  const ttlHours = ((insertArg as { expiresAt: Date }).expiresAt.getTime() - Date.now()) / 3_600_000;
  expect(ttlHours).toBeGreaterThan(24 * 7 - 1); // mendekati 7 hari
  expect(ttlHours).toBeLessThanOrEqual(24 * 7);
  expect(calls.filter((c) => c === 'delete').length).toBe(1); // pembersihan sesi kedaluwarsa
});

test('login: password salah -> 401 dan tidak menulis apa pun ke DB', async () => {
  selectRows = [
    { id: 7, password: await Bun.password.hash('rahasia', { algorithm: 'bcrypt', cost: 10 }) },
  ];
  calls.length = 0;
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nickzad@gmail.com', password: 'bukan-rahasia' }),
    }),
  );
  expect(res.status).toBe(401);
  expect(await res.text()).toBe('{"error":"Email atau password salah"}');
  expect(calls.filter((c) => c === 'insert').length).toBe(0);
});

test('current: token valid -> 200 profil tanpa password; WHERE berisi hash + filter kedaluwarsa', async () => {
  selectRows = [
    { id: 1, name: 'Nickzad', email: 'nickzad@gmail.com', createdAt: new Date('2026-01-02T03:04:05.000Z') },
  ];
  calls.length = 0;
  const res = await call({
    url: 'http://localhost/api/users/current',
    method: 'GET',
    headers: { Authorization: 'Bearer tok-valid' },
  });
  expect(res.status).toBe(200);
  expect(res.body).toBe(
    '{"data":{"id":1,"name":"Nickzad","email":"nickzad@gmail.com","created_at":"2026-01-02T03:04:05.000Z"}}',
  );
  const params = collectParams(selectWhereArg);
  expect(params[0]).toBe(sha256hex('tok-valid'));
  expect(params[1]).toBeInstanceOf(Date); // batas kedaluwarsa ikut dikirim ke SQL
  expect(res.body).not.toContain('password');
});

test('current: token tidak dikenal -> 401', async () => {
  selectRows = [];
  const res = await call({
    url: 'http://localhost/api/users/current',
    method: 'GET',
    headers: { Authorization: 'Bearer tok-unknown' },
  });
  expect(res.status).toBe(401);
  expect(res.body).toBe('{"error":"Unauthorized"}');
});

test('regresi: endpoint lama tetap benar', async () => {
  deletedRows = [{ id: 1 }];
  const del = await call({ url: 'http://localhost/api/users/1' });
  expect(del.status).toBe(200);
  expect(del.body).toBe('{"data":"OK"}');

  deletedRows = [];
  expect((await call({ url: 'http://localhost/api/users/9' })).status).toBe(404);
  expect((await call({ url: 'http://localhost/api/users/abc' })).status).toBe(422);

  selectRows = [{ id: 1, name: 'A', email: 'a@b.co', createdAt: new Date() }];
  expect((await call({ url: 'http://localhost/api/users', method: 'GET' })).status).toBe(200);

  expect(
    usersRoutes.routes.some((r) => r.method === 'DELETE' && r.path === '/api/users/logout'),
  ).toBe(true);
});

test('route /logout tetap menang atas /:id walau dinamis dideklarasikan lebih dulu', async () => {
  const reversed = new Elysia({ prefix: '/api/users' })
    .delete('/:id', () => ({ data: 'OK' }), { params: t.Object({ id: t.Numeric() }) })
    .delete('/logout', ({ status }) => status(401, { error: 'Unauthorized' }));
  const res = await reversed.handle(
    new Request('http://localhost/api/users/logout', { method: 'DELETE' }),
  );
  expect(res.status).toBe(401);
});

test('logout: token valid -> 200 { data: OK }, returning hanya id', async () => {
  deletedRows = [{ id: 3 }];
  returningArg = null;
  calls.length = 0;
  const res = await call({ headers: { Authorization: 'Bearer tok-valid' } });
  expect(res.status).toBe(200);
  expect(res.body).toBe('{"data":"OK"}');
  expect(collectParams(deleteWhereArg)).toEqual([sha256hex('tok-valid')]);
  expect(Object.keys(returningArg as object)).toEqual(['id']);
});

// --- registrasi: bentuk error persis seperti drizzle 0.45 + postgres-js di PostgreSQL nyata ---
// Drizzle membungkus error query: DrizzleQueryError (tanpa code) -> cause: PostgresError (code 23505).
class FakePostgresError extends Error {
  code = '23505';
  constructor() {
    super('duplicate key value violates unique constraint "users_email_unique"');
    this.name = 'PostgresError';
  }
}

class FakeDrizzleQueryError extends Error {
  override cause: Error;
  constructor(cause: Error) {
    super('Failed query: insert into "users" ("id", "name", "email", "password", "created_at") values');
    this.name = 'DrizzleQueryError';
    this.cause = cause;
  }
}

test('register: sukses -> 201 { data: OK }', async () => {
  insertError = null;
  calls.length = 0;
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Nickzad', email: 'Nickzad@Gmail.com', password: 'rahasia' }),
    }),
  );
  expect(res.status).toBe(201);
  expect(await res.text()).toBe('{"data":"OK"}');
  // register tidak melakukan pre-check select; bukti normalisasi ada di nilai insert
  expect(insertArg).toMatchObject({ name: 'Nickzad', email: 'nickzad@gmail.com' });
  expect((insertArg as { password: string }).password).toMatch(/^\$2[ab]\$/);
});

test('register: email duplikat (DrizzleQueryError, code 23505 di cause) -> 409', async () => {
  // Ini bentuk error NYATA di PostgreSQL — versi lama isUniqueViolation melewatkan cause → 500.
  insertError = new FakeDrizzleQueryError(new FakePostgresError());
  calls.length = 0;
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Nickzad', email: 'nickzad@gmail.com', password: 'rahasia' }),
    }),
  );
  expect(res.status).toBe(409);
  expect(await res.text()).toBe('{"error":"Email sudah terdaftar"}');
});

test('register: unique violation langsung (code di level atas, tanpa bungkus) tetap 409', async () => {
  insertError = Object.assign(new Error('duplicate key'), { code: '23505' });
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Nickzad', email: 'nickzad@gmail.com', password: 'rahasia' }),
    }),
  );
  expect(res.status).toBe(409);
  expect(await res.text()).toBe('{"error":"Email sudah terdaftar"}');
});

test('register: error lain (bukan 23505) tidak disamarkan -> dilempar (500)', async () => {
  insertError = new Error('boom: koneksi database hilang');
  const res = await usersRoutes.handle(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Nickzad', email: 'nickzad@gmail.com', password: 'rahasia' }),
    }),
  );
  expect(res.status).toBe(500);
  insertError = null;
});


test('logout: skema bearer huruf kecil + spasi berlebih tetap diterima', async () => {
  deletedRows = [{ id: 3 }];
  calls.length = 0;
  const res = await call({ headers: { Authorization: 'bearer   tok-valid  ' } });
  expect(res.status).toBe(200);
  expect(collectParams(deleteWhereArg)).toEqual([sha256hex('tok-valid')]);
});