import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function phoneFromEmail(email: unknown): string | null {
  const m = String(email ?? "").match(/^phone-(\d{10})@radiantguard\.local$/i);
  return m ? m[1] : null;
}

/**
 * Super Admin "View as user": mints a session for the target employee's
 * phone identity so the admin sees exactly what that person sees (RLS included).
 * The caller's super-admin status is verified here on every call.
 */
/** Roles that only the Super Admin may view as (never Leadership). */
const PRIVILEGED_ROLES = new Set(["super_admin", "admin", "leadership"]);

/** Resolves the caller: "super" (Super Admin), "leadership", or null. */
async function callerLevel(email: unknown): Promise<"super" | "leadership" | null> {
  const { superAdminPhone } = await import("@/lib/phone-session.server");
  const callerPhone = phoneFromEmail(email);
  if (!callerPhone) return null;
  if (callerPhone === superAdminPhone()) return "super";
  const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
  // A rehired person can have more than one non-inactive row: take any match.
  const { data: rows } = await supabaseAdmin
    .from("candidates")
    .select("role_key")
    .eq("mobile", callerPhone)
    .neq("status", "inactive")
    .limit(5);
  const roles = (rows ?? []).map((r) => String(r.role_key ?? ""));
  if (roles.includes("super_admin")) return "super";
  if (roles.includes("leadership")) return "leadership";
  return null;
}

/**
 * "View as user": mints a session for the target employee's phone identity so
 * the viewer sees exactly what that person sees (RLS included). The caller is
 * verified on every call. Leadership may view ordinary staff only; Admin,
 * Leadership and Super Admin accounts can be viewed by the Super Admin only.
 */
export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { mintPhoneSession, superAdminPhone } = await import("@/lib/phone-session.server");
    const level = await callerLevel(context.claims.email);
    if (!level) throw new Error("Only the Super Admin or Leadership can view as another user.");
    const { supabaseAdmin } = await import("@/lib/radiant-admin.server");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("candidates")
      .select("id,full_name,employee_code,mobile,role_key")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (tErr || !target) throw new Error("Employee not found.");
    const phone = String(target.mobile ?? "").replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) throw new Error("This employee has no valid mobile number.");
    const targetRole = String(target.role_key ?? "");
    if (phone === superAdminPhone() || targetRole === "super_admin") {
      throw new Error("You cannot view as another Super Admin.");
    }
    if (level !== "super" && PRIVILEGED_ROLES.has(targetRole)) {
      throw new Error("Only the Super Admin can view as an Admin or Leadership account.");
    }
    const eligible = await supabaseAdmin.rpc("can_phone_login", { _mobile: phone });
    if (eligible.error || eligible.data !== true) {
      throw new Error("This employee's account is not enabled for sign-in.");
    }

    const session = await mintPhoneSession(phone).catch(() => {
      throw new Error("Could not open this employee's view.");
    });
    return {
      ...session,
      phone,
      fullName: String(target.full_name ?? ""),
      employeeCode: String(target.employee_code ?? ""),
      roleKey: targetRole,
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
    const level = await callerLevel(context.claims.email);
    if (!level) throw new Error("Only the Super Admin or Leadership can view as another user.");
    const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
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
