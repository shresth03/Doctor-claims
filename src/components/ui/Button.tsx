import { forwardRef } from "react";
import { cx } from "../../lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--color-accent)] text-[#04201c] hover:bg-[var(--color-accent-dim)] disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-text-tertiary)]",
  secondary: "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]",
  ghost: "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
  danger: "bg-transparent border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)]",
  success: "bg-transparent border border-[var(--color-success)]/40 text-[var(--color-success)] hover:bg-[var(--color-success-dim)]",
};

const SIZE: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3.5 py-2 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});
