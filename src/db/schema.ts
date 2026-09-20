import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

/**
 * Tabel contoh untuk membuktikan koneksi database berjalan.
 */
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
