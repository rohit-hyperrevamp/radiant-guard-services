/** Browser bridge for the MSG91 OTP widget used by the reference mobile app. */
const MSG91_WIDGET_ID = "356b71685561353436363635";
const MSG91_TOKEN_AUTH = "478181TOAfR90F2N691ae1eeP1";
const MSG91_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

type WidgetResult = {
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
      success: (data: unknown) => void,
      failure: (error: unknown) => void,
    ) => void;
    verifyOtp?: (
      otp: string,
      success: (data: unknown) => void,
      failure: (error: unknown) => void,
      reqId?: string,
    ) => void;
    retryOtp?: (
      channel: string,
      success: (data: unknown) => void,
      failure: (error: unknown) => void,
      reqId?: string,
    ) => void;
  }
}

let widgetReady: Promise<void> | undefined;

function messageFrom(error: unknown, fallback: string): string {
  return (error as WidgetError | undefined)?.message || fallback;
}

function waitForMethods(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (typeof window.sendOtp === "function") {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("SMS service is unavailable. Please try again."));
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  });
}

export function prepareMsg91(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SMS service requires a browser."));
  }
  if (typeof window.sendOtp === "function") return Promise.resolve();
  if (widgetReady) return widgetReady;

  widgetReady = new Promise<void>((resolve, reject) => {
    const initialize = async () => {
      if (typeof window.initSendOTP !== "function") {
        reject(new Error("SMS service is unavailable. Please try again."));
        return;
      }
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: true,
        success: () => undefined,
        failure: () => undefined,
      });
      try {
        await waitForMethods();
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MSG91_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (typeof window.initSendOTP === "function") void initialize();
      else existing.addEventListener("load", () => void initialize(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MSG91_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => void initialize(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("SMS service is unavailable. Please try again.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    widgetReady = undefined;
    throw error;
  });

  return widgetReady;
}

export async function sendMsg91Otp(phone: string): Promise<string | null> {
  await prepareMsg91();
  return new Promise((resolve, reject) => {
    const send = window.sendOtp;
    if (!send) {
      reject(new Error("SMS service is unavailable. Please try again."));
      return;
    }
    send(
      `91${phone}`,
      (value) => {
        const result = value as WidgetResult;
        resolve(result.request_id ?? result.reqId ?? result.message ?? null);
      },
      (error) => reject(new Error(messageFrom(error, "Could not send the code."))),
    );
  });
}

export async function resendMsg91Otp(reqId?: string | null): Promise<void> {
  await prepareMsg91();
  return new Promise((resolve, reject) => {
    const retry = window.retryOtp;
    if (!retry) {
      reject(new Error("SMS service is unavailable. Please try again."));
      return;
    }
    retry(
      "11",
      () => resolve(),
      (error) => reject(new Error(messageFrom(error, "Could not resend the code."))),
      reqId ?? undefined,
    );
  });
}

export async function verifyMsg91Otp(otp: string, reqId?: string | null): Promise<void> {
  await prepareMsg91();
  return new Promise((resolve, reject) => {
    const verify = window.verifyOtp;
    if (!verify) {
      reject(new Error("SMS service is unavailable. Please try again."));
      return;
    }
    verify(
      otp,
      () => resolve(),
      (error) => reject(new Error(messageFrom(error, "Wrong code. Please try again."))),
      reqId ?? undefined,
    );
  });
}