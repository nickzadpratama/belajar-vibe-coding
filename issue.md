# Issue — Login User (`POST /api/users/login`) + Tabel `sessions`

> **Dokumen ini adalah PLANNING, bukan implementasi.**
> Target pembaca: **junior programmer atau AI model yang lebih murah**. Karena itu instruksinya
> dibuat sangat eksplisit: file mana, perintah apa, dan hasil yang diharapkan seperti apa.
> Kerjakan **berurutan** dari Bagian 6, lalu penuhi checklist di Bagian 9.

---

## 1. Tujuan

1. Menambah tabel `sessions` untuk menyimpan token login user.
2. Fitur baru: **login user** melalui `POST /api/users/login` yang mengembalikan token.
3. Menjaga struktur yang sudah ada: routing di `src/routes/users-route.ts`, logic bisnis di
   `src/services/users-service.ts`.

## 2. Konteks project (kondisi saat ini — sudah diverifikasi di `master`)

Stack: **Bun 1.4.2 + ElysiaJS + Drizzle ORM + PostgreSQL**.

| File | Kondisi saat ini |
|---|---|
| `src/db/schema.ts` | Tabel `users`: `id` identity, `name` varchar(255) not null, `email` varchar(255) not null unique, **`password` varchar(255) not null (hash bcrypt)**, `created_at` timestamptz default now(). **Belum ada tabel `sessions`** |
| `src/services/users-service.ts` | `registerUser`, `findUsers`, `findUserById`, `updateUser`, `deleteUser`, `EmailAlreadyRegisteredError`, `isUniqueViolation` |
| `src/routes/users-route.ts` | Prefix `/api/users`: `POST /` (registrasi → 201/409), `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`. Tidak meng-import `db` |
| `src/index.ts` | Root app Elysia, `GET /health`, memakai `usersRoutes` |
| `drizzle/` | Migration terakhir: `0001_yielding_black_bird.sql` (menambah kolom `password`) |
| `package.json` | `dependencies`: `drizzle-orm`, `elysia`, `postgres` — **tanpa** library bcrypt/jwt |

