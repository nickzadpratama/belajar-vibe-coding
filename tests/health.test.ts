import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

mock.module('../src/db', () => ({ db: fakeDb }));

import { usersRoutes } from '../src/routes/users-route';

beforeEach(() => {
  resetMockDb();
});

// Placeholder test for health endpoint (if any). Currently no health route, so just a sanity check.
test('sanity: test setup works', async () => {
  expect(true).toBeTrue();
});

