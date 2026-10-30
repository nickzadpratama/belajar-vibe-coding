# Belajar Vibe Coding

REST API backend untuk manajemen user dengan fitur autentikasi (register, login, logout, session management). Dibangun dengan **Bun**, **ElysiaJS**, **Drizzle ORM**, dan **PostgreSQL**.

## Technology Stack

| Teknologi | Versi | Fungsi |
|---|---|---|
| [Bun](https://bun.com) | v1.4.2 | JavaScript/TypeScript runtime, package manager, test runner |
| [ElysiaJS](https://elysiajs.com) | v1.4.30 | Web framework (routing, validasi request body/params) |
| [@elysiajs/swagger](https://elysiajs.com/plugins/swagger.html) | v1.3.1 | Dokumentasi interaktif OpenAPI / Swagger UI |
| [Drizzle ORM](https://orm.drizzle.team) | v0.45.2 | ORM type-safe untuk query dan schema management |
| [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) | v0.31.10 | CLI tool untuk migration dan studio |
| [postgres (postgres-js)](https://github.com/porsager/postgres) | v3.4.9 | PostgreSQL driver (connection pooling internal) |
| [PostgreSQL](https://www.postgresql.org) | 17 | Database relasional |
| [TypeScript](https://www.typescriptlang.org) | v7 | Type checking (strict mode) |
| [Docker](https://www.docker.com) | - | Container untuk PostgreSQL development |

## Arsitektur & Struktur Folder

```
belajar-vibe-coding/
├── src/                          # Source code aplikasi
│   ├── index.ts                  # Entrypoint — inisialisasi Elysia, mount routes, listen port
│   ├── db/                       # Layer database
│   │   ├── index.ts              # Koneksi Drizzle + postgres-js client (singleton)
│   │   └── schema.ts             # Definisi tabel (users, sessions) + type inference
│   ├── routes/                   # Layer routing (HTTP handler)
│   │   └── users-route.ts        # Semua endpoint /api/users/* (validasi, status code, error handling)
│   └── services/                 # Layer business logic
│       └── users-service.ts      # Logic bisnis: CRUD user, auth, session management
├── tests/                        # Unit tests (bun:test)
│   ├── mock-db.ts                # Shared mock database (fake Drizzle query builder)
│   ├── helpers.ts                # Helper functions (call, sha256hex, collectParams)
│   ├── users-route.test.ts       # Test utama (logout, login, current, register, regresi)
│   ├── health.test.ts            # Test health endpoint
│   ├── register.test.ts          # Test register endpoint
│   ├── login.test.ts             # Test login endpoint
│   ├── swagger.test.ts           # Test endpoint OpenAPI / Swagger JSON
│   ├── list-users.test.ts        # Test list users endpoint
│   ├── get-user.test.ts          # Test get user by ID endpoint
│   └── update-user.test.ts       # Test update user endpoint
├── drizzle/                      # Generated migration files
│   ├── 0000_cynical_mother_askani.sql
│   ├── 0001_yielding_black_bird.sql
│   ├── 0002_icy_kulan_gath.sql
│   ├── 0003_tranquil_harrier.sql
│   └── meta/                     # Migration metadata & snapshots
├── drizzle.config.ts             # Konfigurasi Drizzle Kit (dialect, schema path, output dir)
├── docker-compose.yml            # Docker Compose untuk PostgreSQL development
├── package.json                  # Dependencies, scripts, project metadata
├── tsconfig.json                 # Konfigurasi TypeScript (strict mode, bundler resolution)
├── bun.lock                      # Lockfile Bun
└── .env.example                  # Template environment variable (DATABASE_URL)
```

### Pola Arsitektur

Aplikasi mengikuti pola **3-layer architecture**:

```
Request → Route (validasi & HTTP) → Service (business logic) → Database (Drizzle ORM)
```

- **Routes** (`src/routes/`) — Menerima HTTP request, validasi input (body/params) menggunakan TypeBox schema dari Elysia, mengembalikan status code dan response JSON yang tepat.
- **Services** (`src/services/`) — Berisi seluruh business logic: hashing password, normalisasi email, pembuatan token sesi, pembersihan sesi expired, dsb. Tidak tahu tentang HTTP.
- **Database** (`src/db/`) — Koneksi dan definisi schema. Drizzle ORM menyediakan type-safe query builder.

## Database Schema

### Tabel `users`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `integer` | PRIMARY KEY, auto-increment (identity) | ID unik user |
| `name` | `varchar(255)` | NOT NULL | Nama user |
| `email` | `varchar(255)` | NOT NULL, UNIQUE | Email user (disimpan lowercase) |
| `password` | `varchar(255)` | NOT NULL | Hash bcrypt dari password |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT NOW() | Waktu registrasi |

### Tabel `sessions`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `integer` | PRIMARY KEY, auto-increment (identity) | ID unik sesi |
| `token` | `varchar(64)` | NOT NULL, UNIQUE | Hash SHA-256 (hex) dari token UUID client |
| `user_id` | `integer` | NOT NULL, FOREIGN KEY → `users.id` (ON DELETE CASCADE) | Pemilik sesi |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT NOW() | Waktu sesi dibuat |
| `expires_at` | `timestamp with time zone` | NOT NULL | Waktu kedaluwarsa sesi (7 hari sejak login) |

**Index:** `sessions_user_id_idx` pada kolom `user_id`.

### Diagram ER

```mermaid
erDiagram
    users {
        integer id PK
        varchar name
        varchar email UK
        varchar password
        timestamp created_at
    }
    sessions {
        integer id PK
        varchar token UK
        integer user_id FK
        timestamp created_at
        timestamp expires_at
    }
    users ||--o{ sessions : "has"
```

## API Endpoints

Base URL: `http://localhost:3000`

### Dokumentasi Interaktif (Swagger UI)

Saat server berjalan, buka browser di alamat:
- **Swagger UI**: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- **OpenAPI JSON Spec**: [http://localhost:3000/swagger/json](http://localhost:3000/swagger/json)

Swagger UI menyediakan fitur *Try it out* interaktif lengkap dengan tombol **Authorize** untuk menguji endpoint dengan Bearer Token.

### Health Check

| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/health` | Cek status server |
| `GET` | `/swagger` | Tampilan interaktif Swagger UI |
| `GET` | `/swagger/json` | Spesifikasi OpenAPI JSON |

**Response:** `200`
```json
{ "status": "ok", "database": "postgresql", "timestamp": "2026-01-01T00:00:00.000Z" }
```

### User Management

#### Register User
| Method | Path |
|---|---|
| `POST` | `/api/users` |

**Request Body:**
```json
{ "name": "Nickzad", "email": "nickzad@gmail.com", "password": "rahasia" }
```

| Field | Tipe | Validasi |
|---|---|---|
| `name` | string | min 1, max 255 karakter |
| `email` | string | format email, max 255 karakter |
| `password` | string | min 1, max 72 karakter (batas bcrypt) |

**Response:**
- `201` → `{ "data": "OK" }`
- `409` → `{ "error": "Email sudah terdaftar" }` (email duplikat)
- `400` → Validasi gagal

#### Login User
| Method | Path |
|---|---|
| `POST` | `/api/users/login` |

**Request Body:**
```json
{ "email": "nickzad@gmail.com", "password": "rahasia" }
```

**Response:**
- `200` → `{ "data": "<token-uuid>" }` — token UUID untuk autentikasi
- `401` → `{ "error": "Email atau password salah" }`

**Catatan:** Login juga membersihkan sesi kedaluwarsa milik user tersebut.

#### Get Current User
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/users/current` | `Authorization: Bearer <token>` |

**Response:**
- `200` → `{ "data": { "id": 1, "name": "Nickzad", "email": "nickzad@gmail.com", "created_at": "..." } }`
- `401` → `{ "error": "Unauthorized" }`

#### Logout User
| Method | Path | Auth |
|---|---|---|
| `DELETE` | `/api/users/logout` | `Authorization: Bearer <token>` |

**Response:**
- `200` → `{ "data": "OK" }`
- `401` → `{ "error": "Unauthorized" }`

#### List All Users
| Method | Path |
|---|---|
| `GET` | `/api/users` |

**Response:** `200` → Array of `{ id, name, email, createdAt }` (tanpa password)

#### Get User by ID
| Method | Path |
|---|---|
| `GET` | `/api/users/:id` |

**Response:**
- `200` → `{ id, name, email, createdAt }`
- `404` → `{ "error": "User tidak ditemukan" }`

#### Update User
| Method | Path |
|---|---|
| `PUT` | `/api/users/:id` |

**Request Body:**
```json
{ "name": "Nama Baru", "email": "email-baru@gmail.com" }
```

**Response:**
- `200` → `{ id, name, email, createdAt }` (data yang sudah diupdate)
- `404` → `{ "error": "User tidak ditemukan" }`

#### Delete User
| Method | Path |
|---|---|
| `DELETE` | `/api/users/:id` |

**Response:**
- `200` → `{ "data": "OK" }`
- `404` → `{ "error": "User tidak ditemukan" }`

## Setup Project

### Prasyarat

- [Bun](https://bun.com) v1.4.2 atau lebih baru
- PostgreSQL — pilih salah satu:
  - **Docker** (disarankan): menggunakan `docker-compose.yml` yang sudah disediakan
  - **PostgreSQL lokal**: install PostgreSQL, lalu buat database `app_db`

### Langkah Setup

```bash
# 1. Clone repository
git clone https://github.com/nickzadpratama/belajar-vibe-coding.git
cd belajar-vibe-coding

# 2. Install dependencies
bun install

# 3. Siapkan environment variable
cp .env.example .env
# Edit .env, sesuaikan DATABASE_URL jika perlu
# Default: postgresql://postgres:postgrespassword@localhost:5432/app_db

# 4. Jalankan PostgreSQL (jika pakai Docker)
docker compose up -d

# 5. Terapkan schema ke database
bun run db:push
```

## Menjalankan Aplikasi

```bash
# Development (watch mode — auto-restart saat file berubah)
bun run dev

# Production
bun run start
```

Server berjalan di `http://localhost:3000` (dapat diubah lewat variabel `PORT` di `.env`).

### Contoh Penggunaan

```bash
# Health check
curl http://localhost:3000/health

# Register user baru
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nickzad","email":"nickzad@gmail.com","password":"rahasia"}'

# Login (mengembalikan token sesi)
curl -i -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nickzad@gmail.com","password":"rahasia"}'

# Ambil user yang sedang login
curl -i http://localhost:3000/api/users/current \
  -H 'Authorization: Bearer <token-uuid-hasil-login>'

# Logout
curl -i -X DELETE http://localhost:3000/api/users/logout \
  -H 'Authorization: Bearer <token-uuid-hasil-login>'

# List semua user
curl http://localhost:3000/api/users
```

## Testing

Unit test menggunakan **Bun Test** (`bun:test`) dengan mock database (tanpa PostgreSQL).

```bash
# Jalankan semua test
bun test

# Type check
bun run typecheck
```

Test menggunakan pola **mock module** untuk mengganti koneksi database asli dengan fake query builder, sehingga test bisa berjalan tanpa koneksi PostgreSQL.

## NPM Scripts

| Script | Fungsi |
|---|---|
| `bun run dev` | Jalankan server dengan watch mode |
| `bun run start` | Jalankan server (production) |
| `bun run typecheck` | Type check TypeScript (`tsc --noEmit`) |
| `bun test` | Jalankan unit test |
| `bun run db:push` | Terapkan schema langsung ke database (development) |
| `bun run db:generate` | Generate file migration ke folder `drizzle/` |
| `bun run db:migrate` | Jalankan file migration |
| `bun run db:studio` | Buka Drizzle Studio (GUI database) |

## Catatan Teknis

- **Bun** otomatis membaca file `.env` — tidak perlu library `dotenv`.
- File `.env` **tidak** di-commit (ada di `.gitignore`).
- Password user disimpan sebagai **hash bcrypt** menggunakan `Bun.password` bawaan Bun — tanpa dependency tambahan.
- Token sesi: client menerima **UUID** (`crypto.randomUUID()`), database menyimpan **hash SHA-256** (hex, 64 karakter). Token mentah tidak pernah tersimpan di server.
- Sesi berlaku **7 hari** (kolom `expires_at`). Sesi kedaluwarsa dibersihkan saat user login.
- Email dinormalisasi ke **lowercase** saat register, login, dan update.
- Pelanggaran unique constraint (email duplikat) dikembalikan sebagai **HTTP 409** (PostgreSQL error code `23505`).
- Insert/update/delete menggunakan `.returning()` — fitur khas PostgreSQL.

---

This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
