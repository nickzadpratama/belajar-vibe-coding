import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

mock.module('../src/db', () => ({ db: fakeDb }));

import { usersRoutes } from '../src/routes/users-route';

beforeEach(() => {
  resetMockDb();
});

// Scenarios to be implemented by junior programmer:
// 1. List users returns array of users, respects pagination if any.
// 2. Handles empty list correctly.
// 3. Proper error handling on DB failures.

test('placeholder: list users endpoint scenarios', async () => {
  expect(true).toBeTrue();
});

