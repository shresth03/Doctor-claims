import { useEffect, useState } from "react";
import { formatCountdown } from "../../lib/utils";
import { cx } from "../../lib/utils";

export function Countdown({ dueAt, className }: { dueAt: string; className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { label, urgency } = formatCountdown(dueAt, now);

  const toneClass =
    urgency === "critical"
      ? "text-[var(--color-danger)]"
      : urgency === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-text-secondary)]";

  return <span className={cx("font-[family-name:var(--font-mono)] text-sm tabular-nums", toneClass, className)}>{label}</span>;
}
