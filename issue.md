# Issue — Registrasi User (`POST /api/users`) + Struktur `routes` & `services`

> **Dokumen ini adalah PLANNING, bukan implementasi.**
> Target pembaca: **junior programmer atau AI model yang lebih murah**. Karena itu instruksinya
> dibuat sangat eksplisit: file mana, perintah apa, dan hasil yang diharapkan seperti apa.
> Kerjakan **berurutan** dari Bagian 6, lalu penuhi checklist di Bagian 9.

---

## 1. Tujuan

1. Menambah kolom `password` (berisi **hash bcrypt**) pada tabel `users`.
2. Fitur baru: **registrasi user** melalui `POST /api/users`.
3. Restrukturisasi `src/`: routing Elysia di `src/routes`, logic bisnis di `src/services`
   (penamaan file `users-route.ts` dan `users-service.ts`).

## 2. Konteks project (kondisi saat ini — sudah diverifikasi)

Stack: **Bun + ElysiaJS + Drizzle ORM + PostgreSQL**.

| File | Kondisi saat ini |
|---|---|
| `src/index.ts` | Root app Elysia, `GET /health`, memakai `usersRoutes` dari `./routes/users` |
| `src/routes/users.ts` | Prefix `/users`, CRUD (GET list, GET detail, POST, PUT, DELETE). **Semua query DB masih langsung di file route ini** |
| `src/db/schema.ts` | Tabel `users`: `id` identity, `name` varchar(255) not null, `email` varchar(255) not null unique, `created_at` timestamptz default now() not null — **belum ada `password`** |
| `src/db/index.ts` | Koneksi `postgres` (postgres-js) + Drizzle, membaca `DATABASE_URL` dari `.env` |
| `drizzle.config.ts` | `dialect: 'postgresql'`, `out: './drizzle'` |
| `package.json` | Scripts: `dev`, `start`, `typecheck`, `db:push`, `db:generate`, `db:migrate`, `db:studio` |

**Alur kerja yang harus dipatuhi:** pekerjaan PostgreSQL ada di **PR #5**
(branch `feat/postgresql` → `master`) dan mungkin belum di-merge saat planning ini dibaca.
Pastikan PR #5 **sudah di-merge** ke `master`, baru buat branch kerja baru dari `master` terbaru.

## 3. Spesifikasi yang diminta owner

### 3.1 Tabel `users`

| Kolom | Tipe | Aturan | Status |
|---|---|---|---|
| `id` | integer | auto increment (primary key) | ✅ sudah ada (`GENERATED ALWAYS AS IDENTITY`) |
| `name` | varchar(255) | NOT NULL | ✅ sudah ada |
| `email` | varchar(255) | NOT NULL, UNIQUE | ✅ sudah ada |
| `password` | varchar(255) | NOT NULL, berisi **hash bcrypt** | ❌ **perlu ditambahkan** |
| `created_at` | timestamp | DEFAULT current_timestamp | ✅ sudah ada (`timestamptz DEFAULT now() NOT NULL`) |

> **Koreksi spec (jangan bingung):** permintaan asli memuat baris `name varchar auto increment`
> yang kontradiktif dan menduplikasi baris di atasnya. Yang **auto increment hanya `id`**;
> `name` tetap `varchar(255) NOT NULL`. Kolom `created_at` yang diminta setara dengan
> `timestamptz DEFAULT now()` yang sudah ada, jadi tidak perlu diubah.
> **Intinya: tabel `users` sudah ada, tugasnya hanya menambah 1 kolom `password`.**

### 3.2 Endpoint registrasi

| Item | Nilai |
|---|---|
| Method & path | `POST /api/users` |
| Request body | `{ "name": "Nickzad", "email": "nickzad@gmail.com", "password": "rahasia" }` |
| Response sukses | HTTP **201** → `{ "data": "OK" }` |
| Response email duplikat | HTTP **409** → `{ "error": "Email sudah terdaftar" }` |

