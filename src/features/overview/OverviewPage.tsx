import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, FileSearch, RefreshCw, ShieldAlert, Stethoscope } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { KpiTile } from "../../components/ui/KpiTile";
import { StatusPill } from "../../components/ui/StatusPill";
import { relativeTime } from "../../lib/utils";
import { ROLE_LABEL } from "../../app/shell/nav";

export function OverviewPage() {
  const user = useAppStore((s) => s.user);
  const kpi = useAppStore((s) => s.kpi);
  const claims = useAppStore((s) => s.claims);
  const docRequests = useAppStore((s) => s.docRequests);
  const escalations = useAppStore((s) => s.escalations);
  const auditTrail = useAppStore((s) => s.auditTrail);
  const navigate = useNavigate();

  const myPending = claims.filter((c) => c.doctorName === user.name && (c.status === "pending_review" || c.status === "partially_reviewed"));
  const slaRisk = docRequests.filter((r) => r.status === "sla_breach" || r.status === "new");
  const openEscalations = escalations.filter((e) => e.status !== "resolved");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-tertiary)]">{ROLE_LABEL[user.role]} workspace</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Welcome back, {user.name.split(" ").slice(-1)[0]}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Here's what's moving across the claims pipeline right now.</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile label="Doctor edit rate" value={kpi.doctorEditRate * 100} suffix="%" breach={kpi.doctorEditRate > 0.2 ? "breach" : kpi.doctorEditRate > 0.16 ? "approaching" : "normal"} breachLabel={kpi.doctorEditRate > 0.2 ? "Above threshold" : "Within range"} history={kpi.doctorEditRateHistory} footnote={`${kpi.doctorEditRateSampleSize} codes sampled`} />
        <KpiTile label="Denial rate vs. baseline" value={kpi.denialRateCurrent * 100} suffix="%" breach={kpi.denialRateCurrent > kpi.denialRateBaseline ? "breach" : "normal"} breachLabel={kpi.denialRateCurrent > kpi.denialRateBaseline ? "Above baseline" : "At or below baseline"} history={kpi.denialRateHistory} footnote={`Baseline ${(kpi.denialRateBaseline * 100).toFixed(1)}%`} />
        <KpiTile label="Signed → submitted latency" value={kpi.latencyMedianHours} suffix="h" decimals={1} breach={kpi.latencyMedianHours > 24 ? "breach" : kpi.latencyMedianHours > 16 ? "approaching" : "normal"} breachLabel={kpi.latencyMedianHours > 24 ? "Above 24h" : "On pace"} history={kpi.latencyHistory} footnote="Median across facility" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(user.role === "doctor" || user.role === "admin") && (
          <QuickCard
            icon={Stethoscope}
            title="Awaiting your review"
            value={myPending.length}
            description="Claims with pending code decisions"
            action={() => navigate("/doctor-review")}
            tone={myPending.length > 5 ? "warning" : "neutral"}
          />
        )}
        {(user.role === "billing" || user.role === "admin") && (
          <QuickCard
            icon={FileSearch}
            title="Documentation SLA risk"
            value={slaRisk.length}
            description="Insurer requests new or breaching SLA"
            action={() => navigate("/documentation")}
            tone={slaRisk.length > 0 ? "danger" : "neutral"}
          />
        )}
        {(user.role === "compliance" || user.role === "admin") && (
          <QuickCard
            icon={ShieldAlert}
            title="Open escalations"
            value={openEscalations.length}
            description="Confidently-wrong findings needing review"
            action={() => navigate("/compliance")}
            tone={openEscalations.length > 0 ? "danger" : "neutral"}
          />
        )}
        <QuickCard
          icon={RefreshCw}
          title="Regenerations (30d)"
          value={kpi.regenerationCount30d}
          description="Manual claim regenerations triggered"
          action={() => navigate("/observability")}
          tone="neutral"
        />
      </div>

      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <p className="text-sm font-medium text-[var(--color-text)]">Recent activity</p>
          <button onClick={() => navigate("/audit-trail")} className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
            View audit trail <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {auditTrail.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div className="flex items-center gap-3">
                <StatusPill tone={e.actorType === "ai" ? "info" : e.actorType === "doctor" ? "scrutiny" : "neutral"} className="px-1.5 py-0.5 text-[10px]">
                  {e.actorType.replace("_", " ")}
                </StatusPill>
                <span className="text-[var(--color-text-secondary)]">{e.event}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-tertiary)]">{e.entity}</span>
              </div>
              <span className="text-xs text-[var(--color-text-tertiary)]">{relativeTime(e.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  value,
  description,
  action,
  tone,
}: {
  icon: typeof Stethoscope;
  title: string;
  value: number;
  description: string;
  action: () => void;
  tone: "neutral" | "warning" | "danger";
}) {
  return (
    <button
      onClick={action}
      className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
    >
      <div className="flex w-full items-start justify-between">
        <span
          className={
            "flex h-9 w-9 items-center justify-center rounded-lg " +
            (tone === "danger" ? "bg-[var(--color-danger-dim)] text-[var(--color-danger)]" : tone === "warning" ? "bg-[var(--color-warning-dim)] text-[var(--color-warning)]" : "bg-white/5 text-[var(--color-text-secondary)]")
          }
        >
          <Icon size={16} />
        </span>
        <ArrowUpRight size={14} className="text-[var(--color-text-tertiary)] opacity-0 transition group-hover:opacity-100" />
      </div>
      <div>
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)] font-tabular">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{description}</p>
      </div>
    </button>
  );
}
