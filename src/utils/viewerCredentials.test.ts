/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assert-based self-test for viewerCredentials util.
 * Jalankan: npx tsx src/utils/viewerCredentials.test.ts
 * Exit 0 = semua lulus, 1 = ada gagal.
 */

import { normalizeName } from './viewerCredentials';

let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok  - ${label}`);
  } else {
    console.error(`  FAIL- ${label}`);
    failed++;
  }
}

console.log('normalizeName:');
assert(normalizeName("Aura Kasih") === 'aurakasih', 'spasi dibuang');
assert(normalizeName("A'isyah") === 'aisyah', 'apostrof dibuang');
assert(normalizeName("Aura  Kasih-2") === 'aurakasih2', 'spasi ganda + tanda hubung dibuang');
assert(normalizeName("  José  ") === 'jos', 'aksen di-strip');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);
