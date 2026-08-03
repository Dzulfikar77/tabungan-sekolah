// Reset password user via CLI (Developer/AI recovery path).

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error('Usage: npx tsx scripts/reset-password.ts <username> <newPassword>');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  const { error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .eq('username', username);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log('Password untuk ' + username + ' berhasil direset.');
  process.exit(0);
}

resetPassword().catch((e) => {
  console.error('Reset failed:', e);
  process.exit(1);
});
