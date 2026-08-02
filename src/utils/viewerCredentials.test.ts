/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assert-based self-test for viewerCredentials util.
 * Jalankan: npx tsx src/utils/viewerCredentials.test.ts
 * Exit 0 = semua lulus, 1 = ada gagal.
 */

import { generateViewerUsername, generateViewerPassword, normalizeName, resolveViewerLogin } from './viewerCredentials';
import type { AcademicYear, Student, User } from '../types';

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

console.log('normalizeName:');
assert(normalizeName("Aura Kasih") === 'aurakasih', 'spasi dibuang');
assert(normalizeName("A'isyah") === 'aisyah', 'apostrof dibuang');
assert(normalizeName("Aura  Kasih-2") === 'aurakasih2', 'spasi ganda + tanda hubung dibuang');
assert(normalizeName("  José  ") === 'jos', 'aksen di-strip');

console.log('generateViewerUsername:');
assert(generateViewerUsername('Ahmad Fauzi', []) === 'ahmadfauzi', 'normalisasi: Ahmad Fauzi -> ahmadfauzi');
assert(generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi']) === 'ahmadfauzi-2', 'collision 1 -> -2');
assert(
  generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi', 'ahmadfauzi-2']) === 'ahmadfauzi-3',
  'collision 2 -> -3'
);
assert(generateViewerUsername('  Budi   Santoso ', []) === 'budisantoso', 'collapse multi-space');
assert(generateViewerUsername('Citra', ['CITRA']) === 'citra-2', 'case-insensitive taken');
assert(generateViewerUsername("A'isyah", []) === 'aisyah', 'apostrof di nama -> dibuang');

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

console.log('resolveViewerLogin (4 Aura Kasih):');
const mkStudent = (id: string, name: string, cls: string): Student =>
  ({ id, nis: id, name, classGrade: cls as any, status: 'Aktif', academicYearId: 'ay', balance: 0, createdAt: '' });
const mkViewer = (id: string, username: string, studentId: string, password: string): User =>
  ({ id, username, name: 'x', role: 'Viewer', studentId, password });

const auras: Student[] = [
  mkStudent('st-a1', 'Aura Kasih', 'TK B'),
  mkStudent('st-a2', 'Aura Kasih', 'Kelas 4A'),
  mkStudent('st-a3', 'Aura Kasih', 'Kelas 5B'),
  mkStudent('st-a4', 'Aura Kasih', 'Kelas 6A'),
];
const auraUsers: User[] = [
  mkViewer('u-a1', 'aurakasih', 'st-a1', '20252026001'),
  mkViewer('u-a2', 'aurakasih-2', 'st-a2', '20252026002'),
  mkViewer('u-a3', 'aurakasih-3', 'st-a3', '20252026003'),
  mkViewer('u-a4', 'aurakasih-4', 'st-a4', '20252026004'),
];

const login = (u: string, p: string) => resolveViewerLogin(auraUsers, auras, u, p);
const userId = (r: ReturnType<typeof login>) => ('user' in r ? r.user.id : `ERR:${r.error}`);

assert(userId(login('Aura Kasih', '20252026001')) === 'u-a1', 'nama polos + pw1 -> Aura#1 (TK B)');
assert(userId(login('aura kasih', '20252026002')) === 'u-a2', 'huruf kecil + pw2 -> Aura#2 (4A)');
assert(userId(login('  AURA KASIH  ', '20252026003')) === 'u-a3', 'caps+spasi + pw3 -> Aura#3 (5B)');
assert(userId(login('aurakasih', '20252026004')) === 'u-a4', 'username dasar + pw4 -> Aura#4 (6A)');
assert(userId(login('aurakasih-3', '20252026003')) === 'u-a3', 'slip lama suffix + pw3 -> Aura#3');
assert(userId(login('Aura Kasih', 'password_salah')) === 'ERR:Username atau password salah.', 'password salah -> error');
assert(userId(login('Orang Tak Ada', '20252026001')) === 'ERR:Username atau password salah.', 'nama tak ada -> error');

const renamed = auras.map((s) => (s.id === 'st-a2' ? { ...s, name: 'Aura Kasih Putri' } : s));
const renamedLogin = resolveViewerLogin(auraUsers, renamed, 'Aura Kasih Putri', '20252026002');
assert('user' in renamedLogin && renamedLogin.user.id === 'u-a2', 'rename siswa -> nama baru tetap ketemu');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);