/** MSG91's configured OTP Widget uses the account's default DLT template. */
const WIDGET_ID = "356b71685561353436363635";
const WIDGET_TOKEN = "478181TOAfR90F2N691ae1eeP1";
const WIDGET_SCRIPT_ID = "msg91-otp-provider";
const WIDGET_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

type WidgetPayload = {
  message?: string;
  request_id?: string;
  reqId?: string;
  "access-token"?: string;
  accessToken?: string;
};

type WidgetError = { message?: string };

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
    const initialize = () => {
      if (!window.initSendOTP) {
        reject(new Error("SMS service did not load. Please try again."));
        return;
      }
      window.initSendOTP({
        widgetId: WIDGET_ID,
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
    window.sendOtp?.(
      `91${phone}`,
      (data) => resolve(data.request_id ?? data.reqId ?? data.message ?? null),
      (error) => reject(new Error(messageOf(error, "Could not send the code. Please try again."))),
    );
  });
}

export async function retryWidgetOtp(requestId: string | null): Promise<string | null> {
  await loadMsg91Widget();
  if (!window.retryOtp || !requestId) return null;

  return new Promise((resolve, reject) => {
    window.retryOtp?.(
      "11",
      (data) => resolve(data.request_id ?? data.reqId ?? data.message ?? requestId),
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
        const accessToken = data["access-token"] ?? data.accessToken;
        if (accessToken) resolve(accessToken);
        else reject(new Error("OTP verification could not be confirmed. Please try again."));
      },
      (error) => reject(new Error(messageOf(error, "Wrong code. Please try again."))),
      requestId,
    );
  });
}