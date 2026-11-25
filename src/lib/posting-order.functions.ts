import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createRateLimiter, escapeLike } from "./server-guards";

// Per signed-in user, per server instance: enough for bulk mapping runs,
// low enough that the company sender cannot be used as a relay.
const sendLimiter = createRateLimiter(40, 10 * 60_000);

/**
 * Emails a rendered posting order to an employee. The recipient must be the
 * email on an employee record the caller can already read (row-level security
 * decides), so arbitrary addresses are refused.
 */
export const sendPostingOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        to: z.string().trim().email().max(254),
        subject: z.string().min(3).max(300),
        html: z.string().min(10).max(200_000),
        text: z.string().max(50_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!sendLimiter.take(context.userId)) {
      throw new Error("Too many emails sent in a short time. Please wait a few minutes and try again.");
    }
    const to = data.to.toLowerCase();
    const { data: match, error } = await context.supabase
      .from("candidates")
      .select("id")
      .ilike("email", escapeLike(to))
      .limit(1);
    if (error) {
      console.error("[posting-order] recipient lookup failed", error);
      throw new Error("Could not confirm the recipient. Please try again.");
    }
    if (!match || match.length === 0) {
      throw new Error("Posting orders can only be emailed to an employee's own email address on their profile.");
    }
    const { sendEmailViaResend } = await import("./posting-order.server");
    return sendEmailViaResend({ ...data, to });
  });
