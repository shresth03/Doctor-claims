import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { useAppStore } from "../../lib/store";
import { KpiTile } from "../../components/ui/KpiTile";
import { formatTimestamp } from "../../lib/utils";
import { toAiMatchRate } from "../../lib/claimRules";

const PERIODS = ["7d", "30d", "90d"] as const;

export function ObservabilityPage() {
  const kpi = useAppStore((s) => s.kpi);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");

  const matchRate = toAiMatchRate(kpi.doctorEditRate, kpi.doctorEditRateHistory);
  const denialBreach = kpi.denialRateCurrent > kpi.denialRateBaseline ? "breach" : "normal";
  const latencyBreach = kpi.latencyMedianHours > 24 ? "breach" : kpi.latencyMedianHours > 16 ? "approaching" : "normal";

  const sliceLen = period === "7d" ? 7 : period === "30d" ? 30 : kpi.latencyHistory.length;
  const latencyData = useMemo(() => kpi.latencyHistory.slice(-sliceLen), [kpi.latencyHistory, sliceLen]);

  const secondary = [
    { label: "Claims processed", value: kpi.claimsProcessed30d },
    { label: "Pending doctor reviews", value: kpi.pendingDoctorReviews },
    { label: "Regenerations", value: kpi.regenerationCount30d },
    { label: "Validation failures", value: kpi.validationFailures30d },
    { label: "SLA approaching", value: kpi.slaApproaching },
    { label: "Reconciliation discrepancies", value: kpi.reconciliationDiscrepancies },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Observability</h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Live pipeline health and the three metrics that matter</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === p ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile
          label="AI match rate"
          value={matchRate.value * 100}
          suffix="%"
          breach={matchRate.breach}
          breachLabel={matchRate.breach === "breach" ? "Below 80% — review model performance" : matchRate.breach === "approaching" ? "Approaching threshold" : "Model trusted"}
          trend={-2.3}
          trendDirectionGood="up"
          history={matchRate.history.slice(-sliceLen)}
          footnote={`${kpi.doctorEditRateSampleSize} codes sampled this period`}
        />
        <KpiTile
          label="Denial rate vs. baseline"
          value={kpi.denialRateCurrent * 100}
          suffix="%"
          breach={denialBreach}
          breachLabel={denialBreach === "breach" ? `+${((kpi.denialRateCurrent - kpi.denialRateBaseline) * 100).toFixed(1)} pp vs baseline` : "At or below baseline"}
          history={kpi.denialRateHistory.slice(-sliceLen)}
          footnote={`Baseline ${(kpi.denialRateBaseline * 100).toFixed(1)}% (pre-automation)`}
        />
        <KpiTile
          label="Signed → submitted latency"
          value={kpi.latencyMedianHours}
          decimals={1}
          suffix="h"
          breach={latencyBreach}
          breachLabel={latencyBreach === "breach" ? "Above 24h threshold" : "On pace"}
          history={kpi.latencyHistory.slice(-sliceLen)}
          footnote={`P90 ${kpi.latencyP90Hours.toFixed(1)}h`}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm font-medium text-[var(--color-text)]">Latency trend</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Hours from note signed to claim submitted</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatTimestamp(v).split(",")[0]} tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} interval={Math.ceil(sliceLen / 6)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} width={28} />
                <RTooltip
                  contentStyle={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border-strong)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => formatTimestamp(v as string)}
                  formatter={(v) => [`${Number(v).toFixed(1)}h`, "Latency"]}
                />
                <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm font-medium text-[var(--color-text)]">Pipeline volume</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Operational counters, current period</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {secondary.map((m) => (
              <div key={m.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-well)] px-3.5 py-3">
                <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-text)] font-tabular">{m.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-sm font-medium text-[var(--color-text)]">Doctor edit rate, by week</p>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpi.doctorEditRateHistory.slice(-sliceLen)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
              <XAxis dataKey="t" tickFormatter={(v) => formatTimestamp(v).split(",")[0]} tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} interval={Math.ceil(sliceLen / 6)} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} width={28} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <RTooltip
                contentStyle={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border-strong)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => formatTimestamp(v as string)}
                formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, "Edit rate"]}
              />
              <Bar dataKey="value" fill="var(--color-accent-dim)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
