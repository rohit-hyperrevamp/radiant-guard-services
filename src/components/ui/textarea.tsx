import * as React from "react";

import { cn } from "@/lib/utils";

const NO_CAP_MODES = new Set(["numeric", "decimal", "tel", "email", "url"]);

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, onChange, inputMode, autoCapitalize, ...props }, ref) => {
    const capOff =
      autoCapitalize === "off" || autoCapitalize === "none" || (inputMode && NO_CAP_MODES.has(inputMode));
    return (
      <textarea
        data-slot="textarea"
        autoCapitalize={autoCapitalize ?? (capOff ? undefined : "sentences")}
        onChange={(e) => {
          if (!capOff) {
            const el = e.target;
            const v = el.value;
            if (v) {
              const first = v.charAt(0);
              const up = first.toUpperCase();
              if (first !== up) el.value = up + v.slice(1);
            }
          }
          onChange?.(e);
        }}
        inputMode={inputMode}
        className={cn(
          "flex min-h-20 w-full resize-y rounded-lg border border-border/80 bg-card px-3 py-2.5 text-base shadow-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/55 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal hover:border-accent/50 focus-visible:border-accent focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/10 aria-invalid:border-destructive aria-invalid:ring-destructive/10 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-60 sm:min-h-24 sm:rounded-xl sm:px-3.5 sm:py-3 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
