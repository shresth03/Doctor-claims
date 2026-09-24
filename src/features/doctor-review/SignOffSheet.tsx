import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import type { Claim } from "../../types";

export function SignOffSheet({
  open,
  claim,
  onClose,
  onConfirm,
}: {
  open: boolean;
  claim: Claim;
  onClose: () => void;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, setState] = useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const approved = claim.codes.filter((c) => c.decision === "approved");
  const rejected = claim.codes.filter((c) => c.decision === "rejected");
  const edited = claim.codes.filter((c) => c.originalCode);
  const warnings = approved.flatMap((c) => c.validation.filter((v) => v.status === "warning").map((v) => ({ code: c.code, detail: v.detail ?? v.label })));

  async function handleConfirm() {
    setState("submitting");
    const result = await onConfirm();
    if (result.ok) {
      setState("submitted");
    } else {
      setState("failed");
      setError(result.error ?? "Submission failed.");
    }
  }

  function handleClose() {
    setState("idle");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={state === "submitting" ? () => {} : handleClose} title="Sign off & submit claim" width={520}>
      {state === "submitted" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={32} className="text-[var(--color-success)]" />
          <p className="text-sm font-medium text-[var(--color-text)]">Claim {claim.id} submitted</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Routed to the insurer clearinghouse via EDI 837.</p>
          <Button variant="secondary" size="sm" onClick={handleClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : state === "failed" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <XCircle size={32} className="text-[var(--color-danger)]" />
          <p className="text-sm font-medium text-[var(--color-text)]">Submission failed</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{error}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Retry submission
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 text-sm">
            <SummaryRow label="Approved codes" value={approved.length} tone="success" items={approved.map((c) => c.code)} />
            <SummaryRow label="Rejected codes" value={rejected.length} tone="danger" items={rejected.map((c) => c.code)} />
            {edited.length > 0 && <SummaryRow label="Edited / replaced" value={edited.length} tone="info" items={edited.map((c) => `${c.originalCode} → ${c.code}`)} />}

            {warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-dim)] px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
                <div className="text-xs text-[var(--color-text-secondary)]">
                  <p>{warnings.length} documentation warning{warnings.length > 1 ? "s" : ""} on approved codes:</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                    {warnings.map((w, i) => (
                      <li key={i}>
                        <span className="font-[family-name:var(--font-mono)]">{w.code}</span> — {w.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-tertiary)]">Final claim summary</p>
              <p className="mt-1 text-sm text-[var(--color-text)]">
                {claim.patientName} · {claim.id} · {approved.length} code(s) to submit
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={state === "submitting"}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} loading={state === "submitting"}>
              {state === "submitting" ? "Submitting…" : "Confirm & submit"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function SummaryRow({ label, value, tone, items }: { label: string; value: number; tone: "success" | "danger" | "info"; items: string[] }) {
  const toneClass = tone === "success" ? "text-[var(--color-success)]" : tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-info)]";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-2.5">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <div className="text-right">
        <span className={`font-[family-name:var(--font-mono)] font-medium ${toneClass}`}>{value}</span>
        {items.length > 0 && <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{items.join(", ")}</p>}
      </div>
    </div>
  );
}
