/**
 * Plain-language copy shared by form dialogs: the save/create confirmation
 * and the translation of raw database errors into something a user can act on.
 */

export type SaveConfirmCopy = {
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
};

const KEEP_EDITING = "Keep editing";

/** Lower-case the noun in a button label ("Create Organization" → "organization"). */
function nounFrom(rest: string): string {
  const cleaned = rest.replace(/[^\p{L}\p{N}\s/&-]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.toLowerCase() : "record";
}

/**
 * Confirmation wording for a save-style button, chosen from its label:
 * "Create client" → "Create this client?", "Save changes" → "Save changes?".
 * New records never claim edits will be "applied to this record".
 */
export function saveConfirmCopy(label: string): SaveConfirmCopy {
  const text = label.replace(/\s+/g, " ").trim();
  const create = /^(create|add)\b\s*(.*)$/i.exec(text);
  if (create) {
    const verb = create[1].toLowerCase() === "add" ? "Add" : "Create";
    const noun = nounFrom(create[2]);
    return {
      title: `${verb} this ${noun}?`,
      description: `A new ${noun} will be saved. You can keep editing if you are not ready yet.`,
      confirmText: `Yes, ${verb.toLowerCase()}`,
      cancelText: KEEP_EDITING,
    };
  }
  if (/^(submit|send for approval)\b/i.test(text)) {
    return {
      title: "Submit now?",
      description: "This will be sent on for the next step. You can keep editing if you are not ready yet.",
      confirmText: "Yes, submit",
      cancelText: KEEP_EDITING,
    };
  }
  if (/^approve\b/i.test(text)) {
    return {
      title: "Approve this?",
      description: "Your approval will be recorded. You can go back if you are not ready yet.",
      confirmText: "Yes, approve",
      cancelText: "Go back",
    };
  }
  if (/^assign\b/i.test(text)) {
    return {
      title: "Save this assignment?",
      description: "The assignment will be saved. You can keep editing if you are not ready yet.",
      confirmText: "Yes, assign",
      cancelText: KEEP_EDITING,
    };
  }
  return {
    title: "Save changes?",
    description: "Your edits will be applied to this record. You can keep editing if you are not ready yet.",
    confirmText: "Yes, save",
    cancelText: KEEP_EDITING,
  };
}

const TECHNICAL_HINT =
  /(violates|constraint|syntax|relation\s|column\s|function\s|requires a where clause|pgrst|sqlstate|jwt|rls|row-level security|null value in|invalid input|permission denied|duplicate key|foreign key|deadlock|statement timeout|canceling statement|failed to fetch|networkerror|load failed|\b\d{5}\b)/i;

/**
 * Turn a raw database / network error into plain language. Messages that are
 * already human-written (no technical markers) pass through unchanged.
 */
export function plainDbError(raw: string | null | undefined, what = "record"): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return `Could not save this ${what}. Please try again.`;
  if (/duplicate key|already exists|unique/i.test(msg)) {
    return /already exists/i.test(msg) && !TECHNICAL_HINT.test(msg)
      ? msg
      : `A ${what} with the same ID or name already exists.`;
  }
  if (/permission denied|row-level security|rls|not allowed|42501/i.test(msg)) {
    return `You do not have permission to save this ${what}. Ask an administrator for access.`;
  }
  if (/foreign key|23503/i.test(msg)) {
    return `This ${what} refers to something that no longer exists. Refresh the page and try again.`;
  }
  if (/null value in|not-null|23502/i.test(msg)) {
    return `Some required details are missing. Check the highlighted fields and try again.`;
  }
  if (/check constraint|invalid input|22P02|23514/i.test(msg)) {
    return `One of the values entered is not valid. Check the form and try again.`;
  }
  if (/failed to fetch|networkerror|load failed|network/i.test(msg)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (/timeout|canceling statement|57014/i.test(msg)) {
    return "The server took too long to respond. Please try again in a moment.";
  }
  if (/jwt|session|401/i.test(msg)) {
    return "Your session has expired. Sign in again, then retry.";
  }
  if (TECHNICAL_HINT.test(msg)) {
    return `Could not save this ${what} because of a system problem. Please try again, or contact support if it keeps happening.`;
  }
  return msg;
}
