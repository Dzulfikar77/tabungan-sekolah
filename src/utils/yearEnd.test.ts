/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { strictEqual, deepStrictEqual, ok } from 'node:assert';
import {
  settleYearEndDebt,
  nextClassFrom,
  isGraduatingClass,
} from './yearEnd';

console.log('settleYearEndDebt:');
deepStrictEqual(settleYearEndDebt(50000, undefined), { cashToParent: 50000, debtPaid: 0, debtRemaining: 0 }, 'tanpa utang -> semua ke wali');
deepStrictEqual(settleYearEndDebt(50000, 15000), { cashToParent: 35000, debtPaid: 15000, debtRemaining: 0 }, 'utang lunas, sisa ke wali');
deepStrictEqual(settleYearEndDebt(50000, 80000), { cashToParent: 0, debtPaid: 50000, debtRemaining: 30000 }, 'saldo tidak cukup -> utang sisa menempel');
deepStrictEqual(settleYearEndDebt(0, 15000), { cashToParent: 0, debtPaid: 0, debtRemaining: 15000 }, 'saldo 0 + utang -> utang utuh');
deepStrictEqual(settleYearEndDebt(50000, 50000), { cashToParent: 0, debtPaid: 50000, debtRemaining: 0 }, 'saldo = utang -> lunas, wali 0');
deepStrictEqual(settleYearEndDebt(0, 0), { cashToParent: 0, debtPaid: 0, debtRemaining: 0 }, '0/0 -> semua 0');
deepStrictEqual(settleYearEndDebt(0, undefined), { cashToParent: 0, debtPaid: 0, debtRemaining: 0 }, '0/undefined -> semua 0');

console.log('nextClassFrom:');
strictEqual(nextClassFrom('TK A.1'), 'TK B.1', 'TK A.1 -> TK B.1');
strictEqual(nextClassFrom('TK A.2'), 'TK B.2', 'TK A.2 -> TK B.2');
strictEqual(nextClassFrom('Kelas 1A'), 'Kelas 2A', '1A -> 2A');
strictEqual(nextClassFrom('Kelas 1 B'), 'Kelas 2B', '1B -> 2B');
strictEqual(nextClassFrom('Kelas 2A'), 'Kelas 3A', '2A -> 3A');
strictEqual(nextClassFrom('Kelas 2B'), 'Kelas 3B', '2B -> 3B');
strictEqual(nextClassFrom('Kelas 3A'), 'Kelas 4A', '3A -> 4A');
strictEqual(nextClassFrom('Kelas 3B'), 'Kelas 4B', '3B -> 4B');
strictEqual(nextClassFrom('Kelas 4A'), 'Kelas 5A', '4A -> 5A');
strictEqual(nextClassFrom('Kelas 4B'), 'Kelas 5B', '4B -> 5B');
strictEqual(nextClassFrom('Kelas 5A'), 'Kelas 6A', '5A -> 6A');
strictEqual(nextClassFrom('Kelas 5B'), 'Kelas 6B', '5B -> 6B');
strictEqual(nextClassFrom('TK B.1'), null, 'TK B.1 lulus -> null');
strictEqual(nextClassFrom('TK B.2'), null, 'TK B.2 lulus -> null');
strictEqual(nextClassFrom('Kelas 6A'), null, '6A lulus -> null');
strictEqual(nextClassFrom('Kelas 6B'), null, '6B lulus -> null');

console.log('isGraduatingClass:');
ok(isGraduatingClass('TK B.1'), 'TK B.1 graduating');
ok(isGraduatingClass('TK B.2'), 'TK B.2 graduating');
ok(isGraduatingClass('Kelas 6A'), '6A graduating');
ok(isGraduatingClass('Kelas 6B'), '6B graduating');
ok(!isGraduatingClass('TK A.1'), 'TK A.1 bukan graduating');
ok(!isGraduatingClass('Kelas 5A'), '5A bukan graduating');

console.log('all passed');