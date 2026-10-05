import { createServerFn } from "@tanstack/react-start";

/** Built-in default MSG91 OTP Widget ID (the originally working widget). */
export const DEFAULT_WIDGET_ID = "356b71685561353436363635";

/**
 * Public widget configuration for the login page. The widget ID is not a
 * secret (it ships to every browser anyway); MSG91_WIDGET_ID overrides the
 * built-in default so the working account's widget can be swapped in without
 * a code change.
 */
export const getMsg91WidgetConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    widgetId: process.env["MSG91_WIDGET_ID"] || DEFAULT_WIDGET_ID,
  }),
);
