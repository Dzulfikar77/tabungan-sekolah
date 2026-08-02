/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assert-based self-test for viewerCredentials util.
 * Jalankan: npx tsx src/utils/viewerCredentials.test.ts
 * Exit 0 = semua lulus, 1 = ada gagal.
 */

import { generateViewerUsername, generateViewerPassword } from './viewerCredentials';
import type { AcademicYear } from '../types';

let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok  - ${label}`);
  } else {
    console.error(`  FAIL- ${label}`);
    failed++;
  }
}

const ay2627: AcademicYear = { id: 'ay-t1', year: '2026/2027', isCurrent: true, createdAt: '' };
const ay2728: AcademicYear = { id: 'ay-t2', year: '2027/2028', isCurrent: false, createdAt: '' };

console.log('generateViewerUsername:');
assert(generateViewerUsername('Ahmad Fauzi', []) === 'ahmadfauzi', 'normalisasi: Ahmad Fauzi -> ahmadfauzi');
assert(generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi']) === 'ahmadfauzi-2', 'collision 1 -> -2');
assert(
  generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi', 'ahmadfauzi-2']) === 'ahmadfauzi-3',
  'collision 2 -> -3'
);
assert(generateViewerUsername('  Budi   Santoso ', []) === 'budisantoso', 'collapse multi-space');
assert(generateViewerUsername('Citra', ['CITRA']) === 'citra-2', 'case-insensitive taken');

console.log('generateViewerPassword:');
assert(generateViewerPassword(ay2627, []) === '20262027001', 'kosong -> 001');
assert(
  generateViewerPassword(ay2627, ['20262027005', '20262027012']) === '20262027013',
  'max 012 -> 013'
);
assert(
  generateViewerPassword(ay2728, ['20262027001']) === '20272028001',
  'prefix beda tahun tak campur'
);
assert(
  generateViewerPassword(ay2627, ['202620271000']) === '202620271001',
  'seq>999 grow 4 digit'
);
assert(
  generateViewerPassword(ay2627, ['baru456', '20262027003']) === '20262027004',
  'password diganti diabaikan, max scheme 003 -> 004'
);
assert(
  generateViewerPassword(ay2627, ['20262027003', '20262027003']) === '20262027004',
  'duplikat scheme tidak double-count'
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);
