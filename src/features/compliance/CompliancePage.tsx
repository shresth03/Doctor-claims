import { useState } from "react";
import { AlertOctagon, ChevronRight, ShieldCheck } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { StatusPill, type Tone } from "../../components/ui/StatusPill";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { formatPct, formatTimestamp } from "../../lib/utils";
import type { AuditQueueStatus, ComplianceAuditItem, Escalation, EscalationStatus } from "../../types";

const AUDIT_TONE: Record<AuditQueueStatus, Tone> = {
  selected: "neutral",
  in_review: "info",
  validated: "success",
  issue_found: "warning",
  escalated: "danger",
};

const ESCALATION_TONE: Record<EscalationStatus, Tone> = {
  open: "danger",
  investigating: "warning",
  assigned: "info",
  resolved: "success",
};

export function CompliancePage() {
  const complianceQueue = useAppStore((s) => s.complianceQueue);
  const escalations = useAppStore((s) => s.escalations);
  const [auditDetail, setAuditDetail] = useState<ComplianceAuditItem | null>(null);
  const [escalationDetail, setEscalationDetail] = useState<Escalation | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Compliance</h1>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Weekly audit sampling and confidently-wrong escalations</p>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-[var(--color-text-tertiary)]" />
          <h2 className="text-sm font-medium text-[var(--color-text)]">Weekly high-complexity audit queue</h2>
          <span className="text-xs text-[var(--color-text-tertiary)]">{complianceQueue.length} sampled</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {complianceQueue.map((item) => (
            <button
              key={item.id}
              onClick={() => setAuditDetail(item)}
              className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-border-strong)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-[var(--color-text)]">{item.code}</span>
                <StatusPill tone={AUDIT_TONE[item.status]} className="px-1.5 py-0.5 text-[10px] capitalize">
                  {item.status.replace(/_/g, " ")}
                </StatusPill>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">Claim {item.claimId} · {item.doctorName}</p>
              <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">{item.selectionReason}</p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
                <span>Doctor: {item.doctorDecision}</span>
                <ChevronRight size={13} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <AlertOctagon size={15} className="text-[var(--color-danger)]" />
          <h2 className="text-sm font-medium text-[var(--color-text)]">Immediate escalations</h2>
          <span className="text-xs text-[var(--color-text-tertiary)]">{escalations.filter((e) => e.status !== "resolved").length} open</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Error type</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {escalations.map((e) => (
                <tr key={e.id} onClick={() => setEscalationDetail(e)} className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-[var(--color-hover)] last:border-b-0">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--color-text)]">{e.code}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatPct(e.confidence, 0)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{e.errorType}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={e.severity === "critical" || e.severity === "high" ? "danger" : e.severity === "medium" ? "warning" : "neutral"} className="px-1.5 py-0.5 text-[10px] capitalize">
                      {e.severity}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={ESCALATION_TONE[e.status]} className="px-1.5 py-0.5 text-[10px] capitalize">
                      {e.status}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">{formatTimestamp(e.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Drawer open={!!auditDetail} onClose={() => setAuditDetail(null)} title={auditDetail?.code ?? ""} subtitle={auditDetail ? `Claim ${auditDetail.claimId}` : ""}>
        {auditDetail && (
          <div className="space-y-4 text-sm">
            <Field label="AI recommendation" value={auditDetail.aiProposal} />
            <Field label="Doctor decision" value={auditDetail.doctorDecision} />
            <Field label="Supporting evidence" value={`"${auditDetail.evidence}"`} italic />
            <Field label="Payer / rule" value={auditDetail.payerRule} />
            <Field label="Audit selection reason" value={auditDetail.selectionReason} />
            <Field label="Workflow version" value={auditDetail.workflowVersion} mono />
          </div>
        )}
      </Drawer>

      <Drawer open={!!escalationDetail} onClose={() => setEscalationDetail(null)} title={escalationDetail?.code ?? ""} subtitle={escalationDetail ? `Claim ${escalationDetail.claimId}` : ""}>
        {escalationDetail && (
          <div className="space-y-4 text-sm">
            <Field label="Claimed confidence" value={formatPct(escalationDetail.confidence, 0)} />
            <Field label="Error type" value={escalationDetail.errorType} />
            <Field label="Evidence used" value={`"${escalationDetail.evidence}"`} italic />
            <Field label="Final correction" value={escalationDetail.finalCorrection} />
            <Field label="Model / workflow" value={`${escalationDetail.model.model_name} · ${escalationDetail.model.workflow_version}`} mono />
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
              <Button size="sm" variant="secondary">Open Investigation</Button>
              <Button size="sm" variant="secondary">Assign</Button>
              <Button size="sm" variant="success">Resolve</Button>
              <Button size="sm" variant="ghost">Add Finding</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Field({ label, value, mono, italic }: { label: string; value: string; mono?: boolean; italic?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">{label}</p>
      <p className={`mt-1 text-[var(--color-text-secondary)] ${mono ? "font-[family-name:var(--font-mono)] text-xs" : ""} ${italic ? "italic" : ""}`}>{value}</p>
    </div>
  );
}
