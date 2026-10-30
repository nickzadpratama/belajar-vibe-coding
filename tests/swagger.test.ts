import { expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { usersRoutes } from '../src/routes/users-route';

test('swagger: endpoint /swagger/json mengembalikan spesifikasi openapi valid', async () => {
  const app = new Elysia()
    .use(swagger({ path: '/swagger' }))
    .use(usersRoutes);

  const res = await app.handle(new Request('http://localhost/swagger/json'));
  expect(res.status).toBe(200);

  const json = (await res.json()) as { openapi?: string; paths?: Record<string, unknown> };
  expect(json.openapi).toBeDefined();
  expect(json.paths).toBeDefined();
  expect(json.paths?.['/api/users/']).toBeDefined();
  expect(json.paths?.['/api/users/login']).toBeDefined();
  expect(json.paths?.['/api/users/current']).toBeDefined();
  expect(json.paths?.['/api/users/logout']).toBeDefined();
  expect(json.paths?.['/api/users/{id}']).toBeDefined();
});
