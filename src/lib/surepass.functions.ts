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

function findAadhaarPayload(value: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = [
    value["aadhaar_xml_data"],
    value["aadhaar_data"],
    value["user_details"],
    value["profile"],
    value,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    if (s(record["full_name"]) || s(record["name"]) || s(record["dob"]) || s(record["masked_aadhaar"])) {
      return record;
    }
  }
  return null;
}

function toDigilockerProfile(
  source: Record<string, unknown>,
  base: DigilockerProfile,
): DigilockerProfile {
  const address = (source["address"] ?? {}) as Record<string, unknown>;
  const house = s(address["house"]);
  const street = s(address["street"]);
  const loc = s(address["loc"]);
  const vtc = s(address["vtc"]);
  return {
    ...base,
    completed: true,
    status: "completed",
    full_name: s(source["full_name"]) || s(source["name"]),
    date_of_birth: s(source["dob"]) || s(source["date_of_birth"]),
    gender: /^m/i.test(s(source["gender"])) ? "Male" : /^f/i.test(s(source["gender"])) ? "Female" : s(source["gender"]),
    // DigiLocker usually returns a masked Aadhaar (XXXXXXXX1234) — never let a
    // partial number overwrite the full number the user typed in the form.
    aadhaar_number: (() => {
      const digits = s(source["aadhaar_number"]).replace(/\D/g, "");
      return digits.length === 12 ? digits : base.aadhaar_number;
    })(),
    address_line1: [house, street].filter(Boolean).join(", "),
    address_line2: [loc, vtc].filter(Boolean).join(", "),
    landmark: s(address["landmark"]),
    city: vtc || s(address["subdist"]),
    district: s(address["dist"]),
    state: s(address["state"]),
    pincode: s(source["zip"]) || s(address["zip"]),
    country: s(address["country"]) || "India",
    message: "Verified via DigiLocker",
  };
}

/** Request-scoped Supabase client (RLS as the signed-in staff user). */
type Db = { from: (table: string) => any };

/** Persisted cache so a DigiLocker download (one-shot at Surepass) can be replayed into the form. */
async function readCachedProfile(db: Db, clientId: string): Promise<DigilockerProfile | null> {
  try {
    const { data } = await db
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

async function writeCachedProfile(db: Db, clientId: string, profile: DigilockerProfile): Promise<void> {
  if (!profile.full_name) throw new Error("DigiLocker returned an empty Aadhaar profile");
  try {
    await db
      .from("digilocker_sessions")
      .upsert(
        { client_id: clientId, profile: JSON.parse(JSON.stringify(profile)), status: "completed", updated_at: new Date().toISOString() },
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

export const hasCompletedDigilockerVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits") }).parse(input),
  )
  .handler(async ({ data, context }): Promise<boolean> => {
    const { data: match, error } = await (context.supabase as unknown as Db)
      .from("digilocker_sessions")
      .select("client_id")
      .eq("status", "completed")
      .contains("profile", { aadhaar_number: data.aadhaar })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Boolean(match);
  });

export const startDigilockerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        redirectUrl: z.string().url(),
        aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
        mobile: z.string().regex(/^\d{10}$/).optional(),
        sendSms: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DigilockerSession> => {
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
    try {
      const pendingProfile: DigilockerProfile = {
        completed: false,
        status: "pending",
        full_name: "",
        date_of_birth: "",
        gender: "",
        aadhaar_number: data.aadhaar,
        address_line1: "",
        address_line2: "",
        landmark: "",
        city: "",
        district: "",
        state: "",
        pincode: "",
        country: "India",
        documents: [],
        message: "Waiting for the candidate to finish",
      };
      const { error } = await (context.supabase as unknown as Db).from("digilocker_sessions").upsert(
        { client_id: clientId, profile: pendingProfile, status: "pending", updated_at: new Date().toISOString() },
        { onConflict: "client_id" },
      );
      if (error) throw error;
    } catch (error) {
      console.error("[surepass] session registration failed", error);
      throw new Error("Could not securely register the DigiLocker session");
    }
    return {
      client_id: clientId,
      url,
      expiry_seconds: Number((d as { expiry_seconds?: unknown }).expiry_seconds) || null,
    };
  });

export const getDigilockerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().min(6).max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<DigilockerProfile> => {
    const db = context.supabase as unknown as Db;
    const registered = await readCachedProfile(db, data.clientId);
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
      aadhaar_number: /^\d{12}$/.test(registered?.aadhaar_number ?? "") ? registered?.aadhaar_number ?? "" : "",
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

    const statusPayload = findAadhaarPayload(st);
    if (statusPayload) {
      const profile = toDigilockerProfile(statusPayload, empty);
      if (profile.full_name) {
        await writeCachedProfile(db, data.clientId, profile);
        return profile;
      }
    }

    if (!completed) {
      // A cached profile means the download already succeeded earlier in this session.
      const cached = await readCachedProfile(db, data.clientId);
      return cached ?? empty;
    }

    // Surepass allows the Aadhaar download only once per client_id, so replay the cached copy.
    const cached = await readCachedProfile(db, data.clientId);
    if (cached && cached.full_name) return cached;

    // Polling requests can overlap. Claim the one-shot download in the database so only
    // one request reaches Surepass; the others wait briefly for its cached result.
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await db
      .from("digilocker_sessions")
      .update({ status: "downloading", updated_at: now })
      .eq("client_id", data.clientId)
      .eq("status", "pending")
      .select("client_id")
      .maybeSingle();
    if (claimError) throw claimError;

    if (!claimed) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const replay = await readCachedProfile(db, data.clientId);
        if (replay?.full_name) return replay;
      }
      throw new Error("DigiLocker details are still being secured. Click Fetch details now once more.");
    }

    let a: Record<string, unknown>;
    try {
      const aadhaar = await surepass<Record<string, unknown>>(
        `/api/v1/digilocker/download-aadhaar/${encodeURIComponent(data.clientId)}`,
        { method: "GET" },
      );
      const responseData = (aadhaar.data ?? {}) as Record<string, unknown>;
      const payload = findAadhaarPayload(responseData);
      if (!payload) throw new Error("DigiLocker completed, but Surepass returned no identity details");
      a = payload;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/already\s*download/i.test(detail)) {
        const replay = await readCachedProfile(db, data.clientId);
        if (replay && replay.full_name) return replay;
        await supabaseAdmin
          .from("digilocker_sessions")
          .update({ status: "consumed_without_profile", updated_at: new Date().toISOString() })
          .eq("client_id", data.clientId);
        throw new Error("This completed DigiLocker response was consumed before its details were saved. No further Aadhaar action is required from you; an administrator can recover this attempt with Surepass.");
      }
      await db
        .from("digilocker_sessions")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("client_id", data.clientId);
      throw error;
    }

    const profile = toDigilockerProfile(a, empty);

    if (!profile.full_name) {
      await db
        .from("digilocker_sessions")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("client_id", data.clientId);
      throw new Error("DigiLocker completed, but Surepass returned no identity details");
    }
    await writeCachedProfile(db, data.clientId, profile);
    return profile;
  });

