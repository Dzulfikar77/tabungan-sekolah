# Sistem Informasi Sekolah

Sistem manajemen tabungan siswa, pembayaran SPP, koperasi sekolah, administrasi keuangan, dan portal orang tua untuk TK/MI.
Database cloud via Supabase.

## Fitur Utama

- **Dashboard** — Ringkasan keuangan, statistik tabungan TK & MI, status pembayaran SPP, daftar siswa belum bayar
- **Manajemen Siswa** — CRUD siswa, import Excel, filter per kelas, status aktif/lulus/pindah/keluar
- **Pembayaran SPP** — Pisah jenjang TK (A & B) dan MI (Kelas 1-6), tarif berbeda, bayar tunai/potong tabungan, gratis jika tarif 0
- **Setoran Tabungan** — Input setoran dengan nominal preset, filter kelas via tombol cepat
- **Penarikan / Approval** — Pengajuan penarikan dengan approval 2-tier (Admin → Super Admin)
- **Koperasi & Kegiatan** — Manajemen item koperasi (buku, seragam, alat tulis) dan kegiatan sekolah
- **Laporan** — Export PDF & Excel, riwayat transaksi
- **Audit Log** — Jejak aktivitas lengkap untuk setiap perubahan data
- **Potongan Bulanan Otomatis** — Potong saldo siswa setiap tanggal 28, akumulasi tunggakan
- **Backup & Restore** — Backup database JSON, restore khusus Developer
- **Portal Orang Tua** — Login khusus orang tua, lihat saldo, riwayat transaksi, SPP, tunggakan, cetak bukti PDF

## Role & Akses

| Role | Akses |
|------|-------|
| Developer | Full akses, restore database, backup |
| Super Admin | Full akses, approval final penarikan |
| Admin | Kelola siswa, setoran, penarikan, laporan |
| Wali Kelas | Approval tier 1 per kelas |
| Viewer (Orang Tua) | Read-only, lihat data anak sendiri |

## Akun Demo

### Admin
| Username | Password | Role |
|----------|----------|------|
| `masdev` | `@mimu123` | Developer (full access) |
| `demo` | `12345` | Demo all access (read-only) |
| `demo-tk` | `demotk123` | Demo TK only (read-only) |
| `demo-mi` | `demomi123` | Demo MI only (read-only) |
| `kepsek` | — | Super Admin |
| `bendahara` | — | Admin |
| `walikelas1a` | — | Wali Kelas 1A |
| `walikelas2a` | — | Wali Kelas 2A |

### Viewer (Portal Orang Tua)
Login lewat tombol "Login sebagai Orang Tua / Siswa" di halaman login.

| Username | Password | Untuk |
|----------|----------|-------|
| `ortu1` | `ortu2345` | Orang Tua Ahmad Fauzi (TK A) |

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL) + localStorage fallback
- **Auth:** Custom auth (username + password via users table)
- **AI Integration:** Google Gemini AI (`@google/genai`)
- **PDF Export:** jsPDF + jspdf-autotable
- **Excel Export:** xlsx (SheetJS)
- **Icons:** Lucide React
- **Animations:** Motion

## Instalasi & Menjalankan

```bash
# Clone & install
git clone https://github.com/Dzulfikar77/tabungan-sekolah.git
cd tabungan-sekolah
npm install

# Copy env
cp .env.example .env
# Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
# GEMINI_API_KEY opsional

# Development server
npm run dev
# Buka http://localhost:3000

# Build production
npm run build

# Preview build
npm run preview

# Type check
npm run lint
```

### Setup Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. Copy `.env.example` ke `.env` dan isi credentials
3. Jalankan `supabase/migrations/001_initial_schema.sql` di SQL Editor
4. Jalankan `supabase/migrations/002_rls_policies.sql` di SQL Editor
5. Seed data: `npx tsx scripts/seed.ts`
6. Siap digunakan

## Struktur Proyek

