/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
