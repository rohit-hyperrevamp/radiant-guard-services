import { DEFAULT_WIDGET_ID, getMsg91WidgetConfig } from "@/lib/otp-config.functions";

/** MSG91's configured OTP Widget uses the account's default DLT template. */
export const WIDGET_ID = DEFAULT_WIDGET_ID;
export const WIDGET_TOKEN = "478181TOAfR90F2N691ae1eeP1";
const WIDGET_SCRIPT_ID = "msg91-otp-provider";
const WIDGET_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

type WidgetPayload = {
  type?: string;
  status?: string;
  message?: string;
  request_id?: string;
  reqId?: string;
  "access-token"?: string;
  accessToken?: string;
};

type WidgetError = { message?: string };

// Long enough for MSG91's own captcha check to be completed.
const WIDGET_CALLBACK_TIMEOUT_MS = 90_000;

declare global {
  interface Window {
    initSendOTP?: (configuration: Record<string, unknown>) => void;
    sendOtp?: (
      identifier: string,
      success: (data: WidgetPayload) => void,
      failure: (error: WidgetError) => void,
    ) => void;
    verifyOtp?: (
      otp: string,
      success: (data: WidgetPayload) => void,
      failure: (error: WidgetError) => void,
      requestId?: string,
    ) => void;
    retryOtp?: (
      channel: string,
      success: (data: WidgetPayload) => void,
      failure: (error: WidgetError) => void,
      requestId?: string,
    ) => void;
  }
}

let widgetPromise: Promise<void> | null = null;

function messageOf(error: WidgetError | undefined, fallback: string) {
  return error?.message || fallback;
}

export function loadMsg91Widget(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SMS is unavailable."));
  if (window.sendOtp && window.verifyOtp) return Promise.resolve();
  if (widgetPromise) return widgetPromise;

  widgetPromise = new Promise<void>((resolve, reject) => {
    const initialize = async () => {
      if (!window.initSendOTP) {
        reject(new Error("SMS service did not load. Please try again."));
        return;
      }
      let widgetId = WIDGET_ID;
      try {
        widgetId = (await getMsg91WidgetConfig()).widgetId || WIDGET_ID;
      } catch {
        // Fall back to the built-in widget ID.
      }
      window.initSendOTP({
        widgetId,
        tokenAuth: WIDGET_TOKEN,
        exposeMethods: true,
        success: () => undefined,
        failure: () => undefined,
      });

      const startedAt = Date.now();
      const wait = window.setInterval(() => {
        if (window.sendOtp && window.verifyOtp) {
          window.clearInterval(wait);
          resolve();
        } else if (Date.now() - startedAt > 10_000) {
          window.clearInterval(wait);
          reject(new Error("SMS service did not initialize. Please try again."));
        }
      }, 100);
    };

    const existing = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.initSendOTP) initialize();
      else existing.addEventListener("load", initialize, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", initialize, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("SMS service could not be loaded. Please try again.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    widgetPromise = null;
    throw error;
  });

  return widgetPromise;
}

export async function sendWidgetOtp(phone: string): Promise<string | null> {
  await loadMsg91Widget();
  if (!window.sendOtp) throw new Error("SMS service is unavailable. Please try again.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      callback();
    };
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error("SMS service did not respond. Please try again."))),
      WIDGET_CALLBACK_TIMEOUT_MS,
    );
    window.sendOtp?.(
      `91${phone}`,
      (data) => finish(() => resolve(data.request_id ?? data.reqId ?? null)),
      (error) => finish(() => reject(new Error(messageOf(error, "Could not send the code. Please try again.")))),
    );
  });
}

export async function retryWidgetOtp(requestId: string | null): Promise<string | null> {
  await loadMsg91Widget();
  if (!window.retryOtp || !requestId) return null;

  return new Promise((resolve, reject) => {
    window.retryOtp?.(
      "11",
      () => resolve(requestId),
      (error) => reject(new Error(messageOf(error, "Could not resend the code. Please try again."))),
      requestId,
    );
  });
}

export async function verifyWidgetOtp(otp: string, requestId: string | null): Promise<string> {
  await loadMsg91Widget();
  if (!window.verifyOtp || !requestId) throw new Error("OTP session expired. Request a new code.");

  return new Promise((resolve, reject) => {
    window.verifyOtp?.(
      otp,
      (data) => {
        // MSG91 currently returns the JWT in `message` after verifyOtp,
        // while older widget builds return `access-token`/`accessToken`.
        const accessToken =
          data["access-token"] ??
          data.accessToken ??
          (data.type?.toLowerCase() === "success" || data.status?.toLowerCase() === "success"
            ? data.message
            : undefined);
        if (accessToken) resolve(accessToken);
        else reject(new Error("OTP verification could not be confirmed. Please try again."));
      },
      (error) => reject(new Error(messageOf(error, "Wrong code. Please try again."))),
      requestId,
    );
  });
}