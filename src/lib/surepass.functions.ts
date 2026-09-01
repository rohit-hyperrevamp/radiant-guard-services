import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AadhaarValidationResult = {
  valid: boolean;
  aadhaar_number: string;
  age_range: string;
  state: string;
  gender: string;
  last_digits: string;
  is_mobile: boolean;
  message: string;
};

export type DigilockerSession = {
  client_id: string;
  url: string;
  expiry_seconds: number | null;
};

export type DigilockerProfile = {
  completed: boolean;
  status: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  aadhaar_number: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  documents: string[];
  message: string;
};

type SurepassEnvelope<T> = {
  data?: T | null;
  success?: boolean;
  message?: string | null;
  message_code?: string | null;
  status_code?: number;
};

async function surepass<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<SurepassEnvelope<T>> {
  const token = process.env["SUREPASS_TOKEN"];
  const baseUrl = (process.env["SUREPASS_BASE_URL"] ?? "https://sandbox.surepass.io").replace(/\/+$/, "");
  if (!token) throw new Error("SUREPASS_TOKEN is not configured");

  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let json: SurepassEnvelope<T>;
  try {
    json = JSON.parse(text) as SurepassEnvelope<T>;
  } catch {
    throw new Error(`Surepass returned an unreadable response [${res.status}]: ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.success === false) {
    const detail = json.message ?? text.slice(0, 200);
    console.error(`[surepass] ${path} failed [${res.status}] ${detail}`);
    throw new Error(detail || `Surepass request failed (${res.status})`);
  }

  return json;
}

const s = (v: unknown) => String(v ?? "").trim();

/** Persisted cache so a DigiLocker download (one-shot at Surepass) can be replayed into the form. */
async function readCachedProfile(clientId: string): Promise<DigilockerProfile | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("digilocker_sessions")
      .select("profile")
      .eq("client_id", clientId)
      .maybeSingle();
    const profile = (data as { profile?: unknown } | null)?.profile;
    return profile ? (profile as DigilockerProfile) : null;
  } catch (error) {
    console.error("[surepass] cache read failed", error);
    return null;
  }
}

async function writeCachedProfile(clientId: string, profile: DigilockerProfile): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("digilocker_sessions")
      .upsert(
        { client_id: clientId, profile: profile as unknown as Record<string, unknown>, status: "completed", updated_at: new Date().toISOString() },
        { onConflict: "client_id" },
      );
  } catch (error) {
    console.error("[surepass] cache write failed", error);
  }
}

export const validateAadhaarNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits") }).parse(input),
  )
  .handler(async ({ data }): Promise<AadhaarValidationResult> => {
    const json = await surepass<Record<string, unknown>>(
      "/api/v1/aadhaar-validation/aadhaar-validation",
      { method: "POST", body: { id_number: data.aadhaar } },
    );
    const d = json.data ?? {};
    return {
      valid: Boolean((d as { aadhaar_number?: unknown }).aadhaar_number) || json.success === true,
      aadhaar_number: s((d as { aadhaar_number?: unknown }).aadhaar_number) || data.aadhaar,
      age_range: s((d as { age_range?: unknown }).age_range),
      state: s((d as { state?: unknown }).state),
      gender: s((d as { gender?: unknown }).gender),
      last_digits: s((d as { last_digits?: unknown }).last_digits),
      is_mobile: Boolean((d as { is_mobile?: unknown }).is_mobile),
      message: s(json.message) || "Aadhaar verified",
    };
  });

export const startDigilockerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        redirectUrl: z.string().url(),
        mobile: z.string().regex(/^\d{10}$/).optional(),
        sendSms: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<DigilockerSession> => {
    const json = await surepass<Record<string, unknown>>("/api/v1/digilocker/initialize", {
      method: "POST",
      body: {
        data: {
          signup_flow: false,
          skip_main_screen: false,
          redirect_url: data.redirectUrl,
          expiry_minutes: 15,
          send_sms: data.sendSms && Boolean(data.mobile),
          send_email: false,
          verify_phone: false,
          verify_email: false,
          ...(data.mobile ? { prefill_options: { mobile_number: data.mobile } } : {}),
        },
      },
    });
    const d = json.data ?? {};
    const url = s((d as { url?: unknown }).url);
    const clientId = s((d as { client_id?: unknown }).client_id);
    if (!url || !clientId) throw new Error("DigiLocker did not return a consent link");
    return {
      client_id: clientId,
      url,
      expiry_seconds: Number((d as { expiry_seconds?: unknown }).expiry_seconds) || null,
    };
  });

export const getDigilockerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().min(6).max(120) }).parse(input))
  .handler(async ({ data }): Promise<DigilockerProfile> => {
    const status = await surepass<Record<string, unknown>>(
      `/api/v1/digilocker/status/${encodeURIComponent(data.clientId)}`,
      { method: "GET" },
    );
    const st = status.data ?? {};
    const completed = Boolean((st as { completed?: unknown }).completed);
    const documents = Array.isArray((st as { documents?: unknown }).documents)
      ? ((st as { documents: unknown[] }).documents.map((doc) => s(doc)).filter(Boolean))
      : [];

    const empty: DigilockerProfile = {
      completed,
      status: completed ? "completed" : "pending",
      full_name: "",
      date_of_birth: "",
      gender: "",
      aadhaar_number: "",
      address_line1: "",
      address_line2: "",
      landmark: "",
      city: "",
      district: "",
      state: "",
      pincode: "",
      country: "India",
      documents,
      message: s(status.message) || (completed ? "DigiLocker completed" : "Waiting for the candidate to finish"),
    };

    if (!completed) return empty;

    const aadhaar = await surepass<Record<string, unknown>>(
      `/api/v1/digilocker/download-aadhaar/${encodeURIComponent(data.clientId)}`,
      { method: "GET" },
    );
    const a = (aadhaar.data ?? {}) as Record<string, unknown>;
    const address = (a["address"] ?? {}) as Record<string, unknown>;

    const house = s(address["house"]);
    const street = s(address["street"]);
    const loc = s(address["loc"]);
    const vtc = s(address["vtc"]);

    return {
      ...empty,
      status: "completed",
      full_name: s(a["name"]) || s(a["full_name"]),
      date_of_birth: s(a["dob"]) || s(a["date_of_birth"]),
      gender: /^m/i.test(s(a["gender"])) ? "Male" : /^f/i.test(s(a["gender"])) ? "Female" : s(a["gender"]),
      aadhaar_number: s(a["aadhaar_number"]).replace(/\D/g, "").slice(0, 12),
      address_line1: [house, street].filter(Boolean).join(", "),
      address_line2: [loc, vtc].filter(Boolean).join(", "),
      landmark: s(address["landmark"]),
      city: vtc || s(address["subdist"]),
      district: s(address["dist"]),
      state: s(address["state"]),
      pincode: s(a["zip"]) || s(address["zip"]),
      country: s(address["country"]) || "India",
      message: "Verified via DigiLocker",
    };
  });
