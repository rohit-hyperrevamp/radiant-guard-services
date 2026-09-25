import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyableIdProps {
  /** The ID value to copy. Renders nothing when empty. */
  value: string | null | undefined;
  /** Extra classes for the ID text itself. */
  className?: string;
  /** Accessible label, e.g. "Client ID". Defaults to "ID". */
  label?: string;
  /** Hide the copy icon until hover/focus (desktop lists). Default true. */
  revealOnHover?: boolean;
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Inline ID with a tap-to-copy affordance. Clicking the ID text or the icon
 * copies the raw value to the clipboard so it can be pasted into any filter
 * or search box.
 */
export function CopyableId({ value, className, label = "ID", revealOnHover = true }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!value) return;
      const ok = await writeToClipboard(value);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        toast.success(`${label} ${value} copied`);
      } else {
        toast.error(`Could not copy ${label.toLowerCase()}`);
      }
    },
    [value, label],
  );

  if (!value) return <span className={className}>—</span>;

  return (
    <span className="group/id inline-flex max-w-full items-center gap-1 align-middle">
      <button
        type="button"
        onClick={onCopy}
        title={`Copy ${label.toLowerCase()} ${value}`}
        aria-label={`Copy ${label.toLowerCase()} ${value}`}
        className={cn(
          "cursor-pointer font-mono text-xs font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent",
          className,
        )}
      >
        {value}
      </button>
      {copied ? (
        <Check className="h-3 w-3 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
      ) : (
        <Copy
          className={cn(
            "h-3 w-3 flex-shrink-0 cursor-pointer text-muted-foreground transition-opacity",
            revealOnHover ? "opacity-0 group-hover/id:opacity-100 focus-visible:opacity-100" : "opacity-70",
            "md:opacity-0 md:group-hover/id:opacity-100",
          )}
          onClick={onCopy}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
