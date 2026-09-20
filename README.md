# belajar-vibe-coding

Project backend sederhana: **Bun + ElysiaJS + Drizzle ORM + MySQL**.

## Prasyarat

- [Bun](https://bun.com) (dites dengan v1.4.2)
- MySQL 8.x — pilih salah satu:
  - **Docker** (disarankan): `docker compose up -d` (memakai `docker-compose.yml` di repo ini)
  - **MySQL lokal**: install `mysql-server`, lalu buat database `app_db`

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Siapkan environment variable
cp .env.example .env   # lalu sesuaikan DATABASE_URL bila perlu

# 3. Jalankan MySQL (jika pakai Docker)
docker compose up -d

# 4. Terapkan schema ke database
bun run db:push
```

## Menjalankan

```bash
bun run dev     # watch mode
bun run start   # tanpa watch
```

Server berjalan di `http://localhost:3000` (dapat diubah lewat `PORT` di `.env`).

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/users` | List semua user |
| GET | `/users/:id` | Detail user |
| POST | `/users` | Buat user (`{ "name": "...", "email": "..." }`) |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Hapus user |

Contoh:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Budi","email":"budi@example.com"}'

curl http://localhost:3000/users
```

## Scripts

| Script | Fungsi |
|---|---|
| `bun run dev` | Jalankan server dengan watch mode |
| `bun run start` | Jalankan server |
| `bun run typecheck` | Type check TypeScript |
| `bun run db:push` | Terapkan schema langsung ke database (untuk development) |
| `bun run db:generate` | Generate file migration ke folder `drizzle/` |
| `bun run db:migrate` | Jalankan file migration |
| `bun run db:studio` | Buka Drizzle Studio |

## Struktur Folder

```
├── src
│   ├── db
│   │   ├── index.ts      # koneksi Drizzle + MySQL (pool)
│   │   └── schema.ts     # definisi tabel
│   ├── routes
│   │   └── users.ts      # CRUD /users
│   └── index.ts          # entrypoint Elysia
├── drizzle.config.ts     # konfigurasi drizzle-kit
├── docker-compose.yml    # MySQL untuk development
└── .env.example          # template environment variable
```

## Catatan

- Bun otomatis membaca file `.env`, jadi tidak perlu library `dotenv` di runtime.
- File `.env` **tidak** di-commit (sudah ada di `.gitignore`).
- Driver MySQL memakai `mysql2`. Alternatifnya driver bawaan Bun (`drizzle-orm/bun-sql/mysql`).

This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

