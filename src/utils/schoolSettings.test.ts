import assert from 'node:assert/strict';
import { initialSchoolSettings } from './initialData';
import { mergeSchoolSettings } from './schoolSettings';

const merged = mergeSchoolSettings(initialSchoolSettings, {
  name: 'Sekolah Baru',
  address: 'Jl. Baru',
  logoUrl: 'data:image/png;base64,abc',
});

assert.equal(merged.name, 'Sekolah Baru');
assert.equal(merged.address, 'Jl. Baru');
assert.equal(merged.logoUrl, 'data:image/png;base64,abc');
assert.equal(merged.monthlyDeductionAmount, initialSchoolSettings.monthlyDeductionAmount);

console.log('schoolSettings merge test passed');