export type PanComprehensiveResult = {
  verified: boolean;
  pan_number: string;
  pan_status: string;
  pan_type: string;
  full_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  father_name: string;
  date_of_birth: string;
  gender: string;
  category: string;
  email: string;
  mobile: string;
  aadhaar_linked: boolean;
  masked_aadhaar: string;
  address_line1: string;
  address_line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  message: string;
};

/** PAN Comprehensive (Surepass) — verifies the PAN and returns IT-record identity details. */
export const verifyPanComprehensive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pan: z
          .string()
          .transform((v) => v.trim().toUpperCase())
          .refine((v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), "PAN must look like ABCDE1234F"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PanComprehensiveResult> => {
    const json = await surepass<Record<string, unknown>>("/api/v1/pan/pan-comprehensive", {
      method: "POST",
      body: { id_number: data.pan },
    });
    const d = (json.data ?? {}) as Record<string, unknown>;
    const address = (d["address"] ?? {}) as Record<string, unknown>;
    const nameInfo = (d["name_information"] ?? d["full_name_split"] ?? {}) as Record<string, unknown>;
    const contact = (d["contact_details"] ?? {}) as Record<string, unknown>;
    const split = Array.isArray(d["full_name_split"]) ? (d["full_name_split"] as unknown[]).map(s) : [];

    const gender = s(d["gender"]);
    return {
      verified: Boolean(s(d["pan_number"])) || json.success === true,
      pan_number: s(d["pan_number"]) || data.pan,
      pan_status: s(d["pan_status"]) || s(d["status"]),
      pan_type: s(d["pan_type"]) || s(d["category"]),
      full_name: s(d["full_name"]) || s(nameInfo["full_name"]),
      first_name: s(nameInfo["first_name"]) || split[0] || "",
      middle_name: s(nameInfo["middle_name"]) || split[1] || "",
      last_name: s(nameInfo["last_name"]) || split[2] || "",
      father_name: s(d["father_name"]) || s(nameInfo["father_name"]),
      date_of_birth: s(d["dob"]) || s(d["date_of_birth"]),
      gender: /^m/i.test(gender) ? "Male" : /^f/i.test(gender) ? "Female" : gender,
      category: s(d["category"]),
      email: s(d["email"]) || s(contact["email"]),
      mobile: s(d["phone_number"]) || s(contact["mobile"]),
      aadhaar_linked: Boolean(d["aadhaar_linked"]) || /y/i.test(s(d["aadhaar_seeding_status"])),
      masked_aadhaar: s(d["masked_aadhaar"]) || s(d["aadhaar_number"]),
      address_line1: [s(address["line_1"]), s(address["line_2"])].filter(Boolean).join(", "),
      address_line2: s(address["street_name"]) || s(address["line_3"]),
      city: s(address["city"]),
      district: s(address["district"]) || s(address["city"]),
      state: s(address["state"]),
      pincode: s(address["zip"]) || s(address["pincode"]),
      country: s(address["country"]) || "India",
      message: s(json.message) || "PAN verified",
    };
  });
