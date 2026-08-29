/** Browser bridge for the configured MSG91 OTP Widget used by the reference app. */
const MSG91_WIDGET_ID = "356b71685561353436363635";
const MSG91_TOKEN_AUTH = "478181TOAfR90F2N691ae1eeP1";
const MSG91_SCRIPT_ID = "msg91-otp-provider";
const MSG91_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

type Msg91WidgetPayload = {
  message?: string;
  request_id?: string;
  reqId?: string;
  "access-token"?: string;
  accessToken?: string;
};

type Msg91Window = Window & {
  initSendOTP?: (configuration: Record<string, unknown>) => void;
  sendOtp?: (
    identifier: string,
    success: (data: Msg91WidgetPayload) => void,
    failure: (error: Msg91WidgetPayload) => void,
  ) => void;
  retryOtp?: (
    channel: string,
    success: (data: Msg91WidgetPayload) => void,
    failure: (error: Msg91WidgetPayload) => void,
    requestId?: string,
  ) => void;
  verifyOtp?: (
    otp: string,
    success: (data: Msg91WidgetPayload) => void,
    failure: (error: Msg91WidgetPayload) => void,
    requestId?: string,
  ) => void;
};

let widgetReady: Promise<Msg91Window> | null = null;

function errorMessage(error: Msg91WidgetPayload, fallback: string): string {
  return error.message || fallback;
}

function loadMsg91Widget(): Promise<Msg91Window> {
  if (widgetReady) return widgetReady;

  widgetReady = new Promise((resolve, reject) => {
    const msg91Window = window as Msg91Window;
    const initialize = () => {
      if (!msg91Window.initSendOTP) {
        reject(new Error("SMS service did not load. Please try again."));
        return;
      }
      msg91Window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: true,
        success: () => undefined,
        failure: () => undefined,
      });

      const started = Date.now();
      const waitForMethods = window.setInterval(() => {
        if (typeof msg91Window.sendOtp === "function") {
          window.clearInterval(waitForMethods);
          resolve(msg91Window);
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(waitForMethods);
          widgetReady = null;
          reject(new Error("SMS service is unavailable. Please try again."));
        }
      }, 100);
    };

    const existing = document.getElementById(MSG91_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (msg91Window.initSendOTP) initialize();
      else existing.addEventListener("load", initialize, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MSG91_SCRIPT_ID;
    script.src = MSG91_SCRIPT_URL;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => {
      widgetReady = null;
      reject(new Error("SMS service could not be loaded. Please try again."));
    };
    document.head.appendChild(script);
  });

  return widgetReady;
}

export async function sendMsg91Otp(phone: string): Promise<string | null> {
  const msg91 = await loadMsg91Widget();
  if (!msg91.sendOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    msg91.sendOtp?.(
      `91${phone}`,
      (data) => resolve(data.request_id ?? data.reqId ?? data.message ?? null),
      (error) => reject(new Error(errorMessage(error, "Could not send the code. Please try again."))),
    );
  });
}

export async function resendMsg91Otp(requestId?: string | null): Promise<void> {
  const msg91 = await loadMsg91Widget();
  if (!msg91.retryOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    msg91.retryOtp?.(
      "11",
      () => resolve(),
      (error) => reject(new Error(errorMessage(error, "Could not resend the code."))),
      requestId ?? undefined,
    );
  });
}

export async function verifyMsg91Otp(otp: string, requestId?: string | null): Promise<string> {
  const msg91 = await loadMsg91Widget();
  if (!msg91.verifyOtp) throw new Error("SMS service is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    msg91.verifyOtp?.(
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