Contoh uji:

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nickzad","email":"nickzad@gmail.com","password":"rahasia"}'
```

## 4. Keputusan desain — WAJIB diikuti, jangan improvisasi

1. **bcrypt memakai `Bun.password` bawaan — JANGAN install `bcryptjs`/`bcrypt`.**
   Sudah diuji di mesin ini dengan Bun 1.4.2:
   `Bun.password.hash('rahasia', { algorithm: 'bcrypt', cost: 10 })` → `$2b$10$…` (60 karakter),
   `Bun.password.verify()` mengembalikan nilai benar, dan kodenya **lolos `tsc`**.
   ⚠️ **Wajib menuliskan `algorithm: 'bcrypt'`** — default `Bun.password` adalah **argon2id**.
   Tanpa opsi itu, hash yang tersimpan bukan bcrypt (melanggar spec).
2. Hash disimpan di kolom `password` (`varchar(255)`; hash bcrypt hanya 60 karakter, aman).
3. **Duplikat email: andalkan UNIQUE constraint, JANGAN `SELECT` pendahuluan.**
   Cara ini bebas race condition. Tangkap error PostgreSQL berkode **`23505`** → HTTP 409.
   Pola pengecekannya sudah ada di `src/routes/users.ts` (`isUniqueViolation`) — pindahkan ke service.
4. **Normalisasi email** dengan `email.trim().toLowerCase()` sebelum disimpan, supaya
   `Nickzad@Gmail.com` dan `nickzad@gmail.com` dianggap email yang sama.
   Hasil uji: validasi `format: 'email'` **sudah menolak** email berspasi di awal/akhir (HTTP 422),
   jadi bagian yang benar-benar berperan di sini adalah `toLowerCase()`; `trim()` hanya jaring pengaman.
5. **Password plaintext tidak boleh muncul di response maupun log.**
   Semua query yang mengembalikan data user wajib memakai kolom eksplisit **tanpa** `password`:
   `{ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }`.
6. **Semua akses tabel `users` dipindah ke service.** Route hanya: validasi request → panggil
   service → tentukan status HTTP + bentuk response. File route **tidak boleh** `import { db }`.
7. Prefix route users menjadi **`/api/users`** (sesuai spec). Endpoint lama (GET list, GET detail,
   PUT, DELETE) **ikut pindah prefix** ke `/api/users`; perilakunya tidak diubah selain poin 5.
8. Bentuk response untuk resource users: sukses `{ data: ... }`, error `{ error: ... }`.
9. Error validasi request dibiarkan memakai format bawaan Elysia (HTTP **422**) — di luar scope.
10. `GET /health`, `src/db/index.ts`, `drizzle.config.ts`, dan `docker-compose.yml` tidak diubah.

## 5. Struktur file target

```
src/
├── db
│   ├── index.ts            (tidak diubah)
│   └── schema.ts           (+ kolom password)
├── routes
│   └── users-route.ts      ← hasil rename dari routes/users.ts
├── services
│   └── users-service.ts    ← FILE BARU (logic bisnis + akses database)
└── index.ts                (ubah 1 baris import)
```

Aturan penamaan & layer:

- File route: `<resource>-route.ts` → `users-route.ts`
- File service: `<resource>-service.ts` → `users-service.ts`
- Arah dependensi satu arah: **`routes` → `services` → `db`**.
  Service tidak boleh tahu HTTP (tidak menerima `Context` Elysia, tidak memanggil `status()`).
- `src/routes/users.ts` (file lama) **harus dihapus** setelah digantikan, supaya tidak ada dua
  definisi route untuk resource yang sama.
- Import antar-file **tanpa ekstensi** (konsisten dengan kode existing, mis. `from '../db'`).

## 6. Tahapan implementasi (kerjakan berurutan, jangan lompat)

### Step 0 — Persiapan

```bash
cd ~/nickzad-laptop/belajar/belajar-vibe-coding
git checkout master && git pull          # pastikan PR #5 (PostgreSQL) sudah merged
git checkout -b feat/user-registration
docker compose up -d                     # PostgreSQL untuk development
bun install
cp .env.example .env                     # hanya bila .env belum ada
bun run db:push                          # pastikan tabel users sudah ada
```

Hasil diharapkan: `docker compose ps` menunjukkan service `postgres` berstatus sehat (healthy),
dan `bun run db:push` selesai tanpa error.

### Step 1 — Tambah kolom `password` di schema

File: `src/db/schema.ts`. Tambahkan **satu baris** (letakkan setelah `email`):

```ts
  password: varchar('password', { length: 255 }).notNull(),
