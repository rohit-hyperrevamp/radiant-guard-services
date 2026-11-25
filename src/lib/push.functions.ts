import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePushAuth } from "./push-auth.server";
import {
  getPushRegistrationStatusForUser,
  saveNativePushTokenForUser,
  sendNativePushToCurrentUserServer,
  sendNativePushForRecentNotifications,
} from "./push-delivery.server";
import { pushRecipientsForCaller } from "./push-permissions";

export const getMyPushRegistrationStatus = createServerFn({ method: "GET" })
  .middleware([requirePushAuth])
  .handler(async ({ context }) =>
    getPushRegistrationStatusForUser(context.supabase, context.userId),
  );

export const saveMyPushToken = createServerFn({ method: "POST" })
  .middleware([requirePushAuth])
  .inputValidator((data) =>
    z.object({
      token: z.string().min(32).max(512),
      platform: z.enum(["ios", "android", "web"]).default("ios"),
    }).parse(data),
  )
  .handler(async ({ context, data }) =>
    saveNativePushTokenForUser(context.supabase, context.userId, {
      token: data.token,
      platform: data.platform,
    }),
  );

export const sendTestPushToMe = createServerFn({ method: "POST" })
  .middleware([requirePushAuth])
  .inputValidator((data) =>
    z.object({ message: z.string().optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const result = await sendNativePushToCurrentUserServer(context.supabase, {
      title: "Radiant Guard",
      body: data.message || "Test push notification",
    });
    const firstFailure = result.failures[0]?.error;
    const failedDetail = firstFailure
      ? `APNs error: ${firstFailure}`
      : "No push notifications were sent.";
    return {
      sent: result.sent,
      total: result.total,
      results: result.failures,
      message:
        result.sent > 0
          ? `Sent ${result.sent} of ${result.total} push notification${result.total === 1 ? "" : "s"}.`
          : result.total === 0
            ? "No registered iPhone token found for this signed-in user. Tap Refresh iPhone registration and try again."
            : failedDetail,
    };
  });

export const sendNativePushToUsers = createServerFn({ method: "POST" })
  .middleware([requirePushAuth])
  .inputValidator((data) =>
    z.object({
      userIds: z.array(z.string().uuid()).min(1).max(100),
      title: z.string().min(1).max(180),
      message: z.string().min(1).max(3000),
      link: z.string().max(500).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    // Admins may push to anyone. Everyone else may only push the exact
    // notification they themselves created for that person in the last hour,
    // so a user cannot send arbitrary text to someone else's phone.
    const { data: isAdmin } = await context.supabase.rpc("is_admin_user" as never);
    let recipients = data.userIds;
    if (isAdmin !== true) {
      const { supabaseAdmin } = await import("./radiant-admin.server");
      const { data: rows, error } = await supabaseAdmin
        .from("notifications")
        .select("user_id,title,message")
        .in("user_id", data.userIds)
        .eq("actor_id", context.userId)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(500);
      if (error) throw new Error("Could not verify the notification for this push.");
      recipients = pushRecipientsForCaller(
        (rows ?? []) as Array<{ user_id: string; title: string; message: string }>,
        data.title,
        data.message,
      );
      if (recipients.length === 0) return { sent: 0, total: 0, failures: [] };
    }
    return sendNativePushForRecentNotifications(context.supabase, recipients, {
      title: data.title,
      body: data.message,
      link: data.link,
    }, { actorUserId: context.userId });
  });
