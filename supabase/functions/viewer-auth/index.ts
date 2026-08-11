// supabase/functions/viewer-auth/index.ts
// Edge function for viewer-facing actions: name search (suggest), self-service
// password recovery (recover), and admin-triggered reset (reset-password).
// Dispatch is by `action` in the JSON body — the client always POSTs to the
// bare function URL.
//
// suggest/recover run before the parent has a session, so they take no JWT —
// identity is instead resolved server-side (username lookup / parent name+phone
// match against the DB via the service-role key, never trusting client input
// for anything but the search string).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_RANK: Record<string, number> = {
  Developer: 4,
  "Super Admin": 3,
  Admin: 2,
  "Wali Kelas": 1,
  Viewer: 0,
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const action = body.action;

    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim() || "unknown";

    async function checkRateLimit(rateAction: string, max: number, windowSeconds: number): Promise<boolean> {
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: `${clientIp}:${rateAction}`,
        p_max: max,
        p_window_seconds: windowSeconds,
      });
      // Fail open on infra errors — a rate-limit outage should not lock every parent out.
      if (error) return true;
      return data === true;
    }

    if (action === "suggest") {
      const allowed = await checkRateLimit("suggest", 30, 15 * 60);
      if (!allowed) {
        return json({ error: "Too many requests. Try again later." }, 429);
      }

      const query = (body.query || "").trim();
      if (query.length < 3) {
        return json({ suggestions: [] });
      }

      const { data: matches, error: studentsError } = await supabase
        .from("students")
        .select("id, name, class_grade, nis")
        .eq("is_deleted", false)
        .ilike("name", `%${query}%`)
        .limit(50);

      if (studentsError) {
        return json({ error: "Database error" }, 500);
      }

      const studentIds = (matches || []).map((s) => s.id);
      if (studentIds.length === 0) {
        return json({ suggestions: [] });
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("username, student_id")
        .eq("role", "Viewer")
        .in("student_id", studentIds);

      if (profilesError) {
        return json({ error: "Database error" }, 500);
      }

      const usernameByStudentId = new Map((profiles || []).map((p) => [p.student_id, p.username]));
      const q = normalizeName(query);

      const suggestions = (matches || [])
        .filter((s) => usernameByStudentId.has(s.id))
        .map((s) => ({
          username: usernameByStudentId.get(s.id)!,
          name: s.name,
          classGrade: s.class_grade,
          nisTail: String(s.nis).slice(-3),
        }))
        .sort((a, b) => {
          const aPrefix = normalizeName(a.name).startsWith(q) ? 0 : 1;
          const bPrefix = normalizeName(b.name).startsWith(q) ? 0 : 1;
          if (aPrefix !== bPrefix) return aPrefix - bPrefix;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 8);

      return json({ suggestions });
    }

    if (action === "recover") {
      const allowed = await checkRateLimit("recover", 5, 15 * 60);
      if (!allowed) {
        return json({ error: "Too many attempts. Try again later." }, 429);
      }

      const { username, parent_name, phone, new_password } = body;
      if (!username || !parent_name || !phone || !new_password) {
        return json({ error: "All fields required" }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, student_id")
        .eq("role", "Viewer")
        .eq("username", username)
        .single();

      if (profileError || !profile || !profile.student_id) {
        return json({ error: "Account not found" }, 404);
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("parent_name, phone")
        .eq("id", profile.student_id)
        .single();

      if (studentError || !student) {
        return json({ error: "Student data not found" }, 404);
      }

      const nameOk = normalizeName(student.parent_name || "") === normalizeName(parent_name);
      const phoneOk = normalizePhone(student.phone || "") === normalizePhone(phone);
      if (!nameOk || !phoneOk) {
        return json({ error: "Identity verification failed" }, 403);
      }

      const { error: resetError } = await supabase.auth.admin.updateUserById(profile.id, {
        password: new_password,
      });

      if (resetError) {
        return json({ error: resetError.message }, 400);
      }

      await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile.id);

      return json({ success: true });
    }

    if (action === "reset-password") {
      // Admin-triggered reset — requires a staff JWT, rank >= 2 (Admin+).
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ error: "Missing authorization" }, 401);
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return json({ error: "Invalid token" }, 401);
      }

      const { data: callerProfile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !callerProfile) {
        return json({ error: "Profile not found" }, 403);
      }

      const callerRank = ROLE_RANK[callerProfile.role] || 0;
      if (callerRank < 2) {
        return json({ error: "Insufficient permissions" }, 403);
      }

      const { target_user_id, new_password } = body;
      const { error: resetError } = await supabase.auth.admin.updateUserById(target_user_id, {
        password: new_password,
      });

      if (resetError) {
        return json({ error: resetError.message }, 400);
      }

      await supabase.from("profiles").update({ must_change_password: false }).eq("id", target_user_id);

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
