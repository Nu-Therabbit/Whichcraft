import { useId } from "react";
import { cn } from "../../lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
  /** A colour dot before the label, for choosing a colour. */
  swatch?: string;
  count?: number;
  disabled?: boolean;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
  /** Stretch each chip to share the row equally, centering its content. */
  stretch?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": label,
  className,
  stretch,
}: Props<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1", className)}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-sm font-medium whitespace-nowrap transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-canvas",
            opt.disabled && "opacity-40 cursor-not-allowed",
            value === opt.value ? "bg-selection text-fg" : "text-muted hover:bg-hover hover:text-fg",
            stretch && "flex-1 justify-center",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            disabled={opt.disabled}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          {opt.swatch && <span aria-hidden className="shell-swatch size-2.5 rounded-full" style={{ background: opt.swatch }} />}
          {opt.label}
          {opt.count !== undefined && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-hover text-dim leading-none">
              {opt.count}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
