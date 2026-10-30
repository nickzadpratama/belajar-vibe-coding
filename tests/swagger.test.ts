import { expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { usersRoutes } from '../src/routes/users-route';

test('swagger: endpoint /swagger/json mengembalikan spesifikasi openapi valid dengan response schema dan example', async () => {
  const app = new Elysia()
    .use(swagger({ path: '/swagger' }))
    .use(usersRoutes);

  const res = await app.handle(new Request('http://localhost/swagger/json'));
  expect(res.status).toBe(200);

  const json = (await res.json()) as {
    openapi?: string;
    paths?: Record<
      string,
      Record<
        string,
        {
          responses?: Record<string, { content?: Record<string, { example?: unknown }> }>;
        }
      >
    >;
  };
  expect(json.openapi).toBeDefined();
  expect(json.paths).toBeDefined();
  expect(json.paths?.['/api/users/']).toBeDefined();
  expect(json.paths?.['/api/users/login']).toBeDefined();
  expect(json.paths?.['/api/users/current']).toBeDefined();
  expect(json.paths?.['/api/users/logout']).toBeDefined();
  expect(json.paths?.['/api/users/{id}']).toBeDefined();

  // Verifikasi contoh response body terpasang
  const loginPost200 = json.paths?.['/api/users/login']?.post?.responses?.['200'];
  expect(loginPost200?.content?.['application/json']?.example).toBeDefined();

  const currentGet200 = json.paths?.['/api/users/current']?.get?.responses?.['200'];
  expect(currentGet200?.content?.['application/json']?.example).toBeDefined();
});
