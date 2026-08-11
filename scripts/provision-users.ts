// scripts/provision-users.ts
// Provision staff users via Supabase Auth Admin API.
// This is the ONLY lockout recovery path for Developer role.
// Password is read from argv/env, never from committed files.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const usage = `
Usage: npx tsx scripts/provision-users.ts --username <username> --name <name> --role <role> --password <password> [--access-level <TK|MI>]

Examples:
  npx tsx scripts/provision-users.ts --username masdev --name "Mas Dev" --role Developer --password mysecurepassword
  npx tsx scripts/provision-users.ts --username admtk --name "Admin TK" --role Admin --access-level TK --password mysecurepassword
`;

// Parse arguments
const params: Record<string, string> = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '');
  const value = args[i + 1];
  if (key && value) {
    params[key] = value;
  }
}

if (!params.username || !params.name || !params.role || !params.password) {
  console.error(usage);
  process.exit(1);
}

const validRoles = ['Developer', 'Super Admin', 'Admin', 'Wali Kelas', 'Viewer'];
if (!validRoles.includes(params.role)) {
  console.error(`Invalid role: ${params.role}. Must be one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function provisionUser() {
  const email = `${params.username}@akun.tabungan-sekolah.local`;

  console.log(`Provisioning user: ${params.username} (${params.role})`);

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === email
  );

  if (existingUser) {
    console.log(`User ${params.username} already exists (ID: ${existingUser.id}). Updating password...`);
    
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { password: params.password }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError.message);
      process.exit(1);
    }

    console.log(`Password updated for ${params.username}.`);
  } else {
    // Create new auth user
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: params.password,
      email_confirm: true,
    });

    if (createError) {
      console.error('Failed to create auth user:', createError.message);
      process.exit(1);
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        username: params.username,
        name: params.name,
        role: params.role,
        access_level: params['access-level'] || null,
      });

    if (profileError) {
      console.error('Failed to create profile:', profileError.message);
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      process.exit(1);
    }

    console.log(`User ${params.username} created successfully (ID: ${authUser.user.id}).`);
  }
}

provisionUser().catch((e) => {
  console.error('Provisioning failed:', e);
  process.exit(1);
});
