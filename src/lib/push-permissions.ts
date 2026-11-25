/**
 * Recipients a non-admin may push to: only people holding a notification the
 * caller created whose title and message match the push exactly.
 */
export function pushRecipientsForCaller(
  callerNotifications: ReadonlyArray<{ user_id: string; title: string; message: string }>,
  title: string,
  message: string,
): string[] {
  const allowed = new Set<string>();
  for (const row of callerNotifications) {
    if (row.title === title && row.message === message) allowed.add(row.user_id);
  }
  return [...allowed];
}
