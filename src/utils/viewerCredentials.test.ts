/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assert-based self-test for viewerCredentials util.
 * Jalankan: npx tsx src/utils/viewerCredentials.test.ts
 * Exit 0 = semua lulus, 1 = ada gagal.
 */

import { generateViewerUsername, generateViewerPassword, normalizeName, resolveViewerLogin, searchViewerSuggestions, verifyParentIdentity } from './viewerCredentials';
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

console.log('searchViewerSuggestions:');
const suggestStudents: Student[] = [
  ...auras,
  mkStudent('st-p1', 'Aura Putri', 'Kelas 1A'),
  mkStudent('st-an', 'Anak Aura', 'Kelas 2B'),
  mkStudent('st-si', 'Siti Aura', 'Kelas 6A'),
  mkStudent('st-dead', 'Aura Kasih', 'Kelas 6B'),
];
const suggestUsers: User[] = [
  ...auraUsers,
  mkViewer('u-p1', 'auraputri', 'st-p1', '20252026010'),
  mkViewer('u-an', 'anakaura', 'st-an', '20252026011'),
  mkViewer('u-si', 'sitaura', 'st-si', '20252026012'),
];
const alive = suggestStudents.filter((s) => s.id !== 'st-dead');
const sAll = searchViewerSuggestions(suggestUsers, alive, 'aura', 20).map((s) => s.name);
assert(sAll.length === 7, `'aura' -> 7 hasil (dapat ${sAll.length})`);
assert(sAll[0].startsWith('Aura Kasih'), `prefix match dulu (${sAll.join(', ')})`);
assert(sAll.includes('Aura Putri') && sAll.includes('Anak Aura') && sAll.includes('Siti Aura'), 'semua nama mengandung aura muncul');
assert(searchViewerSuggestions(suggestUsers, alive, 'aurap', 20).every((s) => s.name === 'Aura Putri'), "'aurap' -> hanya Aura Putri");
assert(searchViewerSuggestions(suggestUsers, alive, 'aurapu', 20).every((s) => s.name === 'Aura Putri'), "'aurapu' -> hanya Aura Putri");
assert(searchViewerSuggestions(suggestUsers, alive, 'AURA KASIH', 20).length === 4, "'AURA KASIH' -> 4 Aura Kasih (case/spasi diabaikan)");
assert(searchViewerSuggestions(suggestUsers, alive, 'a', 20).length === 0, 'min 2 huruf -> kosong');
assert(searchViewerSuggestions(suggestUsers, alive, 'aura', 3).length === 3, 'cap limit 3');
assert(searchViewerSuggestions(suggestUsers, suggestStudents, 'aura', 20).every((s) => s.name !== 'Aura Kasih' || s.studentId !== 'st-dead'), 'siswa terhapus tidak muncul');
assert(searchViewerSuggestions(suggestUsers.slice(0, 4), alive, 'aura', 20).every((s) => s.studentId !== 'st-p1'), 'siswa tanpa viewer user tidak muncul');

const renamedSug = alive.map((s) => (s.id === 'st-p1' ? { ...s, name: 'Aura Putri Maharani' } : s));
assert(
  searchViewerSuggestions(suggestUsers, renamedSug, 'auraputrimaharani', 20).some((s) => s.studentId === 'st-p1'),
  'saran ikut rename siswa (nama live)'
);

console.log('verifyParentIdentity:');
const ortuSt = { parentName: 'Rahmat Hidayat', phone: '08123456789' };
assert(verifyParentIdentity(ortuSt as any, 'rahmat hidayat', '0812-3456-789') === true, 'case/space + phone formatting cocok');
assert(verifyParentIdentity(ortuSt as any, 'Rahmat Hidayat', '089999') === false, 'no. HP salah -> false');
assert(verifyParentIdentity(ortuSt as any, 'Budi Santoso', '08123456789') === false, 'nama ortu salah -> false');
assert(verifyParentIdentity(ortuSt as any, 'Rahmat Hidayat', '') === false, 'HP kosong -> false');
assert(verifyParentIdentity({ ...ortuSt, phone: undefined } as any, 'Rahmat Hidayat', '08123456789') === false, 'HP siswa kosong -> false');
assert(verifyParentIdentity(undefined, 'Rahmat Hidayat', '08123456789') === false, 'student undefined -> false');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);