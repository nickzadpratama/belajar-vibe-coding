import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

mock.module('../src/db', () => ({ db: fakeDb }));

import { usersRoutes } from '../src/routes/users-route';

beforeEach(() => {
  resetMockDb();
});

// Scenarios to be implemented by junior programmer:
// 1. Successful login returns token and creates session with TTL 7 days.
// 2. Incorrect password returns 401, no DB writes.
// 3. Email normalization to lowercase.
// 4. Validation errors for missing/invalid fields return 400.

test('placeholder: login endpoint scenarios', async () => {
  expect(true).toBeTrue();
});

