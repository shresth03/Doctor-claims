import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { AnimatedNumber } from "./AnimatedNumber";
import { cx } from "../../lib/utils";
import type { KpiPoint } from "../../types";

export type BreachState = "normal" | "approaching" | "breach";

export function KpiTile({
  label,
  value,
  decimals = 1,
  suffix = "%",
  breach,
  breachLabel,
  trend,
  trendDirectionGood,
  history,
  footnote,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  breach: BreachState;
  breachLabel: string;
  trend?: number;
  trendDirectionGood?: "up" | "down";
  history?: KpiPoint[];
  footnote?: string;
}) {
  // Breach state is carried by border color/weight and the tinted background alone — no glow or
  // blur. Color stays reserved for meaning here, not for atmosphere. Only one bg-* class is ever
  // present per state, so there's no same-specificity Tailwind class ordering to rely on.
  const stateClass =
    breach === "breach"
      ? "border-[var(--color-danger)] bg-[var(--color-danger-dim)]"
      : breach === "approaching"
        ? "border-[var(--color-warning)]/50 bg-[var(--color-surface)]"
        : "border-[var(--color-border)] bg-[var(--color-surface)]";

  const strokeColor = breach === "breach" ? "var(--color-danger)" : breach === "approaching" ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <div className={cx("relative overflow-hidden rounded-xl border p-5 transition-colors", stateClass)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</p>
        <BreachBadge breach={breach} label={breachLabel} />
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          suffix={suffix}
          className="font-[family-name:var(--font-display)] text-4xl font-semibold text-[var(--color-text)] font-tabular"
        />
        {trend !== undefined && <TrendBadge trend={trend} good={trendDirectionGood} />}
      </div>

      {footnote && <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{footnote}</p>}

      {history && history.length > 1 && (
        <div className="mt-4 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#grad-${label.replace(/\s/g, "")})`}
                isAnimationActive={false}
              />
              <RTooltip
                contentStyle={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border-strong)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={() => ""}
                formatter={(v) => [Number(v).toFixed(2), label]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BreachBadge({ breach, label }: { breach: BreachState; label: string }) {
  if (breach === "normal") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-tertiary)]">
        <CheckCircle2 size={13} className="text-[var(--color-success)]" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-xs font-medium",
        breach === "breach" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]",
      )}
    >
      <AlertTriangle size={13} />
      {label}
    </span>
  );
}

function TrendBadge({ trend, good }: { trend: number; good?: "up" | "down" }) {
  const isUp = trend > 0;
  const isGood = good ? (isUp ? good === "up" : good === "down") : true;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-xs font-medium", isGood ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
      {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
}
