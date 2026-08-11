// supabase/functions/admin-users/index.ts
// Edge function for user management (create, reset-password, update-role, update-access-level, delete, provision-viewer)
// Only handler with service-role key. Verifies JWT and enforces ROLE_RANK.
// Dispatch is by `action` in the JSON body (not the URL path) — the client always
// POSTs to the bare function URL with { action, ...payload }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deployed at https://simu.web.id (Cloudflare Workers custom domain).
// Set: supabase secrets set ALLOWED_ORIGIN=https://simu.web.id
// Falls back to "*" until that secret is set.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role rank mapping (must match src/context/AppContext.tsx and src/components/SettingsModal.tsx)
const ROLE_RANK: Record<string, number> = {
  Developer: 4,
  "Super Admin": 3,
  Admin: 2,
  "Wali Kelas": 1,
  Viewer: 0,
};

// Must match src/utils/viewerCredentials.ts normalizeName() so create-time and
// login-time email derivation always agree.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller's JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    // Get caller's profile and role
    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      return json({ error: "Profile not found" }, 403);
    }

    const callerRank = ROLE_RANK[callerProfile.role] || 0;

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      // Create user: Developer, Super Admin only
      if (callerRank < 3) {
        return json({ error: "Insufficient permissions" }, 403);
      }

      const { username, name, role, access_level, password } = body;

      // Validate role rank (can't create higher than yourself)
      if ((ROLE_RANK[role] || 0) >= callerRank) {
        return json({ error: "Cannot create user with equal or higher role" }, 403);
      }

      const normalizedUsername = normalizeName(username);
      if (!normalizedUsername) {
        return json({ error: "Username tidak valid" }, 400);
      }

      // Create auth user with synthetic email derived the same way login does
      const email = `${normalizedUsername}@akun.tabungan-sekolah.local`;
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return json({ error: createError.message }, 400);
      }

      // Create profile
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          username: normalizedUsername,
          name,
          role,
          access_level: access_level || null,
        });

      if (profileInsertError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return json({ error: profileInsertError.message }, 400);
      }

      return json({ success: true, userId: authUser.user.id });
    }

    if (action === "reset-password") {
      // Reset password: rank floor (Admin+) AND caller rank must exceed target rank
      if (callerRank < 2) {
        return json({ error: "Insufficient permissions" }, 403);
      }

      const { user_id, new_password } = body;

      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .single();

      if (targetError || !targetProfile) {
        return json({ error: "Target user not found" }, 404);
      }

      const targetRank = ROLE_RANK[targetProfile.role] || 0;
      if (callerRank <= targetRank) {
        return json({ error: "Cannot reset password of equal or higher role" }, 403);
      }

      const { error: resetError } = await supabase.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (resetError) {
        return json({ error: resetError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "update-role") {
      // Update role: Developer only
      if (callerRank < 4) {
        return json({ error: "Only Developer can change roles" }, 403);
      }

      const { user_id, role } = body;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", user_id);

      if (updateError) {
        return json({ error: updateError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "update-access-level") {
      // Update access level: Developer only (mirrors update-role gate)
      if (callerRank < 4) {
        return json({ error: "Only Developer can change access level" }, 403);
      }

      const { user_id, access_level } = body;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ access_level: access_level || null })
        .eq("id", user_id);

      if (updateError) {
        return json({ error: updateError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "delete") {
      // Delete user: Developer, Super Admin + guard "Developer terakhir"
      if (callerRank < 3) {
        return json({ error: "Insufficient permissions" }, 403);
      }

      const { user_id } = body;

      // Get target profile
      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .single();

      if (targetError || !targetProfile) {
        return json({ error: "Target user not found" }, 404);
      }

      // Developer-deletes-Developer is a supported peer action (guarded below
      // by "can't delete the last Developer"); every other role must strictly
      // outrank its target — this is what blocked e.g. a Super Admin from
      // deleting another Super Admin before.
      const targetRank = ROLE_RANK[targetProfile.role] || 0;
      const isDeveloperPeer = callerRank === 4 && targetRank === 4;
      if (!isDeveloperPeer && callerRank <= targetRank) {
        return json({ error: "Cannot delete a user with equal or higher role" }, 403);
      }

      // Guard: can't delete Developer if last one
      if (targetProfile.role === "Developer") {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "Developer");

        if (count && count <= 1) {
          return json({ error: "Cannot delete last Developer" }, 403);
        }
      }

      // Delete auth user (cascades to profiles)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);

      if (deleteError) {
        return json({ error: deleteError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "provision-viewer") {
      // Provision viewer: Developer, Super Admin, Admin
      if (callerRank < 2) {
        return json({ error: "Insufficient permissions" }, 403);
      }

      const { student_id } = body;

      // Identity is derived from NIS (unique per definition), not from the
      // student's name — two students sharing a name used to collide on the
      // same username and the second provisioning call would fail.
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, nis, name, parent_name")
        .eq("id", student_id)
        .single();

      if (studentError || !student) {
        return json({ error: "Siswa tidak ditemukan" }, 404);
      }

      const normalizedNis = String(student.nis).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (!normalizedNis) {
        return json({ error: "NIS siswa tidak valid" }, 400);
      }

      const username = `${normalizedNis}_ortu`;
      // NIS + 4 random alphanumeric chars: the initial code stays guessable-length
      // for printing on a slip, but isn't reproducible from NIS alone.
      const randomSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
      const initialCode = `${normalizedNis}_${randomSuffix}`;

      const email = `${username}@akun.tabungan-sekolah.local`;
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: initialCode,
        email_confirm: true,
      });

      if (createError) {
        return json({ error: createError.message }, 400);
      }

      // must_change_password: true — the initial code is a one-time value
      // printed on a slip, the parent replaces it on first login.
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          username,
          name: student.parent_name || `${student.name} (Orang Tua)`,
          role: "Viewer",
          student_id: student.id,
          must_change_password: true,
        });

      if (profileInsertError) {
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return json({ error: profileInsertError.message }, 400);
      }

      return json({ success: true, userId: authUser.user.id, username, initialCode });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (error) {
    console.error("admin-users unhandled error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
