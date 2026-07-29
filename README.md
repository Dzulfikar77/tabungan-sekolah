# Tabungan Digital Sekolah

Sistem manajemen tabungan siswa, pembayaran SPP, koperasi sekolah, dan administrasi keuangan untuk TK/MI.

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

## Role & Akses

| Role | Akses |
|------|-------|
| Developer | Full akses, restore database, backup |
| Super Admin | Full akses, approval final penarikan |
| Admin | Kelola siswa, setoran, penarikan, laporan |
| Wali Kelas | Approval tier 1 per kelas |
| Viewer | Read-only, lihat data siswa sendiri |

### Akun Demo

| Username | Password | Akses |
|----------|----------|-------|
| `masdev` | `@mimu123` | Developer (full access) |
| `demo` | `12345` | Demo all access (read-only) |
| `demo-tk` | `demotk123` | Demo TK only (read-only) |
| `demo-mi` | `demomi123` | Demo MI only (read-only) |
| `kepsek` | — | Super Admin |
| `bendahara` | — | Admin |

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
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
# Isi GEMINI_API_KEY jika perlu (opsional)

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

## Struktur Proyek

```
src/
├── components/
│   ├── AuditLogView.tsx      # Log audit
│   ├── BookManagement.tsx    # Koperasi & kegiatan
│   ├── Dashboard.tsx         # Dashboard utama + status SPP
│   ├── DepositForm.tsx       # Setoran tabungan
│   ├── LoginModal.tsx        # Login lama (tidak dipakai)
│   ├── LoginPage.tsx         # Halaman login utama
│   ├── Navbar.tsx            # Navigasi + role badge
│   ├── Reports.tsx           # Laporan PDF/Excel
│   ├── SettingsModal.tsx     # Pengaturan sekolah & SPP
│   ├── SppPayment.tsx        # Pembayaran SPP
│   ├── StudentManagement.tsx # Manajemen siswa
│   ├── ViewerPage.tsx        # Viewer (read-only)
│   └── WithdrawalForm.tsx    # Penarikan + approval
├── context/
│   └── AppContext.tsx        # State management global
├── utils/
│   ├── format.ts             # Format rupiah, tanggal, filter akses
│   ├── initialData.ts        # Data awal & demo
│   └── pdfGenerator.ts       # Generator PDF laporan
├── types.ts                  # Definisi tipe data
├── App.tsx                   # Root komponen + routing
└── main.tsx                  # Entry point
```

## Fitur Detail

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