```

Jangan ubah kolom lain — `id`, `email` (unique), dan `created_at` sudah sesuai spec.

### Step 2 — Generate dan terapkan migration

```bash
bun run db:generate
```

Hasil: file baru `drizzle/0001_*.sql` yang berisi
`ALTER TABLE "users" ADD COLUMN "password" varchar(255) NOT NULL;`

Terapkan ke database (untuk dev, `db:push` lebih praktis):

```bash
bun run db:push        # dev: langsung sinkronkan schema
# atau
bun run db:migrate     # menjalankan file SQL di folder drizzle/
```

⚠️ **Kolom baru NOT NULL akan GAGAL pada tabel yang sudah berisi data.** Karena ini database
development dan belum ada data penting, kosongkan dulu tabelnya:

```bash
docker exec -it belajar-vibe-coding-postgres psql -U postgres -d app_db -c 'DELETE FROM users;'
```

Verifikasi kolom sudah ada:

```bash
docker exec -it belajar-vibe-coding-postgres psql -U postgres -d app_db -c '\d users'
```

### Step 3 — Buat `src/services/users-service.ts`

Salin kerangka pada Bagian 7.1. Isinya: akses database + hashing bcrypt + error class
`EmailAlreadyRegisteredError`. **Tidak ada kode Elysia** di file ini.

### Step 4 — Buat `src/routes/users-route.ts`

```bash
git mv src/routes/users.ts src/routes/users-route.ts
```

Lalu sesuaikan isinya seperti Bagian 7.2:

- prefix Elysia menjadi `/api/users`,
- semua query DB diganti pemanggilan service (`findUsers`, `findUserById`, `updateUser`, `deleteUser`),
- tambahkan endpoint `POST /` untuk registrasi,
- hapus `import { db }`, `import { users }`, `import { eq }`, dan fungsi `isUniqueViolation`
  dari file route (semuanya sudah pindah ke service).

### Step 5 — Update `src/index.ts`

Ubah 1 baris import:

```ts
import { usersRoutes } from './routes/users-route';
```

### Step 6 — Pastikan file lama benar-benar hilang

```bash
ls src/routes      # harus HANYA berisi users-route.ts
git status         # tidak boleh menampilkan src/routes/users.ts
```

### Step 7 — Update `README.md`

- Tabel endpoint: `POST /api/users` (registrasi) dan endpoint lama dengan prefix `/api/users`.
- Tambahkan contoh `curl` registrasi (lihat Bagian 3.2).
- Struktur folder: tambahkan `services`.
- Catatan: password disimpan sebagai **hash bcrypt** memakai `Bun.password` (tanpa dependency tambahan).

### Step 8 — Verifikasi

Jalankan **seluruh** tabel pengujian di Bagian 9.

### Step 9 — Commit & pull request

```bash
git add -A
git commit -m "feat: registrasi user POST /api/users + struktur routes & services"
git push -u origin feat/user-registration
gh pr create --base master --head feat/user-registration \
  --title "feat: registrasi user (POST /api/users)" --body-file <file-body-pr.md>
```

Body PR wajib memuat: ringkasan perubahan, daftar file yang disentuh, dan **hasil uji Bagian 9**
(cukup tempel output perintahnya).

## 7. Kerangka kode acuan

Boleh disalin, tapi **tetap wajib lolos `bun run typecheck`** setelahnya.

### 7.1 `src/services/users-service.ts` (file baru)

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

/** Kolom yang aman dikirim ke client (tanpa password). */
const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
};

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email sudah terdaftar');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/** PostgreSQL menandai pelanggaran unique constraint dengan kode 23505. */
function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const password = await Bun.password.hash(input.password, {
    algorithm: 'bcrypt',
    cost: 10,
  });

  try {
    await db.insert(users).values({ name: input.name.trim(), email, password });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyRegisteredError();
    }

    throw error;
  }
}

export async function findUsers() {
  return db.select(publicColumns).from(users);
}

export async function findUserById(id: number) {
  const [user] = await db.select(publicColumns).from(users).where(eq(users.id, id));

  return user ?? null;
}

export async function updateUser(id: number, input: { name: string; email: string }) {
  const [updated] = await db
    .update(users)
    .set({ name: input.name.trim(), email: input.email.trim().toLowerCase() })
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}

export async function deleteUser(id: number) {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  return deleted !== undefined;
}
```

Catatan penting:

