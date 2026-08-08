/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassGrade } from '../types';

export type PromotionVia = 'naik' | 'tinggal';

export interface YearEndDecision {
  studentId: string;
  action: 'naik' | 'tinggal';
}

export interface YearEndSettlement {
  cashToParent: number;
  debtPaid: number;
  debtRemaining: number;
}

/**
 * Settlement utang potongan bulanan saat penutupan tahun.
 * Utang dibersihkan dari saldo lebih dulu; saldo tidak pernah minus;
 * sisa utang tetap menempel di record siswa.
 */
export function settleYearEndDebt(balance: number, pendingDebt: number | undefined): YearEndSettlement {
  const debt = pendingDebt || 0;
  const debtPaid = Math.min(balance, debt);
  return {
    cashToParent: balance - debtPaid,
    debtPaid,
    debtRemaining: debt - debtPaid,
  };
}

const NEXT_CLASS: Partial<Record<ClassGrade, ClassGrade>> = {
  'TK A.1': 'TK B.1',
  'TK A.2': 'TK B.2',
  'Kelas 1A': 'Kelas 2A',
  'Kelas 1 B': 'Kelas 2B',
  'Kelas 2A': 'Kelas 3A',
  'Kelas 2B': 'Kelas 3B',
  'Kelas 3A': 'Kelas 4A',
  'Kelas 3B': 'Kelas 4B',
  'Kelas 4A': 'Kelas 5A',
  'Kelas 4B': 'Kelas 5B',
  'Kelas 5A': 'Kelas 6A',
  'Kelas 5B': 'Kelas 6B',
};

/** Kelas penerus saat naik kelas; null = kelas lulus (TK B / Kelas 6). */
export function nextClassFrom(from: ClassGrade): ClassGrade | null {
  return NEXT_CLASS[from] ?? null;
}

export function isGraduatingClass(from: ClassGrade): boolean {
  return nextClassFrom(from) === null;
}