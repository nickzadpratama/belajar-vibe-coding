import { mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';

// Apply mock for the DB module before importing routes
mock.module('../src/db', () => ({ db: fakeDb }));

let usersRoutes: any = null;

/** Lazily import the routes after the DB mock is in place */
export async function getRoutes() {
  if (!usersRoutes) {
    const mod = await import('../src/routes/users-route');
    usersRoutes = mod.usersRoutes;
  }
  return usersRoutes;
}

/** Helper to call API routes. */
export async function call(options: { url?: string; method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const routes = await getRoutes();
  const url = options.url ?? 'http://localhost/api/users/logout';
  const res = await routes.handle(
    new Request(url, {
      method: options.method ?? 'DELETE',
      headers: options.headers,
      body: options.body,
    })
  );
  return { status: res.status, body: await res.text() };
}

/** SHA-256 hex hash, same as service implementation. */
export const sha256hex = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex');

/** Collect parameter values from Drizzle param objects (or similar). */
export function collectParams(node: unknown, out: unknown[] = []): unknown[] {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectParams(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (obj.constructor?.name === 'Param' && 'value' in obj) out.push((obj as any).value);
  if (Array.isArray((obj as any).queryChunks)) collectParams((obj as any).queryChunks, out);
  return out;
}