- `registerUser` **tidak mengembalikan data apa pun** (spec hanya minta `{ data: 'OK' }`).
- Hashing dilakukan **di luar** blok `try` supaya error yang tertangkap benar-benar dari query insert.
- `.returning()` **wajib diberi argumen** (`publicColumns` / `{ id: users.id }`). Tanpa argumen,
  Drizzle mengembalikan seluruh kolom termasuk `password` → hash bisa bocor ke response.
- `23505` ditangani khusus; error lain **wajib di-`throw` ulang** (jangan ditelan).

### 7.2 `src/routes/users-route.ts` (hasil rename + perubahan)

```ts
import { Elysia, t } from 'elysia';
import {
  EmailAlreadyRegisteredError,
  deleteUser,
  findUserById,
  findUsers,
  registerUser,
  updateUser,
} from '../services/users-service';

const registerBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
  // minLength sengaja 1: contoh di spec memakai password "rahasia" (7 karakter).
  // maxLength 72 mengikuti batas bcrypt standar (lihat Bagian 8 no. 6).
  password: t.String({ minLength: 1, maxLength: 72 }),
});

const updateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: 'email', maxLength: 255 }),
});

const userParams = t.Object({
  id: t.Numeric(),
});

export const usersRoutes = new Elysia({ prefix: '/api/users' })
  .post(
    '/',
    async ({ body, status }) => {
      try {
        await registerUser(body);

        return status(201, { data: 'OK' });
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          return status(409, { error: 'Email sudah terdaftar' });
        }

        throw error;
      }
    },
    { body: registerBody },
  )
  .get('/', () => findUsers())
  .get(
    '/:id',
    async ({ params, status }) => {
      const user = await findUserById(params.id);

      if (!user) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return user;
    },
    { params: userParams },
  )
  .put(
    '/:id',
    async ({ params, body, status }) => {
      const updated = await updateUser(params.id, body);

      if (!updated) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return updated;
    },
    { params: userParams, body: updateBody },
  )
  .delete(
    '/:id',
    async ({ params, status }) => {
      const deleted = await deleteUser(params.id);

      if (!deleted) {
        return status(404, { error: 'User tidak ditemukan' });
      }

      return { data: 'OK' };
    },
    { params: userParams },
  );
```

Catatan:

- Path `POST /` pada prefix `/api/users` melayani `POST /api/users`
  (Elysia memperlakukan `/api/users` dan `/api/users/` sama — sudah terbukti pada endpoint lama
  yang tetap melayani `GET /users`).
- `body` di `registerUser(body)` sudah tervalidasi dan memiliki tipe `{ name, email, password }`.
- `updateBody` **tidak** memuat `password` — ubah password bukan bagian dari fitur ini.

### 7.3 `src/index.ts` (hanya 1 baris berubah)

```ts
import { usersRoutes } from './routes/users-route';
```

Nama export (`usersRoutes`) dan pemakaian `.use(usersRoutes)` **tidak berubah**, jadi `GET /health`
dan sisanya tetap sama.

### 7.4 Hasil validasi kode acuan (sudah diuji tanpa database)

Kode pada Bagian 7.1–7.3 sudah dijalankan di sandbox terpisah dengan modul `db` di-mock
(supaya tidak butuh PostgreSQL). Hasilnya:

| Uji | Hasil |
|---|---|
| `bun run typecheck` pada kode acuan | ✅ 0 error |
| Insert sukses → response | ✅ `201` `{"data":"OK"}` |
| Insert melempar kode `23505` → response | ✅ `409` `{"error":"Email sudah terdaftar"}` |
| `name: "  Nickzad  "` yang tersimpan | ✅ `"Nickzad"` (ter-trim) |
| `email: "Nickzad@Gmail.com"` yang tersimpan | ✅ `"nickzad@gmail.com"` (lowercase) |
| Password yang tersimpan | ✅ hash bcrypt berawalan `$2b$`, panjang 60 |
| Server boot & `GET /health` | ✅ HTTP 200 |
| `GET /users` (prefix lama) | ✅ HTTP 404 — route lama sudah tidak ada |

**Yang belum terverifikasi** (butuh PostgreSQL nyata): perilaku constraint `UNIQUE` yang sebenarnya,
bahwa kolom `password` benar-benar `varchar(255) NOT NULL` di database, dan efek migration ke
database asli. Semuanya **wajib** diuji di Step 8 memakai tabel Bagian 9.

