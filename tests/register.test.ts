import { expect, test, beforeEach, mock } from 'bun:test';
import { fakeDb, resetMockDb } from './mock-db';
import { sha256hex, collectParams, call } from './helpers';

beforeEach(() => {
  resetMockDb();
});

// Scenarios to be implemented by junior programmer:
// 1. Successful registration returns 201.
// 2. Duplicate email returns 409.
// 3. Validation errors for missing/invalid fields return 400.
// 4. Email normalization to lowercase.
// 5. Password length constraints.

test('placeholder: register endpoint scenarios', async () => {
  expect(true).toBeTrue();
});

