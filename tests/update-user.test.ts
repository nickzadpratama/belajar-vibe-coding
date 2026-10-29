import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

mock.module('../src/db', () => ({ db: fakeDb }));

import { usersRoutes } from '../src/routes/users-route';

beforeEach(() => {
  resetMockDb();
});

// Scenarios to be implemented by junior programmer:
// 1. Successful update returns updated user data.
// 2. Updating non‑existent user returns 404.
// 3. Validation errors for invalid fields return 400.
// 4. Email normalization on update.

test('placeholder: update user endpoint scenarios', async () => {
  expect(true).toBeTrue();
});

