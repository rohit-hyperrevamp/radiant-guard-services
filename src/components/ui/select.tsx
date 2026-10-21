"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDialogDirty, useDialogPortalContainer } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildSearchHay, compileSearch } from "@/lib/search-match";
import { ScrollingText } from "@/components/ScrollingText";

const SelectSearchContext = React.createContext<{
  query: string;
  setQuery: (query: string) => void;
  test: ReturnType<typeof compileSearch>;
} | null>(null);

function optionText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return optionText(node.props.children);
  return "";
}

function collectOptions(children: React.ReactNode): Array<{ value: string; text: string; disabled?: boolean }> {
  const options: Array<{ value: string; text: string; disabled?: boolean }> = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string; textValue?: string; disabled?: boolean; children?: React.ReactNode }>(child)) return;
    if (child.type === SelectItem && typeof child.props.value === "string") {
      options.push({ value: child.props.value, text: child.props.textValue ?? optionText(child.props.children), disabled: child.props.disabled });
    } else if (child.props.children) options.push(...collectOptions(child.props.children));
  });
  return options;
}

const Select = ({ onValueChange, onOpenChange, ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) => {
  const { markDirty } = useDialogDirty();
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const test = React.useMemo(() => compileSearch(deferredQuery), [deferredQuery]);
  const search = React.useMemo(() => ({ query, setQuery, test }), [query, test]);

  return (
    <SelectSearchContext.Provider value={search}>
    <SelectPrimitive.Root
      {...props}
      onOpenChange={(open) => {
        setQuery("");
        onOpenChange?.(open);
      }}
      onValueChange={(value) => {
        markDirty();
        onValueChange?.(value);
      }}
    />
    </SelectSearchContext.Provider>
  );
};

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    data-slot="select-trigger"
    ref={ref}
    className={cn(
      "flex h-10 w-full min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border border-border/80 bg-card px-3 py-1.5 text-base md:text-sm shadow-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-accent/50 data-[placeholder]:text-muted-foreground focus:border-accent focus:bg-card focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-60 [&>span]:min-w-0 [&>span:first-child]:flex-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & { searchable?: boolean; searchPlaceholder?: string }
>(({ className, children, position = "popper", searchable, searchPlaceholder = "Search…", ...props }, ref) => {
  const container = useDialogPortalContainer();
  const search = React.useContext(SelectSearchContext);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const options = React.useMemo(() => collectOptions(children), [children]);
  const indexed = React.useMemo(() => options.map((option) => ({ ...option, hay: buildSearchHay([option.text, option.value]) })), [options]);
  const showSearch = searchable ?? options.length > 10;
  const hasMatches = indexed.some((option) => !search?.test || search.test(option.hay));

  return (
    <SelectPrimitive.Portal container={container ?? undefined}>
      <SelectPrimitive.Content
        data-slot="select-content"
        ref={ref}
        className={cn(
          "relative z-[200] max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        collisionPadding={12}
        {...props}
        onKeyDownCapture={(event) => {
          props.onKeyDownCapture?.(event);
          if (event.defaultPrevented || !showSearch || event.target === inputRef.current || event.nativeEvent.isComposing) return;
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " ") {
            event.preventDefault();
            event.stopPropagation();
            search?.setQuery((search?.query ?? "") + event.key);
            inputRef.current?.focus();
          } else if (event.key === "ArrowUp") {
            const first = event.currentTarget.querySelector('[data-slot="select-item"]:not([data-disabled]):not([hidden])');
            if (event.target === first) {
              event.preventDefault();
              event.stopPropagation();
              inputRef.current?.focus();
            }
          }
        }}
      >
        {showSearch && search && (
          <div className="shrink-0 border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={inputRef} value={search.query} aria-label="Search options" placeholder={searchPlaceholder}
                className="h-9 pl-8" onChange={(event) => search.setQuery(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") return;
                  event.stopPropagation();
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const content = event.currentTarget.closest('[data-slot="select-content"]');
                    const items = content?.querySelectorAll<HTMLElement>('[data-slot="select-item"]:not([data-disabled]):not([hidden])');
                    const item = event.key === "ArrowDown" ? items?.[0] : items?.[items.length - 1];
                    item?.focus();
                  } else if (event.key === "Enter") event.preventDefault();
                  else if (event.key === "Tab") event.preventDefault();
                }} />
            </div>
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "max-h-[min(18rem,var(--radix-select-content-available-height))] overflow-y-auto overscroll-contain p-1",
            position === "popper" &&
              "w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
          {showSearch && !hasMatches && <p className="px-3 py-4 text-center text-sm text-muted-foreground" role="status">No matches.</p>}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, disabled, textValue, ...props }, ref) => {
  const search = React.useContext(SelectSearchContext);
  const text = textValue ?? optionText(children);
  const hay = React.useMemo(() => buildSearchHay([text, props.value]), [text, props.value]);
  const hidden = Boolean(search?.test && !search.test(hay));
  return (
  <SelectPrimitive.Item
    data-slot="select-item"
    ref={ref}
    hidden={hidden}
    disabled={disabled || hidden}
    textValue={text}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-2 pl-3 pr-8 text-base md:text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hidden:hidden [&>span]:break-words",
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText className="min-w-0 flex-1">
      {typeof children === "string" ? <ScrollingText text={children} /> : children}
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
