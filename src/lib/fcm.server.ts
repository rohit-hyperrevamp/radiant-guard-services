/**
 * Server-side FCM (Firebase Cloud Messaging) sender for Android devices.
 *
 * Routed through the Lovable connector gateway, which exchanges the stored
 * Firebase service account for a Google access token — the app never sees the
 * service account JSON. iOS keeps using APNs directly (see apns.server.ts).
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export type FcmPayload = {
  title?: string;
  body?: string;
  link?: string;
};

function getConfig() {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const connectionApiKey =
    process.env.FIREBASE_MESSAGING_API_KEY || process.env.FIREBASE_CLOUD_MESSAGING_API_KEY;
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error(
      "Android push is not configured yet. Connect Firebase Cloud Messaging so FIREBASE_MESSAGING_API_KEY and LOVABLE_API_KEY are available.",
    );
  }
  return { lovableApiKey, connectionApiKey };
}

export function isFcmConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

export async function sendFcmPush(
  deviceToken: string,
  payload: FcmPayload,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const { lovableApiKey, connectionApiKey } = getConfig();
    const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": connectionApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: {
            title: payload.title || "Radiant Guard",
            body: payload.body || "You have a new notification",
          },
          data: payload.link ? { link: payload.link } : undefined,
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "radiant_alerts",
              sound: "default",
              default_vibrate_timings: true,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Stale registration tokens report UNREGISTERED / INVALID_ARGUMENT.
      const unregistered = /UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/i.test(text);
      return {
        success: false,
        status: response.status,
        error: unregistered ? `Unregistered: ${text}` : text,
      };
    }

    return { success: true, status: response.status };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
