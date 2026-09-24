import { cx } from "../../lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "scrutiny";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-[var(--color-text-secondary)] border-white/10",
  success: "bg-[var(--color-success-dim)] text-[var(--color-success)] border-emerald-400/20",
  warning: "bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-amber-400/20",
  danger: "bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-rose-400/20",
  info: "bg-[var(--color-info-dim)] text-[var(--color-info)] border-blue-400/20",
  scrutiny: "bg-[var(--color-scrutiny-dim)] text-[var(--color-scrutiny)] border-purple-400/20",
};

export function StatusPill({
  tone = "neutral",
  children,
  icon,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const colorMap: Record<Tone, string> = {
    neutral: "bg-white/30",
    success: "bg-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]",
    danger: "bg-[var(--color-danger)]",
    info: "bg-[var(--color-info)]",
    scrutiny: "bg-[var(--color-scrutiny)]",
  };
  return <span className={cx("h-1.5 w-1.5 rounded-full", colorMap[tone])} />;
}
