// Shared mock DB utilities for tests

export let selectRows: unknown[] = [];
export let deletedRows: unknown[] = [];
export let insertArg: unknown = null;
export let insertError: unknown = null;
export let deleteWhereArg: unknown = null;
export let selectWhereArg: unknown = null;
export let returningArg: unknown = null;
export const calls: string[] = [];

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

export const fakeDb = {
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

export function resetMockDb() {
  selectRows = [];
  deletedRows = [];
  insertArg = null;
  insertError = null;
  deleteWhereArg = null;
  selectWhereArg = null;
  returningArg = null;
  calls.length = 0;
}