Fitur registrasi user (issue #6) **sudah selesai dan ter-merge** ke `master` (PR #7).
Password user sudah tersimpan sebagai hash bcrypt, jadi login cukup memverifikasi hash tersebut —
**tidak ada migrasi data password yang diperlukan**.

## 3. Spesifikasi yang diminta owner

### 3.1 Tabel `sessions`

| Kolom | Tipe | Aturan | Catatan |
|---|---|---|---|
| `id` | integer | auto increment (primary key) | pakai `GENERATED ALWAYS AS IDENTITY`, sama seperti `users.id` |
| `token` | varchar | **isinya UUID token login** | lihat koreksi di bawah |
| `user_id` | integer | FK ke tabel `users` | + `NOT NULL` dan `ON DELETE CASCADE` (lihat koreksi) |
| `created_at` | timestamp | DEFAULT current_timestamp | pakai `timestamptz DEFAULT now()`, konsisten dengan `users` |

> **Koreksi spec (jangan bingung):** permintaan asli menulis `token varchar auto increment`.
> Itu kontradiktif: **`token` BUKAN auto increment**. Yang auto increment hanya `id`.
> `token` adalah **UUID yang dibuat oleh aplikasi** (`crypto.randomUUID()`) lalu disimpan sebagai string.
> Spec juga tidak menyebut panjang `varchar` — dipakai **`varchar(36)`** karena UUID kanonik
> selalu 36 karakter.
>
> **Koreksi kecil kedua:** spec hanya bilang "FK ke tabel users". Rencana ini memakai
> `.notNull()` + `onDelete: 'cascade'`. Alasannya: endpoint `DELETE /api/users/:id` sudah ada
> dan memakai hard delete; tanpa cascade, menghapus user yang pernah login akan gagal
> (error FK `23503`) dan endpoint lama mendadak jadi 500. Kalau owner justru ingin melarang
> hapus user yang masih punya sesi, **tanya owner dulu** — jangan ubah sendiri.

### 3.2 Endpoint login

| Item | Nilai |
|---|---|
| Method & path | `POST /api/users/login` |
| Request body | `{ "email": "nickzad@gmail.com", "password": "rahasia" }` |
| Response sukses | `{ "data": "token" }` — token = UUID sesi yang baru dibuat |
| Response kredensial salah | `{ "error": "Email atau password salah" }` |

Contoh uji:

```bash
# sukses (registrasi dulu bila user belum ada)
curl -i -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nickzad@gmail.com","password":"rahasia"}'

# gagal (password salah atau email tidak terdaftar)
curl -i -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nickzad@gmail.com","password":"salah"}'
```

> **Spec tidak menyebut status code.** Rencana ini memakai **200** untuk sukses dan
> **401** untuk kredensial salah (konvensi login). Registrasi memakai 201 karena membuat
> resource baru; login adalah aksi → 200. Kalau owner minta angka lain, tanya dulu.

## 4. Keputusan desain — WAJIB diikuti, jangan improvisasi

1. **Token dibuat dengan `crypto.randomUUID()` (Web Crypto, bawaan Bun).**
   Sudah diuji di mesin ini (Bun 1.4.2): hasilnya UUID v4 kanonik, panjang **36**, contoh
   `750e9925-1d50-4155-a716-349dc7060c22`. Jangan install `uuid`/`crypto-js`/`jsonwebtoken`.
   `Bun.randomUUIDv7()` juga ada, tapi **tidak dipakai** supaya kodenya tetap portabel ke Node.
2. **Verifikasi password memakai `Bun.password.verify(password, hash)`** — auto-deteksi algoritma
   dari prefix hash, jadi hash bcrypt hasil fitur registrasi langsung cocok. **Jangan** hash ulang,
   dan **jangan** meng-`import` library bcrypt apa pun.
3. ⚠️ `Bun.password.verify` bisa **melempar error**, bukan sekadar `false`, kalau nilai hash
   tersimpan rusak / bukan hash yang dikenal. Sudah diuji: pesannya
   `Password verification failed with error "UnsupportedAlgorithm"`. Karena itu panggilannya
   **wajib dibungkus `try/catch`** dan diperlakukan sebagai kredensial salah (401),
   bukan dibiarkan jadi 500.
4. **Email tidak terdaftar dan password salah harus menghasilkan response yang identik**
   (status 401 + pesan `Email atau password salah`). Jangan bedakan pesannya — itu
   membocorkan email mana yang terdaftar (user enumeration).
5. **Satu helper normalisasi email.** Tambahkan `normalizeEmail(email)` di service dan pakai
   di `registerUser`, `loginUser`, dan `updateUser`. Registrasi menyimpan email dalam bentuk
   lowercase; kalau login tidak menormalkan dengan cara yang sama, user yang mengetik
   `Nickzad@Gmail.com` akan gagal login padahal emailnya ada.
   Hasil uji: validasi `format: 'email'` **sudah menolak** email berspasi di awal/akhir (HTTP 422),
   jadi bagian yang benar-benar berperan adalah `toLowerCase()`; `trim()` hanya jaring pengaman.
6. **Query login boleh `select({ id: users.id, password: users.password })` dan langsung
   mengembalikan maksimal 1 baris** — kolom `email` sudah UNIQUE, jadi tidak perlu `limit(1)`.
   Kolom `password` hanya dipakai internal: **jangan** dikembalikan, jangan di-log.
7. **Sesi tidak punya waktu kedaluwarsa.** Spec tidak memintanya, jadi **jangan** menambah TTL,
   refresh token, atau kolom `expires_at`. Catat sebagai keterbatasan yang diketahui (Bagian 10).
8. **Route tetap memakai prefix `/api/users`**, endpoint baru `POST /api/users/login`.
   `GET /api/users/:id` **tidak diubah**: tidak ada konflik karena method-nya berbeda
   (sudah diuji — daftar route tetap benar). Jangan mendefinisikan `POST /api/users/:id`.
9. **Route hanya: validasi request → panggil service → tentukan status + bentuk response.**
   File route **tidak boleh** `import { db }` maupun `import { users, sessions }`.
10. Bentuk response resource users tetap: sukses `{ data: ... }`, error `{ error: ... }`.
11. Error validasi request dibiarkan memakai format bawaan Elysia (HTTP **422**) — di luar scope.
12. `src/index.ts`, `src/db/index.ts`, `drizzle.config.ts`, dan `docker-compose.yml` **tidak diubah**
    (import di `index.ts` masih `usersRoutes`, jadi tidak perlu disentuh).

## 5. Struktur file target

```
src/
├── db
│   ├── index.ts            (tidak diubah)
│   └── schema.ts           (+ tabel sessions)
├── routes
│   └── users-route.ts      (+ endpoint POST /login)
├── services
│   └── users-service.ts    (+ loginUser, InvalidCredentialsError, normalizeEmail)
└── index.ts                (tidak diubah)
```

Aturan penamaan & layer (sama seperti issue #6):

- File route: `<resource>-route.ts` · File service: `<resource>-service.ts`
- Arah dependensi satu arah: **`routes` → `services` → `db`**.
  Service tidak boleh tahu HTTP (tidak menerima `Context` Elysia, tidak memanggil `status()`).
- Import antar-file **tanpa ekstensi** (konsisten dengan kode existing, mis. `from '../db'`).
- Tidak ada file/route baru untuk `sessions` di luar tabelnya — spec hanya minta login.

## 6. Tahapan implementasi (kerjakan berurutan, jangan lompat)

### Step 0 — Persiapan

```bash
cd ~/nickzad-laptop/belajar/belajar-vibe-coding
git checkout master && git pull          # pastikan fitur registrasi (PR #7) sudah merged
git checkout -b feature/login-user
docker compose up -d                     # PostgreSQL untuk development
bun install
cp .env.example .env                     # hanya bila .env belum ada
bun run db:push                          # pastikan tabel users sudah ada
```

Hasil diharapkan: `docker compose ps` menunjukkan service `postgres` sehat (healthy),
`bun run db:push` selesai tanpa error, dan `git log --oneline -1` memuat merge PR #7.

### Step 1 — Tambah tabel `sessions` di schema

File: `src/db/schema.ts`. Tambahkan **blok baru setelah deklarasi `users`**, dan tambahkan
tipe turunannya di bawah (biarkan `User`/`NewUser` apa adanya):

```ts
/** Sesi login: satu baris = satu token aktif milik satu user. */
export const sessions = pgTable('sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  token: varchar('token', { length: 36 }).notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

Catatan: `integer`, `pgTable`, `timestamp`, `varchar` **sudah** di-import di file ini —
jangan menambah baris import. Jangan ubah tabel `users`.

### Step 2 — Generate dan terapkan migration

```bash
bun run db:generate
```

Hasil (sudah diuji di sandbox dengan skema yang sama): file baru `drizzle/0002_*.sql` berisi
`CREATE TABLE "sessions"` dengan `CONSTRAINT "sessions_token_unique" UNIQUE("token")`,
`DEFAULT now() NOT NULL` untuk `created_at`, dan
`ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade`.

Terapkan ke database (untuk dev, `db:push` lebih praktis):

```bash
bun run db:push        # dev: langsung sinkronkan schema
# atau
bun run db:migrate     # menjalankan file SQL di folder drizzle/
```

Verifikasi tabel sudah ada:

```bash
docker exec -it belajar-vibe-coding-postgres psql -U postgres -d app_db -c '\d sessions'
```

> Tabel `sessions` baru dan kosong, jadi **tidak** ada masalah kolom NOT NULL seperti pada
> Step 2 issue #6 — **tidak perlu** menghapus data apa pun.

### Step 3 — Tambah `normalizeEmail`, `InvalidCredentialsError`, `loginUser` di service

File: `src/services/users-service.ts`. Salin kerangka Bagian 7.1. Ringkasnya:

1. Ubah baris import schema menjadi `import { sessions, users } from '../db/schema';`
2. Tambahkan helper `normalizeEmail` dan **pakai juga** di `registerUser` + `updateUser`
   (ganti `input.email.trim().toLowerCase()` yang sudah ada).
3. Tambahkan class `InvalidCredentialsError`.
4. Tambahkan fungsi `loginUser`.

### Step 4 — Tambah endpoint `POST /login` di route

File: `src/routes/users-route.ts`. Salin kerangka Bagian 7.2:

- tambahkan `loginUser` dan `InvalidCredentialsError` ke daftar import dari service,
- tambahkan `const loginBody = t.Object({ ... })`,
- tambahkan handler `.post('/login', ...)` — letakkan **setelah** `.post('/', ...)` agar urutan
  endpoint mudah dibaca,
- endpoint lain **tidak diubah**.

### Step 5 — Update `README.md`

- Tambahkan baris endpoint `POST /api/users/login` di tabel endpoint (sukses 200 `{ "data": "token" }`,
  kredensial salah 401 `{ "error": "Email atau password salah" }`).
- Tambahkan contoh `curl` login (lihat Bagian 3.2).
- Tambahkan catatan: token login = **UUID** yang disimpan di tabel `sessions`, tanpa dependency baru,
  dan **belum ada kedaluwarsa token**.
- `src/index.ts` **tidak** diubah, jadi jangan sentuh file itu.

### Step 6 — Verifikasi

Jalankan **seluruh** tabel pengujian di Bagian 9.

### Step 7 — Commit & pull request

```bash
git add src/db/schema.ts src/services/users-service.ts src/routes/users-route.ts drizzle README.md
git commit -m "feat: login user POST /api/users/login + tabel sessions"
git push -u origin feature/login-user
gh pr create --base master --head feature/login-user \
  --title "feat: login user (POST /api/users/login)" --body-file <file-body-pr.md>
```

> **Jangan** memakai `git add -A` / `git add .` — pernah terjadi file lokal yang tidak
> dimaksudkan (mis. dokumen planning) ikut ter-commit dan terhapus saat merge. Sebutkan
> file satu per satu seperti contoh di atas.

Body PR wajib memuat: ringkasan perubahan, daftar file yang disentuh, dan **hasil uji Bagian 9**
(cukup tempel output perintahnya).

## 7. Kerangka kode acuan

Boleh disalin, tapi **tetap wajib lolos `bun run typecheck`** setelahnya.
Yang ditampilkan hanya bagian yang **ditambah/diubah** — sisanya biarkan apa adanya.

### 7.1 `src/services/users-service.ts`

**(a) Baris import schema — ubah 1 baris:**

```ts
import { sessions, users } from '../db/schema';
```

**(b) Tambahkan setelah class `EmailAlreadyRegisteredError`:**

```ts
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email atau password salah');
    this.name = 'InvalidCredentialsError';
  }
}

