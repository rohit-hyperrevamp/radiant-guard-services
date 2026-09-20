import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { useDialogDirty } from "@/components/ui/dialog";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, onCheckedChange, ...props }, ref) => {
  const { markDirty } = useDialogDirty();

  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=unchecked]:bg-muted-foreground/25",
        className,
      )}
      {...props}
      onCheckedChange={(checked) => {
        markDirty();
        onCheckedChange?.(checked);
      }}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-card shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
