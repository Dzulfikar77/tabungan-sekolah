/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generator username + password viewer untuk portal orang tua/siswa.
 *
 * Username: lowercase + strip spasi ("Ahmad Fauzi" -> "ahmadfauzi").
 *          Tabrakan -> suffix -2, -3, dst. Username immutable setelah dibuat.
 * Password: {startYear}{endYear}{seq:3} dari AcademicYear.year "2026/2027"
 *          -> "20262027" + "001" = "20262027001". Seq global per tahun ajaran,
 *          diambil dari max 3-digit akhir di antara password Viewer ber-prefix tsb.
 *          seq > 999 tumbuh jadi 4 digit, tetap unik (padStart minimum 3).
 */

import type { AcademicYear, User } from '../types';

/**
 * Normalisasi nama -> username dasar. Lowercase + hapus spasi.
 */
function normalizeBaseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Buat username viewer unik dari nama siswa.
 * @param studentName nama lengkap siswa
 * @param existingUsernames daftar username yang sudah dipakai (case-insensitive)
 */
export function generateViewerUsername(
  studentName: string,
  existingUsernames: string[]
): string {
  const base = normalizeBaseName(studentName);
  const taken = new Set(existingUsernames.map((u) => u.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (taken.has(candidate.toLowerCase())) {
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/**
 * Buat password viewer ber-format {startYear}{endYear}{seq:3}.
 * Seq = max 3-digit akhir pada password Viewer eksisting ber-prefix tahun sama, +1.
 * Default 1 bila belum ada. seq > 999 tumbuh 4 digit (tetap unik: padStart minimum 3).
 *
 * Catatan: hanya password yang MASIH cocok prefix-tahun-ini yang dipindai.
 * Password yang sudah diganti viewer (tidak cocok format) diabaikan, jadi
 * angka seq yang "ditinggalkan" bisa terpakai ulang - tidak tabrakan
 * karena password lama tidak lagi memakai angka itu.
 *
 * @param academicYear tahun ajaran aktif untuk siswa ini
 * @param existingViewerPasswords daftar password User role=Viewer (semua tahun)
 */
export function generateViewerPassword(
  academicYear: AcademicYear,
  existingViewerPasswords: string[]
): string {
  const parts = academicYear.year.split('/');
  const fallback = new Date().getFullYear();
  const start = (parts[0] || String(fallback)).trim();
  const end = (parts[1] || String(fallback + 1)).trim();
  const prefix = `${start}${end}`;

  const re = new RegExp(`^${prefix}(\\d{3,})$`);
  let maxSeq = 0;
  for (const pw of existingViewerPasswords) {
    if (!pw) continue;
    const m = re.exec(pw);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

// ponytail: no persisted counter — seq derived from existing scheme passwords.
// Freed numbers reused after account close; acceptable per user requirement.
// Add a persistent counter on AcademicYear if monotonic-no-reuse ever needed.