/** Satu-satunya tempat normalisasi email, dipakai register/login/update. */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
```

**(c) Ganti pemakaian normalisasi yang sudah ada** — di `registerUser`:

```ts
  const email = normalizeEmail(input.email);   // sebelumnya input.email.trim().toLowerCase()
```

dan di `updateUser`, bagian `.set({ ... })`:

```ts
    .set({ name: input.name.trim(), email: normalizeEmail(input.email) })
```

**(d) Tambahkan fungsi `loginUser`** (letakkan setelah `registerUser`):

```ts
/**
 * Verifikasi kredensial lalu buat sesi baru. Mengembalikan token sesi.
 * Email tidak dikenal dan password salah menghasilkan error yang sama.
 */
export async function loginUser(input: { email: string; password: string }) {
  const [user] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.email, normalizeEmail(input.email)));

  if (!user) {
    throw new InvalidCredentialsError();
  }

  let isValid = false;

  try {
    isValid = await Bun.password.verify(input.password, user.password);
  } catch {
    // Hash tersimpan rusak / algoritmanya tidak dikenal: perlakukan sebagai gagal login,
    // jangan bocorkan detail ke client.
    throw new InvalidCredentialsError();
  }

  if (!isValid) {
    throw new InvalidCredentialsError();
  }

  const token = crypto.randomUUID();

  await db.insert(sessions).values({ token, userId: user.id });

  return token;
}
```

Catatan penting:

- `registerUser`, `findUsers`, `findUserById`, `updateUser`, `deleteUser`, `isUniqueViolation`,
  dan `publicColumns` **tidak diubah** selain normalisasi email di poin (c).
- `publicColumns` tidak perlu diubah: kolom `sessions` tidak pernah ikut ter-select.
- Hashing **tidak** dilakukan di `loginUser` — yang dipakai `Bun.password.verify`.

### 7.2 `src/routes/users-route.ts`

**(a) Tambahkan ke daftar import dari service:**

```ts
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,   // ← baru
  deleteUser,
  findUserById,
  findUsers,
  loginUser,                 // ← baru
  registerUser,
  updateUser,
} from '../services/users-service';
```

**(b) Tambahkan `loginBody`** (setelah `registerBody`):

```ts
const loginBody = t.Object({
  email: t.String({ format: 'email', maxLength: 255 }),
  // minLength 1 (bukan 8): contoh password di spec hanya 7 karakter.
  // maxLength 72 mengikuti batas bcrypt standar.
  password: t.String({ minLength: 1, maxLength: 72 }),
});
```

**(c) Tambahkan handler `POST /login`** (setelah handler `.post('/', ...)`):

```ts
  .post(
    '/login',
    async ({ body, status }) => {
      try {
        const token = await loginUser(body);

        return status(200, { data: token });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return status(401, { error: 'Email atau password salah' });
        }

        throw error;
      }
    },
    { body: loginBody },
  )
