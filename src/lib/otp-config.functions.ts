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
  async () => {
    // The saved MSG91_WIDGET_ID value turned out to be a widget token, not a
    // widget ID (MSG91 rejects it with "Widget Not Found"), so only accept
    // values that look like real widget IDs; otherwise use the built-in
    // default that pairs with the working widget token.
    const override = process.env["MSG91_WIDGET_ID"];
    const widgetId = override && /^[0-9a-f]{24,}$/i.test(override) ? override : DEFAULT_WIDGET_ID;
    return { widgetId };
  },
);
