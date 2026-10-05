import { createServerFn } from "@tanstack/react-start";
import { WIDGET_ID } from "@/lib/otp-widget";

/**
 * Public widget configuration for the login page. The widget ID is not a
 * secret (it ships to every browser anyway); MSG91_WIDGET_ID overrides the
 * built-in default so the working account's widget can be swapped in without
 * a code change.
 */
export const getMsg91WidgetConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    widgetId: process.env["MSG91_WIDGET_ID"] || WIDGET_ID,
  }),
);
