import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_SUPER_ADMIN_PHONE = "8373914073";

function phoneFromEmail(email: unknown): string | null {
  const m = String(email ?? "").match(/^phone-(\d{10})@radiantguard\.local$/i);
  return m ? m[1] : null;
}

/**
 * Super Admin "View as user": mints a session for the target employee's
 * phone identity so the admin sees exactly what that person sees (RLS included).
 * The caller's super-admin status is verified here on every call.
 */
export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const superPhone = process.env["VITE_SUPER_ADMIN_PHONE"] || DEFAULT_SUPER_ADMIN_PHONE;
    const callerPhone = phoneFromEmail(context.claims.email);
    const { supabaseAdmin } = await import("@/lib/radiant-admin.server");

    let isSuper = callerPhone === superPhone;
    if (!isSuper && callerPhone) {
      const { data: me } = await supabaseAdmin
        .from("candidates")
        .select("role_key")
        .eq("mobile", callerPhone)
        .maybeSingle();
      isSuper = me?.role_key === "super_admin";
    }
    if (!isSuper) throw new Error("Only the Super Admin can view as another user.");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("candidates")
      .select("id,full_name,employee_code,mobile,role_key")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (tErr || !target) throw new Error("Employee not found.");
    const phone = String(target.mobile ?? "").replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) throw new Error("This employee has no valid mobile number.");
    if (phone === superPhone || target.role_key === "super_admin") {
      throw new Error("You cannot view as another Super Admin.");
    }
    const eligible = await supabaseAdmin.rpc("can_phone_login", { _mobile: phone });
    if (eligible.error || eligible.data !== true) {
      throw new Error("This employee's account is not enabled for sign-in.");
    }

    const email = `phone-${phone}@radiantguard.local`;
    let link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) {
      // Identity not created yet (never signed in) — create it, then retry.
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `RG-${phone}-pre-launch!`,
        email_confirm: true,
      });
      if (created.error) throw new Error("Could not prepare this employee's account.");
      link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    }
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) throw new Error("Could not open this employee's view.");
    // For an employee who has never signed in, the auth service creates an
    // unconfirmed account and issues a *signup* confirmation token rather than
    // a magic-link token — verify with the type it actually issued.
    const issued = String(link.data?.properties?.verification_type ?? "magiclink");
    const otpType = (issued === "signup" ? "signup" : "magiclink") as "signup" | "magiclink";
    let signedIn = await supabaseAdmin.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
    if ((signedIn.error || !signedIn.data.session) && otpType === "magiclink") {
      const retry = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
      const h = retry.data?.properties?.hashed_token;
      if (h) signedIn = await supabaseAdmin.auth.verifyOtp({ type: "signup", token_hash: h });
    }
    if (signedIn.error || !signedIn.data.session) {
      console.error("[impersonation] verify failed", issued, signedIn.error?.message);
      throw new Error("Could not open this employee's view.");
    }
    return {
      accessToken: signedIn.data.session.access_token,
      refreshToken: signedIn.data.session.refresh_token,
      phone,
      fullName: String(target.full_name ?? ""),
      employeeCode: String(target.employee_code ?? ""),
      roleKey: String(target.role_key ?? ""),
    };
  });


/**
 * Super Admin-only employee search for "View as user". Runs with the admin
 * client so every employee (leadership included) is listed regardless of the
 * caller's own row-level access. Words are matched together first, then any
 * word, so near-miss spellings still surface the person.
 */
export const searchImpersonationTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().max(80), page: z.number().int().min(0).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const superPhone = process.env["VITE_SUPER_ADMIN_PHONE"] || DEFAULT_SUPER_ADMIN_PHONE;
    const callerPhone = phoneFromEmail(context.claims.email);
    const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
    let isSuper = callerPhone === superPhone;
    if (!isSuper && callerPhone) {
      const { data: me } = await supabaseAdmin.from("candidates").select("role_key").eq("mobile", callerPhone).maybeSingle();
      isSuper = me?.role_key === "super_admin";
    }
    if (!isSuper) throw new Error("Only the Super Admin can view as another user.");
    const PAGE = 25;
    const words = data.q.replace(/[,()%*]/g, " ").trim().split(/\s+/).filter(Boolean);
    const run = async (mode: "all" | "any") => {
      let query = supabaseAdmin
        .from("candidates")
        .select("id,full_name,employee_code,mobile,role_key")
        .not("mobile", "is", null)
        .order("full_name")
        .range(data.page * PAGE, data.page * PAGE + PAGE);
      if (words.length === 1) {
        const w = words[0];
        query = query.or(`full_name.ilike.%${w}%,employee_code.ilike.%${w}%,mobile.ilike.%${w}%`);
      } else if (words.length > 1 && mode === "all") {
        for (const w of words) query = query.ilike("full_name", `%${w}%`);
      } else if (words.length > 1) {
        query = query.or(words.map((w) => `full_name.ilike.%${w.length > 4 ? w.slice(0, 4) : w}%`).join(","));
      }
      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);
      return rows ?? [];
    };
    let rows = await run("all");
    if (rows.length === 0 && words.length > 1) rows = await run("any");
    return { rows: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
  });
