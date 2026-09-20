import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Tabel contoh untuk membuktikan koneksi database berjalan.
 */
export const users = pgTable('users', {
  id: integer('id')
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
