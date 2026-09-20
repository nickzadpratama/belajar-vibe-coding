# belajar-vibe-coding

Project backend sederhana: **Bun + ElysiaJS + Drizzle ORM + PostgreSQL**.

## Prasyarat

- [Bun](https://bun.com) (dites dengan v1.4.2)
- PostgreSQL — pilih salah satu:
  - **Docker** (disarankan): `docker compose up -d` (memakai `docker-compose.yml` di repo ini)
  - **PostgreSQL lokal**: install `postgresql`, lalu buat database `app_db`

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Siapkan environment variable
cp .env.example .env   # lalu sesuaikan DATABASE_URL bila perlu

# 3. Jalankan PostgreSQL (jika pakai Docker)
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
| POST | `/api/users` | Registrasi user (`{ "name", "email", "password" }`) → `201 { "data": "OK" }`; email duplikat → `409 { "error": "Email sudah terdaftar" }` |
| POST | `/api/users/login` | Login user (`{ "email", "password" }`) → `200 { "data": "<token uuid>" }`; kredensial salah → `401 { "error": "Email atau password salah" }` |
| GET | `/api/users/current` | User yang sedang login, dari header `Authorization: Bearer <token>` → `200 { "data": { id, name, email, created_at } }`; token tidak valid → `401 { "error": "Unauthorized" }` |
| GET | `/api/users` | List semua user (tanpa kolom password) |
| GET | `/api/users/:id` | Detail user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Hapus user |

Contoh:

```bash
curl http://localhost:3000/health

# Registrasi user baru
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nickzad","email":"nickzad@gmail.com","password":"rahasia"}'

# Login (mengembalikan token sesi)
curl -i -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nickzad@gmail.com","password":"rahasia"}'

# Ambil user yang sedang login (token = nilai "data" dari response login)
curl -i http://localhost:3000/api/users/current \
  -H 'Authorization: Bearer <token-uuid-hasil-login>'

curl http://localhost:3000/api/users
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
│   │   ├── index.ts      # koneksi Drizzle + PostgreSQL (postgres-js)
│   │   └── schema.ts     # definisi tabel
│   ├── routes
│   │   └── users-route.ts   # routing Elysia (validasi + status HTTP)
│   ├── services
│   │   └── users-service.ts # logic bisnis + akses database
│   └── index.ts          # entrypoint Elysia
├── drizzle.config.ts     # konfigurasi drizzle-kit (dialect postgresql)
├── docker-compose.yml    # PostgreSQL untuk development
└── .env.example          # template environment variable
```

## Catatan

- Bun otomatis membaca file `.env`, jadi tidak perlu library `dotenv` di runtime.
- File `.env` **tidak** di-commit (sudah ada di `.gitignore`).
- Driver PostgreSQL memakai `postgres` (postgres-js).
- Password user disimpan sebagai **hash bcrypt** memakai `Bun.password` bawaan Bun
  (`algorithm: 'bcrypt'`) — tanpa dependency tambahan. Password tidak pernah dikirim
  balik ke client.
- Login (`POST /api/users/login`) membuat baris baru di tabel `sessions` dengan token berupa
  **UUID** (`crypto.randomUUID()`, 36 karakter) dan mengembalikan token itu. Token belum
  memiliki waktu kedaluwarsa, dan satu user boleh memiliki banyak sesi aktif.
- Endpoint `GET /api/users/current` membaca header `Authorization: Bearer <token>` dan mencari
  token itu di tabel `sessions`. Semua penyebab kegagalan (header kosong, skema salah, token
  tidak dikenal) menjawab sama: `401 { "error": "Unauthorized" }`.
- Pelanggaran unique constraint (email duplikat) dikembalikan sebagai HTTP 409
  (kode error PostgreSQL `23505`).
- Insert/update/delete memakai `.returning()` — fitur khas PostgreSQL.


This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

