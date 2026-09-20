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
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Sesi login: satu baris = satu token aktif milik satu user. */
export const sessions = pgTable('sessions', {
  id: integer('id')
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  token: varchar('token', { length: 36 }).notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
