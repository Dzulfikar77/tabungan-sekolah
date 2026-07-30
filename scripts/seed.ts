/**
 * Seed script to populate Supabase DB from initialData.
 * Run: npx tsx scripts/seed.ts
 * Prerequisites: Tables must exist (run SQL migrations in Supabase SQL Editor first).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function toDbRow(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

async function seed() {
  console.log('Seeding Supabase...');

  // Dynamically import from the Vite project
  // Since this runs in Node, we need tsx to handle the import
  const ini = await import('../src/utils/initialData');

  const tables = [
    { name: 'school_settings', data: [toDbRow(ini.initialSchoolSettings)], constraint: 'id' },
    { name: 'academic_years', data: ini.initialAcademicYears.map(toDbRow), constraint: 'id' },
    { name: 'students', data: ini.initialStudents.map(toDbRow), constraint: 'id' },
    { name: 'books', data: ini.initialBooks.map(toDbRow), constraint: 'id' },
    { name: 'book_distributions', data: ini.initialBookDistributions.map(toDbRow), constraint: 'id' },
    { name: 'book_payments', data: ini.initialBookPayments.map(toDbRow), constraint: 'id' },
    { name: 'transactions', data: ini.initialTransactions.map(toDbRow), constraint: 'id' },
    { name: 'spp_payments', data: ini.initialSppPayments.map(toDbRow), constraint: 'id' },
    { name: 'audit_logs', data: ini.initialAuditLogs.map(toDbRow), constraint: 'id' },
    { name: 'users', data: ini.initialUsers.map(toDbRow), constraint: 'id' },
  ];

  for (const table of tables) {
    const { count, error } = await supabase.from(table.name).select('*', { count: 'exact', head: true });
    if (error) {
      console.warn(`Table ${table.name}: ${error.message} — skipping`);
      continue;
    }
    if (count && count > 0) {
      console.log(`Table ${table.name}: ${count} rows already exist, skipping`);
      continue;
    }
    if (table.data.length === 0) {
      console.log(`Table ${table.name}: no data to seed, skipping`);
      continue;
    }
    const { error: insertError } = await supabase.from(table.name).insert(table.data);
    if (insertError) {
      console.error(`Table ${table.name}: insert error: ${insertError.message}`);
    } else {
      console.log(`Table ${table.name}: seeded ${table.data.length} rows`);
    }
  }

  console.log('Seed complete!');
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
