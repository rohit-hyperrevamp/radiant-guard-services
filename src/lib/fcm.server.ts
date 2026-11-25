/**
 * Server-side FCM (Firebase Cloud Messaging) sender for Android devices.
 *
 * Primary path: the Firebase service account stored in FIREBASE_SERVICE_ACCOUNT_JSON
 * is used to mint a short-lived Google OAuth token (signed JWT grant) and the
 * message is sent to the FCM HTTP v1 API.
 * iOS keeps using APNs directly (see apns.server.ts).
 */
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export type FcmPayload = {
  title?: string;
  body?: string;
  link?: string;
};

type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return Boolean(getServiceAccount());
}

function base64Url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google token exchange failed [${response.status}]: ${text}`);
  }
  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return cachedToken.token;
}

function buildMessage(deviceToken: string, payload: FcmPayload) {
  return {
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
  };
}

export async function sendFcmPush(
  deviceToken: string,
  payload: FcmPayload,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const account = getServiceAccount();
    if (!account) {
      throw new Error(
        "Android push is not configured yet. Add FIREBASE_SERVICE_ACCOUNT_JSON.",
      );
    }

    const accessToken = await getAccessToken(account);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildMessage(deviceToken, payload)),
      },
    );

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
