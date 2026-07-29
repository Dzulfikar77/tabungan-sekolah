/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, User, ClassGrade } from '../types';

const TK_CLASSES: ClassGrade[] = ['TK A', 'TK B'];
const MI_CLASSES: ClassGrade[] = [
  'Kelas 1A', 'Kelas 1 B', 'Kelas 2A', 'Kelas 2B',
  'Kelas 3A', 'Kelas 3B', 'Kelas 4A', 'Kelas 4B',
  'Kelas 5A', 'Kelas 5B', 'Kelas 6A', 'Kelas 6B',
];

export function isTKClass(classGrade: ClassGrade): boolean {
  return TK_CLASSES.includes(classGrade);
}

export function isMIClass(classGrade: ClassGrade): boolean {
  return MI_CLASSES.includes(classGrade);
}

export function filterByAccessLevel(students: Student[], user: User | null): Student[] {
  if (!user || !user.accessLevel) return students;
  if (user.accessLevel === 'TK') return students.filter((s) => TK_CLASSES.includes(s.classGrade));
  if (user.accessLevel === 'MI') return students.filter((s) => MI_CLASSES.includes(s.classGrade));
  return students;
}

// Format currency to Indonesian Rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format numbers with thousand separators while typing
export function formatNumberInput(value: string): string {
  // Remove non-digit characters
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(clean, 10));
}

// Parse formatted number input string back to integer number
export function parseFormattedNumber(value: string): number {
  const clean = value.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

// Format date to Indonesian localized standard format
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatDateShort(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// Generate transaction number
export function generateTransactionNumber(prefix: 'ST' | 'PT' | 'BK', year: string, count: number): string {
  const currentYear = year.split('/')[0] || new Date().getFullYear().toString();
  const sequence = (count + 1).toString().padStart(5, '0');
  return `${prefix}/${currentYear}/${sequence}`;
}
