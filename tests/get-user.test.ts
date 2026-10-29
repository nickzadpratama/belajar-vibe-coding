import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

mock.module('../src/db', () => ({ db: fakeDb }));

import { usersRoutes } from '../src/routes/users-route';

beforeEach(() => {
  resetMockDb();
});

// Scenarios to be implemented by junior programmer:
// 1. Successful fetch of existing user returns 200 with user data (no password).
// 2. Non-existent user returns 404.
// 3. Validation of ID param (numeric) returns 400 on invalid input.
// 4. Ensure email is normalized to lowercase in response.

test('placeholder: get user endpoint scenarios', async () => {
  expect(true).toBeTrue();
});

