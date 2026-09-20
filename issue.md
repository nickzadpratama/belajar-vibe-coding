# Planning: Setup Project Baru (Bun + ElysiaJS + Drizzle + MySQL)

> Dokumen ini adalah **planning / instruksi high-level** untuk diimplementasikan.
> Tidak perlu mengikuti detail kode secara ketat — gunakan penilaian sendiri,
> selama hasil akhirnya sesuai **Acceptance Criteria** di bagian bawah.

## Tujuan

Membuat project backend baru di **root folder repo ini** (bukan di subfolder)
dengan stack berikut:

| Komponen | Teknologi |
|---|---|
| Runtime & package manager | [Bun](https://bun.sh) |
| Web framework | [ElysiaJS](https://elysiajs.com) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) (+ drizzle-kit) |
| Database | MySQL |

## Kondisi Awal

- Folder repo saat ini hanya berisi `.git/` dan `prompt.txt`.
- **Jangan menghapus** kedua file/folder tersebut.
- Belum ada `package.json` / source code — project di-init dari nol.

## Prasyarat

- Bun terpasang (`bun --version` bisa jalan).
- MySQL yang bisa diakses:
  - Jika tidak ada MySQL lokal, jalankan via **Docker Compose**
    (contoh image `mysql:8`, simpan sebagai `docker-compose.yml`,
    kredensial & port sederhana).
- Connection string disimpan di `.env` dengan format:
  `DATABASE_URL=mysql://user:password@localhost:3306/nama_db`

## Langkah Implementasi (High-Level)

### 1. Inisialisasi project
- Jalankan init project Bun di root folder ini.
- Pastikan `package.json` dan `tsconfig.json` dibuat, TypeScript aktif.
- Tambahkan `.gitignore` (minimal: `node_modules/`, `.env`).

### 2. Install dependencies
- Runtime: `elysia`, `drizzle-orm`, `mysql2`.
- Dev: `drizzle-kit`.
- Gunakan **versi stabil terbaru** (tidak perlu pin versi persis).

### 3. Setup database
- Buat service MySQL di `docker-compose.yml` (jika pakai Docker).
- Siapkan database awal (mis. `app_db`) sesuai `DATABASE_URL`.
- Simpan kredensial di `.env`, dan buat `.env.example` sebagai template
  (tanpa nilai asli).

### 4. Setup Drizzle
- Buat file schema (mis. `src/db/schema.ts`) dengan **satu tabel contoh sederhana**
  (mis. `users`: id, name, email — cukup itu saja).
- Buat `drizzle.config.ts` di root (dialect `mysql`, arahkan ke schema & `.env`).
- Buat instance koneksi Drizzle (mis. `src/db/index.ts`) memakai driver `mysql2`.
  - Alternatif opsional: driver bawaan Bun (`drizzle-orm/bun-sql/mysql`) —
    lebih cepat, tapi jika ragu pakai `mysql2` saja karena jalurnya lebih
    teruji dan didokumentasikan resmi.

### 5. Setup ElysiaJS
- Buat entrypoint app (mis. `src/index.ts`).
- Definisikan route minimal:
  - `GET /health` → respons sederhana (untuk smoke test).
  - CRUD sederhana untuk tabel contoh (`users`) sebagai bukti
    koneksi DB berjalan (create, list — update/delete opsional).
- Jalankan dev server dengan `bun --watch` (via script `dev`).

### 6. Script package.json
- `dev` → jalankan server dengan watch mode.
- `db:push` → `drizzle-kit push` (terapkan schema ke DB).
- `db:generate` / `db:migrate` → generate & jalankan migration files.
- `db:studio` → `drizzle-kit studio` (opsional).

> Untuk development, `drizzle-kit push` cukup. Migration files (generate + migrate)
> disiapkan sebagai workflow siap pakai, belum harus dijalankan semua.

### 7. Verifikasi
- Jalankan semua langkah verifikasi secara manual, pastikan tidak ada error.

## Acceptance Criteria

- [ ] `bun install` sukses tanpa error.
- [ ] `bun run dev` menjalankan server Elysia di port lokal.
- [ ] `GET /health` merespons dengan sukses.
- [ ] Tabel contoh (`users`) terbentuk di MySQL (via `drizzle-kit push`).
- [ ] Route CRUD contoh berhasil insert & read data ke/dari MySQL.
- [ ] `.env` ada di `.gitignore` dan **tidak** ter-commit.
- [ ] `.env.example`, `docker-compose.yml`, dan `README.md` singkat
      (cara setup & run) tersedia dan ter-commit.
- [ ] `prompt.txt` dan folder `.git` tetap utuh.

## Catatan / Batasan

- **Jangan overengineer**: tanpa auth, tanpa testing framework, tanpa CI,
  tanpa lapisan arsitektur berlebihan. Cukup struktur folder yang rapi.
- Versi library bebas asal stabil terbaru; tidak perlu upgrade/downgrade spesifik.
- Jika ada langkah yang blocker, dokumentasikan kendalanya di commit message
  atau PR description, jangan berhenti diam-diam.
