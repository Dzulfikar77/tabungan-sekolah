// supabase/functions/viewer-auth/index.ts
// Edge function for viewer authentication (login, recover)
// Rate-limited per IP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Helper: normalize name for matching
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Helper: normalize phone for matching
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
}

// Helper: verify parent identity
function verifyParentIdentity(
  student: { parent_name: string; phone: string },
  parentName: string,
  phone: string
): boolean {
  const normalizedStudentParent = normalizeName(student.parent_name || "");
  const normalizedInputParent = normalizeName(parentName);
  const normalizedStudentPhone = normalizePhone(student.phone || "");
  const normalizedInputPhone = normalizePhone(phone);

  return (
    normalizedStudentParent === normalizedInputParent &&
    normalizedStudentPhone === normalizedInputPhone
  );
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0] || "unknown";

    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "POST" && path === "login") {
      const { nameOrUsername, password } = await req.json();

      if (!nameOrUsername || !password) {
        return new Response(JSON.stringify({ error: "Name/username and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find viewer profile by username
      const normalizedName = normalizeName(nameOrUsername);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, name, role, student_id")
        .eq("role", "Viewer");

      if (profileError) {
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find matching profile
      const profile = profiles?.find(
        (p) => normalizeName(p.username) === normalizedName || normalizeName(p.name) === normalizedName
      );

      if (!profile) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sign in with synthetic email
      const email = `${profile.username}@akun.tabungan-sekolah.local`;
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          session: authData.session,
          user: {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role,
            studentId: profile.student_id,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST" && path === "recover") {
      const { nameOrUsername, parentName, phone, newPassword } = await req.json();

      if (!nameOrUsername || !parentName || !phone || !newPassword) {
        return new Response(JSON.stringify({ error: "All fields required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find viewer profile
      const normalizedName = normalizeName(nameOrUsername);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, name, role, student_id")
        .eq("role", "Viewer");

      if (profileError) {
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profile = profiles?.find(
        (p) => normalizeName(p.username) === normalizedName || normalizeName(p.name) === normalizedName
      );

      if (!profile) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!profile.student_id) {
        return new Response(JSON.stringify({ error: "Viewer account not linked to student" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get student data for identity verification
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("parent_name, phone")
        .eq("id", profile.student_id)
        .single();

      if (studentError || !student) {
        return new Response(JSON.stringify({ error: "Student data not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify parent identity
      if (!verifyParentIdentity(student, parentName, phone)) {
        return new Response(JSON.stringify({ error: "Identity verification failed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Reset password
      const { error: resetError } = await supabase.auth.admin.updateUserById(profile.id, {
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
