// supabase/functions/admin-users/index.ts
// Edge function for user management (create, reset-password, update-role, delete, provision-viewer)
// Only handler with service-role key. Verifies JWT and enforces ROLE_RANK.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role rank mapping (must match AppContext.tsx:479 and SettingsModal.tsx:229)
const ROLE_RANK: Record<string, number> = {
  Developer: 4,
  "Super Admin": 3,
  Admin: 2,
  "Wali Kelas": 1,
  Viewer: 0,
};

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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's profile and role
    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRank = ROLE_RANK[callerProfile.role] || 0;
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Route handling
    if (req.method === "POST" && path === "create") {
      // Create user: Developer, Super Admin only
      if (callerRank < 3) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { username, name, role, accessLevel, password } = await req.json();

      // Validate role rank (can't create higher than yourself)
      if ((ROLE_RANK[role] || 0) >= callerRank) {
        return new Response(JSON.stringify({ error: "Cannot create user with equal or higher role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user with synthetic email
      const email = `${username}@akun.tabungan-sekolah.local`;
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create profile
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          username,
          name,
          role,
          access_level: accessLevel || null,
        });

      if (profileInsertError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return new Response(JSON.stringify({ error: profileInsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "reset-password") {
      // Reset password: caller rank must be > target rank
      const { userId, newPassword } = await req.json();

      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetError || !targetProfile) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetRank = ROLE_RANK[targetProfile.role] || 0;
      if (callerRank <= targetRank) {
        return new Response(JSON.stringify({ error: "Cannot reset password of equal or higher role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "update-role") {
      // Update role: Developer only
      if (callerRank < 4) {
        return new Response(JSON.stringify({ error: "Only Developer can change roles" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId, role, accessLevel } = await req.json();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role, access_level: accessLevel || null })
        .eq("id", userId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE" && path === "delete") {
      // Delete user: Developer, Super Admin + guard "Developer terakhir"
      if (callerRank < 3) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId } = await req.json();

      // Get target profile
      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetError || !targetProfile) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Guard: can't delete Developer if last one
      if (targetProfile.role === "Developer") {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "Developer");

        if (count && count <= 1) {
          return new Response(JSON.stringify({ error: "Cannot delete last Developer" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Delete auth user (cascades to profiles)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "provision-viewer") {
      // Provision viewer: Developer, Super Admin, Admin
      if (callerRank < 2) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { studentId, studentName, parentName, phone, academicYear } = await req.json();

      // Generate viewer credentials
      const normalizedName = studentName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const username = `${normalizedName}_ortu`;
      const password = `${academicYear.replace("/", "")}_seq`;

      // Create auth user
      const email = `${username}@akun.tabungan-sekolah.local`;
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create profile
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          username,
          name: parentName || `${studentName} (Orang Tua)`,
          role: "Viewer",
          student_id: studentId,
        });

      if (profileInsertError) {
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return new Response(JSON.stringify({ error: profileInsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id, username, password }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown route" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
