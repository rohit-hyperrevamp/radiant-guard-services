import { useEffect } from "react";
import { confirmAction } from "@/components/ConfirmProvider";

/**
 * Global guard: any save/update/create action inside a form popup asks for a
 * confirmation first, so a mis-tap can never write data silently.
 *
 * Opt out on a specific button with data-no-confirm="true".
 */
const SAVE_LABEL =
  /^(save|update|create|add|submit|approve|apply|confirm and save|save changes|save &|send for approval|assign)\b/i;

const SKIP_LABEL =
  /^(cancel|close|back|next|previous|draft|delete|remove|discard|keep editing|reset|clear|search|export|download|print|upload|view|edit|select|browse|copy|retry|refresh|sign out|log out)\b/i;

export function SaveConfirmGuard() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      if (button.dataset.confirmed === "1") return;
      if (button.dataset.noConfirm === "true") return;
      if (button.getAttribute("aria-haspopup")) return;
      if (button.closest("[data-no-confirm='true']")) return;

      // Only guard actions inside form popups / sheets.
      const dialog = button.closest("[role='dialog']");
      if (!dialog) return;

      const label = (button.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!label || label.length > 40) return;
      if (SKIP_LABEL.test(label)) return;
      if (!SAVE_LABEL.test(label)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void confirmAction({
        title: "Save these changes?",
        description:
          "Your edits will be applied to this record. You can keep editing if you are not ready yet.",
        confirmText: "Yes, save",
        cancelText: "Keep editing",
      }).then((ok) => {
        if (!ok) return;
        button.dataset.confirmed = "1";
        button.click();
        window.setTimeout(() => {
          delete button.dataset.confirmed;
        }, 0);
      });
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
