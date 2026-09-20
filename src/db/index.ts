import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL belum diset. Salin .env.example menjadi .env lalu sesuaikan nilainya.',
  );
}

/**
 * Connection pool MySQL. Gunakan satu pool untuk seluruh aplikasi.
 */
export const pool = mysql.createPool(connectionString);

export const db = drizzle(pool, { schema, mode: 'default' });