Cara menguji jalur 409 tanpa database ada di Bagian 13 (opsional).

## 8. Jebakan yang mudah terjadi di repo ini

| # | Jebakan | Cara menghindar |
|---|---|---|
| 1 | Lupa `algorithm: 'bcrypt'` → hash tersimpan memakai **argon2id** (default Bun) | Selalu tulis `{ algorithm: 'bcrypt', cost: 10 }` |
| 2 | `const [x] = await db…` bertipe `X \| undefined` (tsconfig `noUncheckedIndexedAccess: true`) | Cek `if (!x)` sebelum dipakai — contoh di Bagian 7.1 memakai `?? null` |
| 3 | `.returning()` tanpa argumen → seluruh kolom (termasuk `password`) ikut kembali | Selalu beri argumen (`publicColumns`) |
| 4 | Import tipe memakai `import { … }` biasa padahal `verbatimModuleSyntax: true` | Import tipe pakai `import type { … }` |
| 5 | Menulis ekstensi file di import (`from '../db/index.ts'`) | Ikuti kode existing: **tanpa ekstensi** |
| 6 | Password sangat panjang (> 72 byte) | Bun **tidak** memotong (sudah diuji), tetapi library bcrypt lain memotong → batasi `maxLength: 72` supaya hash tetap portabel |
| 7 | Menelan semua error: `catch { return 409 }` | Hanya tangani `23505` / `EmailAlreadyRegisteredError`; sisanya `throw error` |
| 8 | Menjalankan `bun add bcryptjs` | Tidak perlu — bcrypt sudah tersedia di `Bun.password` |
| 9 | `null value in column "password" violates not-null constraint` saat `db:push`/`db:migrate` | Tabel masih berisi baris lama → `DELETE FROM users;` dulu (lihat Step 2) |
| 10 | Lupa menghapus `src/routes/users.ts` → route `/users` lama masih hidup | Step 4 dan Step 6 wajib dikerjakan |
| 11 | Registrasi mengembalikan objek user lengkap | Spec minta **hanya** `{ data: 'OK' }` |
| 12 | `GET /api/users` ikut mengembalikan `password` | Pakai `select(publicColumns)` dari service |
| 13 | Menambah `minLength: 8` pada password | Contoh di spec (`"rahasia"`) hanya 7 karakter → request contoh akan ditolak `422` |

## 9. Definition of Done (semua wajib dijalankan)

```bash
bun run typecheck        # harap: 0 error
bun run dev              # biarkan terminal ini tetap jalan
```

Di terminal kedua:

| # | Uji | Perintah | Hasil yang benar |
|---|---|---|---|
| 1 | Health tetap jalan | `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/health` | `200` |
| 2 | Registrasi sukses | `curl -i -X POST localhost:3000/api/users -H 'Content-Type: application/json' -d '{"name":"Nickzad","email":"nickzad@gmail.com","password":"rahasia"}'` | `201` + `{"data":"OK"}` |
| 3 | Email duplikat | ulangi perintah #2 | `409` + `{"error":"Email sudah terdaftar"}` |
| 4 | Body tidak valid | `curl -i -X POST localhost:3000/api/users -H 'Content-Type: application/json' -d '{"name":"A","email":"bukan-email","password":"x"}'` | `422` |
| 5 | Password tersimpan sebagai hash bcrypt | `docker exec -it belajar-vibe-coding-postgres psql -U postgres -d app_db -c 'SELECT email, password FROM users;'` | nilai berawalan `$2b$` (bukan teks `rahasia`) |
| 6 | Response tidak membocorkan password | `curl -s localhost:3000/api/users` | tidak ada kata `password` di output |
| 7 | Endpoint lama masih jalan | `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/users/1` | `200`, atau `404` bila id tidak ada |
| 8 | Tidak ada dependency baru | `grep -n bcrypt package.json` | **tidak ada hasil** |
| 9 | Migration ter-generate | `ls drizzle/` | ada file baru yang memuat `ADD COLUMN "password"` |
| 10 | Route tidak menyentuh DB langsung | `grep -rn "import { db }" src/routes` | **tidak ada hasil** |

Checklist akhir:

