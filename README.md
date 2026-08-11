# Tabungan Digital Sekolah

Sistem manajemen tabungan siswa, pembayaran buku, dan administrasi keuangan sekolah berbasis web.

## Fitur Utama

- **Dashboard** — Ringkasan statistik tabungan siswa secara real-time
- **Manajemen Siswa** — CRUD data siswa dengan status aktif/lulus/pindah/keluar
- **Setoran Tabungan** — Form setoran dengan nomor transaksi otomatis (ST/YYYY/NNNNN)
- **Penarikan Tabungan** — Form penarikan dengan alasan dan persetujuan (PT/YYYY/NNNNN)
- **Koperasi & Buku** — Manajemen inventaris buku dan alat tulis
- **Pembayaran** — Pembayaran koperasi/kegiatan dengan metode tunai atau potong tabungan
- **Kegiatan Sekolah** — Pengelolaan kegiatan (study tour, lomba, ekstrakurikuler) dengan pendaftaran siswa
- **Laporan** — Export laporan keuangan dalam format PDF dan Excel
- **Log Audit** — Jejak aktivitas lengkap untuk setiap perubahan data
- **Pengaturan** — Konfigurasi nama sekolah, alamat, potongan bulanan, dan lainnya

## Role & Akses

| Role | Akses |
|------|-------|
| Developer | Akses penuh ke semua fitur + pengaturan sistem |
| Super Admin | Akses penuh ke semua fitur |
| Admin | Kelola siswa, setoran, penarikan, laporan |
| Viewer | Hanya melihat data (read-only) |

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
- **AI Integration:** Google Gemini AI (`@google/genai`)
- **PDF Export:** jsPDF + jspdf-autotable
- **Excel Export:** xlsx (SheetJS)
- **Icons:** Lucide React
- **Animations:** Motion (Framer Motion)

## Persiapan

### Prerequisites

- Node.js 18+ atau Bun
- npm / bun

### Instalasi

```bash
# Clone repository
git clone https://github.com/your-username/tabungan-sekolah.git
cd tabungan-sekolah

# Install dependencies
npm install
# atau
bun install
```

### Konfigurasi

```bash
cp .env.example .env
```

Edit `.env` dan isi nilai berikut:

| Variabel | Deskripsi |
|----------|-----------|
| `GEMINI_API_KEY` | API key untuk Gemini AI (opsional, untuk fitur AI) |
| `APP_URL` | URL deployment aplikasi |

### Development

```bash
npm run dev
# atau
bun dev
```

Aplikasi akan berjalan di `http://localhost:3000`.

### Build & Deploy

```bash
# Build untuk production
npm run build

# Preview build
npm run preview

# Type checking
npm run lint
```

## Struktur Proyek

```
tabungan-sekolah/
├── src/
│   ├── components/
│   │   ├── AuditLogView.tsx      # Log audit aktivitas
│   │   ├── BookManagement.tsx    # Manajemen koperasi/buku
│   │   ├── Dashboard.tsx         # Dashboard utama
│   │   ├── DepositForm.tsx       # Form setoran tabungan
│   │   ├── LoginModal.tsx        # Modal login
│   │   ├── Navbar.tsx            # Navigasi utama
│   │   ├── Reports.tsx           # Laporan keuangan
│   │   ├── SettingsModal.tsx     # Pengaturan sekolah
│   │   ├── StudentManagement.tsx # Manajemen data siswa
│   │   ├── ViewerPage.tsx        # Halaman viewer (read-only)
│   │   └── WithdrawalForm.tsx    # Form penarikan tabungan
│   ├── context/
│   │   └── AppContext.tsx        # State management global
│   ├── utils/
│   │   └── format.ts            # Utilitas format rupiah & tanggal
│   ├── types.ts                  # Definisi tipe data
│   ├── App.tsx                   # Root komponen
│   └── main.tsx                  # Entry point
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tipe Data Utama

- **Student** — Data siswa (NIS, nama, kelas, status, saldo)
- **Transaction** — Transaksi tabungan (setoran/penarikan/potongan bulanan)
- **Payment** — Pembayaran koperasi/kegiatan
- **CooperativeItem** — Item koperasi (buku, alat tulis, seragam)
- **SchoolActivity** — Kegiatan sekolah
- **AcademicYear** — Tahun ajaran
- **AuditLogItem** — Jejak audit

## Lisensi

Apache-2.0 License

---

*Sistem Aplikasi Tabungan Digital Sekolah*
