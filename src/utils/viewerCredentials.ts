/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared helpers for viewer (parent/student portal) identity.
 *
 * Viewer accounts are identified by NIS (unique per student), not by name —
 * name search/disambiguation and identity verification for password recovery
 * happen server-side in supabase/functions/viewer-auth, which never exposes
 * NIS or parent contact info to an unauthenticated client. This file only
 * keeps the pieces still used client-side.
 */

import type { ClassGrade } from '../types';

/**
 * Normalisasi nama: lowercase + buang SEMUA non-alphanumeric.
 * "Aura Kasih" -> "aurakasih" | "A'isyah" -> "aisyah"
 * Satu sumber kebenaran dengan normalizeName() di supabase/functions
 * (dua runtime berbeda, implementasi harus tetap identik agar email/username
 * selalu cocok).
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Baris saran dari aksi `suggest` di supabase/functions/viewer-auth.
 * Sengaja tidak membawa parentName/NIS utuh — hanya nisTail (3 digit
 * terakhir) sebagai pembeda visual saat nama+kelas identik.
 */
export interface ViewerSuggestion {
  username: string;
  name: string;
  classGrade: ClassGrade;
  nisTail: string;
}