```

Catatan:

- Path `'/login'` pada prefix `/api/users` melayani `POST /api/users/login`.
- `body` sudah tervalidasi Elysia dan bertipe `{ email: string; password: string }`.
- Endpoint lain (`GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`) tidak diubah.

### 7.3 `src/index.ts`

**Tidak ada perubahan.** Import dan `.use(usersRoutes)` tetap sama.

### 7.4 Hasil validasi kode acuan (sudah diuji tanpa database)

Kode pada Bagian 7.1–7.2 dijalankan di sandbox terpisah dengan modul `db` di-mock
(supaya tidak butuh PostgreSQL). Hasilnya:

| Uji | Hasil |
|---|---|
| `bun run typecheck` pada kode acuan | ✅ 0 error |
| Daftar route terdaftar | ✅ `POST /api/users/`, `POST /api/users/login`, `GET /api/users/`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id` — tidak ada tabrakan |
| Login sukses | ✅ `200` `{"data":"d99818c4-ded2-48b6-ba0e-254ea510a028"}` (UUID v4, panjang 36) |
| Baris yang di-insert ke `sessions` | ✅ `{"token":"<uuid>","userId":7}` |
| Email `Nickzad@Gmail.com` yang dipakai query | ✅ `"nickzad@gmail.com"` (di-lowercase) |
| Password salah | ✅ `401` `{"error":"Email atau password salah"}` |
| Email tidak terdaftar | ✅ `401` `{"error":"Email atau password salah"}` (pesan identik) |
| Server boot & `GET /health` | ✅ HTTP 200 |
| `POST /api/users/login` body invalid (`email: "bukan-email"`) | ✅ HTTP 422 |
| `POST /api/users` (registrasi, regresi) | ✅ masih terdaftar & tetap 201 pada jalur sukses (uji mock issue #6) |
| Migration `db:generate` | ✅ menghasilkan `CREATE TABLE "sessions"`, `UNIQUE("token")`, FK `ON DELETE cascade` |

**Catatan kuat:** implementasi pada Bagian 7.1–7.3 juga diuji dengan cara **dibangun ulang
hanya dari snippet dokumen ini** (tidak menyalin kode lain): hasilnya `bun run typecheck`
**0 error**, dan script pada Bagian 13 menghasilkan 200/401/401 persis seperti tabel di atas.
Jadi snippet di dokumen ini konsisten dengan kode yang sudah teruji.

**Yang belum terverifikasi** (butuh PostgreSQL nyata): tabel `sessions` benar-benar terbentuk di
database, constraint UNIQUE & FK bekerja, baris sesi benar-benar tersimpan dengan `user_id` yang
benar, dan login memakai password asli hasil registrasi. Semuanya **wajib** diuji di Step 6.

Cara menguji jalur login tanpa database ada di Bagian 13 (opsional).

## 8. Jebakan yang mudah terjadi di repo ini

| # | Jebakan | Cara menghindar |
|---|---|---|
| 1 | `Bun.password.verify` melempar error (bukan `false`) untuk hash rusak → 500 | Bungkus `try/catch`, lempar `InvalidCredentialsError` |
| 2 | Login gagal padahal email ada, karena email `Nickzad@Gmail.com` tidak di-lowercase | Pakai `normalizeEmail()` yang sama seperti registrasi |
| 3 | Pesan error berbeda untuk "email tidak ada" vs "password salah" | Selalu `Email atau password salah` + 401 untuk keduanya |
| 4 | Menaruh `password` di response (`select()` tanpa argumen) | Select eksplisit `{ id, password }` hanya di dalam service |
| 5 | `const [x] = await db…` bertipe `X \| undefined` (`noUncheckedIndexedAccess: true`) | Cek `if (!user)` sebelum dipakai |
| 6 | Import tipe memakai `import { … }` padahal `verbatimModuleSyntax: true` | Import tipe pakai `import type { … }` |
| 7 | Menulis ekstensi file di import (`from '../db/index.ts'`) | Ikuti kode existing: **tanpa ekstensi** |
| 8 | Memakai `algorithm: 'bcrypt'` di `Bun.password.verify` | Opsi itu tidak ada di `verify` — cukup `(password, hash)` |
| 9 | Menelan semua error: `catch { return 401 }` di route | Route hanya menangkap `InvalidCredentialsError`; error lain `throw error` |
| 10 | Mendefinisikan `POST /api/users/:id` atau mengubah `GET /:id` | Cukup tambahkan `POST /login`; method berbeda tidak bertabrakan |
| 11 | Menambah `expires_at`, refresh token, atau JWT karena "kurang lengkap" | Semua itu **di luar scope** (Bagian 10) — tanya owner |
| 12 | `bun add uuid` / `bun add jsonwebtoken` | Tidak perlu: `crypto.randomUUID()` sudah ada di Bun |
| 13 | Menyimpan token di tabel `users` | Token disimpan di tabel `sessions`, satu baris per sesi login |
| 14 | Lupa `ON DELETE cascade` pada FK | `DELETE /api/users/:id` akan gagal (error FK `23503` → 500) untuk user yang pernah login |
| 15 | Menambah `t.String({ minLength: 8 })` pada password login | Contoh di spec (`"rahasia"`) hanya 7 karakter → request contoh akan ditolak 422 |

## 9. Definition of Done (semua wajib dijalankan)

```bash
bun run typecheck        # harap: 0 error
bun run dev              # biarkan terminal ini tetap jalan
```

Di terminal kedua:

| # | Uji | Perintah | Hasil yang benar |
|---|---|---|---|
| 0 | Siapkan user uji | `curl -i -X POST localhost:3000/api/users -H 'Content-Type: application/json' -d '{"name":"Nickzad","email":"nickzad@gmail.com","password":"rahasia"}'` | `201` (kalau `409`, user sudah ada — lanjut saja) |
| 1 | Health tetap jalan | `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/health` | `200` |
| 2 | Login sukses | `curl -i -X POST localhost:3000/api/users/login -H 'Content-Type: application/json' -d '{"email":"nickzad@gmail.com","password":"rahasia"}'` | `200` + `{"data":"<uuid>"}` |
| 3 | Bentuk token | `TOKEN=$(curl -s -X POST localhost:3000/api/users/login -H 'Content-Type: application/json' -d '{"email":"nickzad@gmail.com","password":"rahasia"}' \| sed 's/.*"data":"\([^"]*\)".*/\1/'); echo ${#TOKEN}; echo $TOKEN` | panjang `36`, format UUID |
| 4 | Email beda huruf besar | ulangi #2 dengan `"email":"Nickzad@Gmail.com"` | `200` + token (harus sukses) |
| 5 | Password salah | ulangi #2 dengan `"password":"salah"` | `401` + `{"error":"Email atau password salah"}` |
| 6 | Email tidak terdaftar | ulangi #2 dengan `"email":"tidak-ada@gmail.com"` | `401` + pesan **identik** dengan #5 |
| 7 | Body tidak valid | ulangi #2 dengan `{"email":"bukan-email","password":"x"}` | `422` |
| 8 | Token tersimpan di DB | `docker exec -it belajar-vibe-coding-postgres psql -U postgres -d app_db -c 'SELECT id, user_id, token, created_at FROM sessions;'` | ada baris, `token` 36 karakter, `user_id` milik user uji |
| 9 | Token unik | jalankan #2 dua kali, lalu `SELECT count(*) FROM sessions;` | bertambah 2 baris dengan token berbeda |
| 10 | Response tidak membocorkan password | `curl -s localhost:3000/api/users` | tidak ada kata `password` di output |
| 11 | Cascade FK (opsional) | `curl -s -X DELETE localhost:3000/api/users/<id_user_uji>` lalu cek `SELECT count(*) FROM sessions WHERE user_id=<id>;` | `200` + `0` (sesi ikut terhapus, bukan error) |
| 12 | Tidak ada dependency baru | `grep -nE 'bcrypt\|jsonwebtoken\|uuid' package.json` | **tidak ada hasil** |
| 13 | Migration ter-generate | `ls drizzle/` | ada `0002_*.sql` yang memuat `CREATE TABLE "sessions"` |
| 14 | Route tidak menyentuh DB langsung | `grep -rn 'import { db }' src/routes` | **tidak ada hasil** |

Checklist akhir:

- [ ] Semua uji di tabel Bagian 9 lulus (tempel outputnya di body PR)
- [ ] `bun run typecheck` 0 error
- [ ] `src/db/schema.ts` hanya bertambah (tabel `users` tidak berubah)
- [ ] `src/services/users-service.ts` **tidak** memuat kode Elysia
- [ ] `src/index.ts` tidak diubah sama sekali
- [ ] README diperbarui (endpoint login + catatan token UUID tanpa kedaluwarsa)
- [ ] PR ke `master` dibuat, body memuat ringkasan + hasil uji

## 10. Di luar scope (JANGAN dikerjakan)

Logout / hapus sesi, kedaluwarsa token (`expires_at`), refresh token, JWT, middleware autentikasi,
endpoint `GET /api/me`, ganti/reset password, verifikasi email, rate limiting/lockout,
role & permission, multiple device/session management, soft delete, pagination,
test otomatis/framework, dan normalisasi unicode email.

**Keterbatasan yang diketahui dari desain ini:** token tidak pernah kedaluwarsa dan satu user
boleh punya banyak sesi aktif sekaligus. Spec tidak memintanya, jadi tidak diimplementasikan.
Kalau menurut Anda salah satu hal di atas perlu, **tanya owner dulu** — jangan menambahkannya sendiri.

## 11. Ringkasan file yang disentuh

| File | Aksi |
|---|---|
| `src/db/schema.ts` | ubah: + tabel `sessions` + tipe `Session`/`NewSession` |
| `drizzle/0002_*.sql` & `drizzle/meta/*` | dibuat otomatis oleh `bun run db:generate` |
| `src/services/users-service.ts` | ubah: + `loginUser`, `InvalidCredentialsError`, `normalizeEmail`; import `sessions` |
| `src/routes/users-route.ts` | ubah: + import service, + `loginBody`, + handler `POST /login` |
| `README.md` | ubah: endpoint login, contoh curl, catatan token |
| `src/index.ts` | **tidak berubah** |
| `package.json` / `bun.lock` | **tidak berubah** (tanpa dependency baru) |

## 12. Kalau ada yang gagal atau environment tidak mendukung

Aturan yang dipakai di repo ini (lihat riwayat issue #3 dan #6):

1. **Jangan mengarang hasil verifikasi.** Kalau PostgreSQL/Docker tidak tersedia, tulis jelas di PR:
   perintah apa yang sudah dijalankan, hasilnya apa, dan langkah mana yang belum bisa diuji.
2. Bagian yang tetap bisa diverifikasi **tanpa database**:
   `bun run typecheck`, server boot, `GET /health`, penolakan validasi (`422`), daftar route, dan
   seluruh uji mock di Bagian 13 — karena validasi Elysia jalan **sebelum** query ke database.
3. `bun run db:generate` juga bisa dijalankan tanpa koneksi database (hanya membaca schema).
   `bun run db:push` / `db:migrate` **butuh** database.
4. Sisa verifikasi (uji #2–#11 di Bagian 9) diserahkan ke owner; lengkapi langkahnya di body PR.
5. Kalau ragu antara dua pilihan teknis: **berhenti dan tanya owner**, jangan improvisasi
   (misalnya jangan mengganti UUID ke JWT atau menambah dependency).

## 13. Lampiran (opsional) — uji jalur login tanpa database

Dipakai bila PostgreSQL/Docker belum tersedia. Script ini **alat bantu sementara — jangan
di-commit**; hapus setelah selesai dipakai.

Simpan sebagai `check-login.ts` di root project, lalu jalankan:

```bash
MOCK_MODE=success                  bun check-login.ts   # harap: 200 {"data":"<uuid>"}
MOCK_MODE=success WRONG_PASSWORD=1 bun check-login.ts   # harap: 401 {"error":"Email atau password salah"}
MOCK_MODE=notfound                 bun check-login.ts   # harap: 401 pesan sama
```

Isi file (`mock` berasal dari `bun:test` bawaan Bun — tidak perlu instalasi apa pun):

```ts
import { mock } from 'bun:test';

const mode = process.env.MOCK_MODE ?? 'success';
const wrongPassword = process.env.WRONG_PASSWORD === '1';
const abs = (p: string) => new URL(p, import.meta.url).pathname;
const hash = await Bun.password.hash('rahasia', { algorithm: 'bcrypt', cost: 10 });

mock.module(abs('./src/db/index.ts'), () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: any) => {
          const values = (cond?.queryChunks ?? [])
            .map((chunk: any) => chunk?.value)
            .filter((value: any) => value !== undefined);

          console.log('  nilai di WHERE  :', JSON.stringify(values));

          return Promise.resolve(mode === 'notfound' ? [] : [{ id: 7, password: hash }]);
        },
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        console.log('  row di-insert   :', JSON.stringify(v));

        return Promise.resolve([]);
      },
    }),
  },
}));

const { usersRoutes } = await import(abs('./src/routes/users-route.ts'));

const res = await usersRoutes.handle(
  new Request('http://localhost/api/users/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'Nickzad@Gmail.com',
      password: wrongPassword ? 'salah' : 'rahasia',
    }),
  }),
);

console.log('  mode/wrongPw    :', mode, '/', wrongPassword);
console.log('  status          :', res.status);
console.log('  body            :', await res.text());
```

Script ini **tidak menggantikan** pengujian ke database asli (Bagian 9). Fungsinya hanya
membuktikan logika route + service sudah benar saat database belum tersedia.