- [ ] Semua uji di tabel Bagian 9 lulus (tempel outputnya di body PR)
- [ ] `bun run typecheck` 0 error
- [ ] `ls src/routes` hanya berisi `users-route.ts` (file lama sudah dihapus)
- [ ] `src/services/users-service.ts` ada dan **tidak** memuat kode Elysia
- [ ] README diperbarui (endpoint baru + struktur folder `services`)
- [ ] PR ke `master` dibuat, body memuat ringkasan + hasil uji

## 10. Di luar scope (JANGAN dikerjakan)

Login, JWT/session, logout, refresh token, reset atau ubah password, verifikasi email,
rate limiting/lockout, role & permission, soft delete, pagination, test otomatis/framework,
kebijakan kekuatan password (mis. minimum 8 karakter), dan normalisasi unicode email.

Kalau menurut Anda salah satunya perlu, **tanya owner dulu** — jangan menambahkannya sendiri.

## 11. Ringkasan file yang disentuh

| File | Aksi |
|---|---|
| `src/db/schema.ts` | ubah: +1 kolom `password` |
| `drizzle/0001_*.sql` & `drizzle/meta/*` | dibuat otomatis oleh `bun run db:generate` |
| `src/services/users-service.ts` | **file baru** |
| `src/routes/users-route.ts` | rename dari `src/routes/users.ts` + perubahan |
| `src/routes/users.ts` | **dihapus** |
| `src/index.ts` | ubah 1 baris import |
| `README.md` | update endpoint & struktur folder |

## 12. Kalau ada yang gagal atau environment tidak mendukung

Aturan yang dipakai di repo ini (lihat riwayat issue #3):

1. **Jangan mengarang hasil verifikasi.** Kalau PostgreSQL/Docker tidak tersedia, tulis jelas di PR:
   perintah apa yang sudah dijalankan, hasilnya apa, dan langkah mana yang belum bisa diuji.
2. Bagian yang tetap bisa diverifikasi **tanpa database**:
   `bun run typecheck`, server boot, `GET /health`, dan penolakan validasi (`422`) — karena validasi
   Elysia berjalan **sebelum** query ke database.
3. `bun run db:generate` juga bisa dijalankan tanpa koneksi database (hanya membaca schema).
4. Sisa verifikasi diserahkan ke owner, lengkapi langkahnya di body PR.
5. Kalau ragu antara dua pilihan teknis: **berhenti dan tanya owner**, jangan improvisasi
   (misalnya jangan mengganti bcrypt ke argon2id atau menambah dependency).

## 13. Lampiran (opsional) — uji jalur 409 tanpa database

Dipakai bila PostgreSQL/Docker belum tersedia. Script ini **alat bantu sementara — jangan
di-commit**; hapus setelah selesai dipakai.

Simpan sebagai `check-409.ts` di root project, lalu jalankan:

```bash
MOCK_MODE=success   bun check-409.ts   # harap: 201 {"data":"OK"}
MOCK_MODE=duplicate bun check-409.ts   # harap: 409 {"error":"Email sudah terdaftar"}
```

Isi file (`mock` berasal dari `bun:test` bawaan Bun — tidak perlu instalasi apa pun):

```ts
import { mock } from 'bun:test';

const mode = process.env.MOCK_MODE ?? 'duplicate';
const abs = (p: string) => new URL(p, import.meta.url).pathname;

mock.module(abs('./src/db/index.ts'), () => ({
  db: {
    insert: () => ({
      values: (v: { name: string; email: string; password: string }) => {
        console.log('  email tersimpan :', JSON.stringify(v.email));
        console.log('  password bcrypt :', v.password.startsWith('$2b$'));

        if (mode === 'duplicate') {
          const error: Error & { code?: string } = new Error('duplicate key value');
          error.code = '23505';
          throw error;
        }

        return Promise.resolve([]);
      },
    }),
  },
}));

const { usersRoutes } = await import(abs('./src/routes/users-route.ts'));

const res = await usersRoutes.handle(
  new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Nickzad', email: 'Nickzad@Gmail.com', password: 'rahasia' }),
  }),
);

console.log('  mode / status   :', mode, '/', res.status);
console.log('  body            :', await res.text());
```

Script ini **tidak menggantikan** pengujian ke database asli (Bagian 9). Fungsinya hanya
membuktikan logika route + service sudah benar saat database belum tersedia.