```
src/
├── components/
│   ├── AuditLogView.tsx       # Log audit
│   ├── BookManagement.tsx     # Koperasi & kegiatan
│   ├── Dashboard.tsx          # Dashboard utama + status SPP
│   ├── DepositForm.tsx        # Setoran tabungan
│   ├── LoginModal.tsx         # Login lama (tidak dipakai)
│   ├── LoginPage.tsx          # Halaman login admin
│   ├── Navbar.tsx             # Navigasi + role badge
│   ├── Reports.tsx            # Laporan PDF/Excel
│   ├── SettingsModal.tsx      # Pengaturan sekolah & SPP
│   ├── SppPayment.tsx         # Pembayaran SPP
│   ├── StudentManagement.tsx  # Manajemen siswa
│   ├── ViewerLoginPage.tsx    # Login portal orang tua
│   ├── ViewerPage.tsx         # Dashboard portal orang tua
│   └── WithdrawalForm.tsx     # Penarikan + approval
├── context/
│   └── AppContext.tsx         # State management + Supabase sync
├── lib/
│   ├── supabase.ts            # Supabase client
│   └── db.ts                  # DB helpers (camelCase ↔ snake_case)
├── utils/
│   ├── format.ts              # Format rupiah, tanggal, filter akses
│   ├── initialData.ts         # Data awal & demo
│   └── pdfGenerator.ts        # Generator PDF laporan
├── types.ts                   # Definisi tipe data
├── App.tsx                    # Root komponen + routing
└── main.tsx                   # Entry point
supabase/
└── migrations/
    ├── 001_initial_schema.sql # 10 tabel + index + FK
    └── 002_rls_policies.sql   # RLS policies (development)
scripts/
├── seed.ts                    # Seed data ke Supabase
└── one-click-setup.ts         # Setup otomatis (butuh service_role key)
```

## Arsitektur Data

```
localStorage ← inisialisasi awal (fallback offline)
     ↓
Supabase  → fetch on mount → override state (sync from cloud)
     ↓
Mutation  → update state + localStorage + sync ke Supabase (fire-and-forget)
```

- App tetap berfungsi penuh tanpa Supabase (localStorage mode)
- Semua perubahan otomatis sync ke Supabase di background
- Data dari Supabase akan override localStorage saat fetch on mount
- Cocok untuk penggunaan offline/koneksi tidak stabil

## Fitur Detail

### Portal Orang Tua
- Login via tombol "Login sebagai Orang Tua / Siswa" di halaman utama
- Username + password (dikelola admin)
- Lihat **saldo tabungan**, **riwayat transaksi**, **status penyerahan buku**
- Lihat **riwayat SPP** dan **tunggakan SPP** (untuk TK)
- **Tunggakan potongan bulanan** ditampilkan dengan nominal
- **Ubah password** sendiri
- **Cetak bukti tabungan** (PDF)

### Lupa Password

#### Portal Orang Tua / Siswa
1. Klik "Lupa Password?" di halaman login portal orang tua.
2. Ketik nama anak, pilih dari daftar saran.
3. Isi Nama Orang Tua dan No. Telepon sesuai data pendaftaran.
4. Set password baru (minimal 4 karakter).
5. Batas 5 percobaan gagal — setelahnya hubungi sekolah.

#### Admin / Staff
- **Recovery Key:** admin dapat reset password sendiri via "Lupa Password?" di halaman login admin. Masukkan username + recovery key (dari variabel `VITE_ADMIN_RECOVERY_KEY` di `.env`) + password baru. Bila key belum dikonfigurasi, tampil pesan hubungi atasan sesuai hierarki.
- **Hierarki reset:** Super Admin dapat reset password Admin/Wali Kelas/Viewer; Developer dapat reset semua kecuali Developer lain. Buka Pengaturan > Manajemen User > tombol "Reset Password".
- **Developer lockout:** jalankan `npx tsx scripts/reset-password.ts <username> <newPassword>` (butuh `SUPABASE_SERVICE_ROLE_KEY` di `.env`).
- **SQL fallback (jaring terakhir):** di Supabase SQL Editor: `UPDATE users SET password = 'password_baru' WHERE username = 'username';`

### Pembayaran SPP
- Pemisahan jenjang **TK** (TK A, TK B) dan **MI** (Kelas 1-6) dengan tarif berbeda
- Default MI gratis (Rp 0), bisa diisi kapan saja di Pengaturan
- Bayar via **Tunai** atau **Potong Tabungan**
- Status Lunas otomatis jika sudah bayar periode tersebut
- Dashboard menampilkan siswa yang belum bayar per jenjang & kelas

### Potongan Bulanan
- Eksekusi setiap tanggal 28
- Nominal potongan bisa di-custom (default Rp 2.000)
- Jika saldo tidak cukup → akumulasi tunggakan
- Tunggakan otomatis terpotong saat saldo terisi

### Pembatasan Akses
- User dengan `accessLevel: 'TK'` hanya lihat data TK
- User dengan `accessLevel: 'MI'` hanya lihat data MI
- Admin/Super Admin tanpa accessLevel lihat semua

## Lisensi

Apache-2.0 License
