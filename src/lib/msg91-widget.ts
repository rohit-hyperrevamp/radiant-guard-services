const MSG91_WIDGET_ID = "356b71685561353436363635";
const MSG91_WIDGET_TOKEN = "478181TOAfR90F2N691ae1eeP1";
const MSG91_WIDGET_SCRIPT = "https://verify.msg91.com/otp-provider.js";

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
      success: (data: WidgetResult) => void,
      failure: (error: WidgetError) => void,
    ) => void;
    retryOtp?: (
      channel: string,
      success: (data: WidgetResult) => void,
      failure: (error: WidgetError) => void,
      requestId?: string,
    ) => void;
    verifyOtp?: (
      otp: string,
      success: (data: WidgetResult) => void,
      failure: (error: WidgetError) => void,
      requestId?: string,
    ) => void;
  }
}

let widgetPromise: Promise<void> | null = null;

function errorMessage(error: WidgetError, fallback: string) {
  return error.message || fallback;
}

function loadWidget(): Promise<void> {
  if (widgetPromise) return widgetPromise;

  widgetPromise = new Promise((resolve, reject) => {
    const initialize = () => {
      if (!window.initSendOTP) {
        reject(new Error("SMS service did not initialize. Please try again."));
        return;
      }
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_WIDGET_TOKEN,
        exposeMethods: true,
        success: () => undefined,
        failure: () => undefined,
      });

      const started = Date.now();
      const wait = window.setInterval(() => {
        if (typeof window.sendOtp === "function") {
          window.clearInterval(wait);
          resolve();
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(wait);
          reject(new Error("SMS service is still loading. Please try again."));
        }
      }, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MSG91_WIDGET_SCRIPT}"]`,
    );
    if (existing) {
      if (window.initSendOTP) initialize();
      else existing.addEventListener("load", initialize, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MSG91_WIDGET_SCRIPT;
    script.async = true;
    script.addEventListener("load", initialize, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("SMS service could not be loaded. Please try again.")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return widgetPromise;
}

export async function sendMsg91WidgetOtp(phone: string): Promise<string | null> {
  await loadWidget();
  if (!window.sendOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    window.sendOtp?.(
      `91${phone}`,
      (data) => resolve(data.request_id ?? data.reqId ?? data.message ?? null),
      (error) => reject(new Error(errorMessage(error, "Could not send the code. Please try again."))),
    );
  });
}

export async function retryMsg91WidgetOtp(requestId?: string | null): Promise<void> {
  await loadWidget();
  if (!window.retryOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    window.retryOtp?.(
      "11",
      () => resolve(),
      (error) => reject(new Error(errorMessage(error, "Could not resend the code."))),
      requestId ?? undefined,
    );
  });
}

export async function verifyMsg91WidgetOtp(
  otp: string,
  requestId?: string | null,
): Promise<string> {
  await loadWidget();
  if (!window.verifyOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    window.verifyOtp?.(
      otp,
      (data) => {
        const accessToken = data["access-token"] ?? data.accessToken ?? data.message;
        if (accessToken) resolve(accessToken);
        else reject(new Error("Verification failed. Please request a new code."));
      },
      (error) => reject(new Error(errorMessage(error, "Wrong code. Please try again."))),
      requestId ?? undefined,
    );
  });
}