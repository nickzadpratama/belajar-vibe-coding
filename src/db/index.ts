import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL belum diset. Salin .env.example menjadi .env lalu sesuaikan nilainya.',
  );
}

/**
 * Client postgres-js. Satu instance untuk seluruh aplikasi
 * (postgres-js mengelola connection pool internal).
 */
export const client = postgres(connectionString);

export const db = drizzle(client, { schema });
