import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Stethoscope } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { ClaimQueueList } from "./ClaimQueueList";
import { NoteViewer } from "./NoteViewer";
import { CodeCard } from "./CodeCard";
import { LifecycleIndicator } from "./LifecycleIndicator";
import { SignOffSheet } from "./SignOffSheet";
import { RegenerateDialog } from "./RegenerateDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { ModelMetaTooltip } from "../../components/ui/Tooltip";
import { getSignOffBlockers, isClaimLocked } from "../../lib/claimRules";
import type { EvidenceSpan, RejectionReason } from "../../types";

export function DoctorReviewPage() {
  const claims = useAppStore((s) => s.claims);
  const selectedClaimId = useAppStore((s) => s.selectedClaimId);
  const selectClaim = useAppStore((s) => s.selectClaim);
  const decideCode = useAppStore((s) => s.decideCode);
  const editCode = useAppStore((s) => s.editCode);
  const regenerateClaim = useAppStore((s) => s.regenerateClaim);
  const signOffClaim = useAppStore((s) => s.signOffClaim);

  const [hoverSpan, setHoverSpan] = useState<EvidenceSpan | null>(null);
  const [pinnedCodeId, setPinnedCodeId] = useState<string | null>(null);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);


  const user = useAppStore((s) => s.user);
  const mine = claims.filter((c) => c.doctorName === user.name && c.status !== "withdrawn");
  const claim = mine.find((c) => c.id === selectedClaimId) ?? null;

  // Keep the selection inside the current doctor's own queue (also after a role switch).
  useEffect(() => {
    if (claim) return;
    const first = mine.find((c) => c.status === "pending_review" || c.status === "partially_reviewed") ?? mine[0];
    selectClaim(first ? first.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim, user.name, claims.length]);

  const pinnedSpan = claim?.codes.find((c) => c.id === pinnedCodeId)?.evidence ?? null;
  const activeSpan = hoverSpan ?? pinnedSpan;
  const blockers = claim ? getSignOffBlockers(claim) : [];
  const canSignOff = claim ? blockers.length === 0 : false;
  const locked = claim ? isClaimLocked(claim) : true;
  const anyWarningUnresolved = claim
    ? claim.codes.some((c) => c.decision === "approved" && c.validation.some((v) => v.status === "warning"))
    : false;
  const regenState = claim?.regeneration.state ?? "idle";
  const regenBusy = regenState === "requested" || regenState === "running";

  async function handleRegenerate() {
    if (!claim) return;
    await regenerateClaim(claim.id);
    setHoverSpan(null);
    setPinnedCodeId(null);
  }

  return (
    <div className="flex h-full">
      <ClaimQueueList selectedId={selectedClaimId} onSelect={(id) => { selectClaim(id); setHoverSpan(null); setPinnedCodeId(null); }} />

      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          {!claim ? (
            <motion.div key="empty" className="flex h-full items-center justify-center p-10">
              <EmptyState icon={Stethoscope} title="Select a claim to begin review" description="Choose a claim from the queue on the left." />
            </motion.div>
          ) : (
            <motion.div
              key={claim.id}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col"
            >
              {/* header */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">{claim.patientName}</h1>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-tertiary)]">{claim.id}</span>
                    <ModelMetaTooltip model={claim.model} />
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{claim.doctorName} · {claim.payer}</p>
                </div>
                <LifecycleIndicator stage={claim.stage} />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-2">
                <div className="min-h-0 overflow-hidden border-r border-[var(--color-border)]">
                  <NoteViewer claim={claim} activeSpan={activeSpan} />
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">AI-proposed codes</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{claim.codes.length} codes · individual decision required for each</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<RefreshCw size={13} className={regenBusy ? "animate-spin" : ""} />}
                      disabled={regenBusy}
                      onClick={() => setRegenOpen(true)}
                    >
                      {regenState === "requested" ? "Requesting…" : regenState === "running" ? "Regenerating…" : "Regenerate Claim"}
                    </Button>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                    {claim.codes.map((code) => (
                      <CodeCard
                        key={code.id}
                        code={code}
                        disabled={locked || regenBusy}
                        pinned={pinnedCodeId === code.id}
                        onPin={() => setPinnedCodeId((id) => (id === code.id ? null : code.id))}
                        onHover={setHoverSpan}
                        onDecide={(decision, reason?: RejectionReason, note?: string) => decideCode(claim.id, code.id, decision, reason, note)}
                        onEdit={(newCode) => void editCode(claim.id, code.id, newCode)}
                      />
                    ))}
                  </div>

                  <div className="border-t border-[var(--color-border)] px-6 py-4">
                    {anyWarningUnresolved && (
                      <p className="mb-2 text-[11px] text-[var(--color-warning)]">Some approved codes still carry a documentation warning.</p>
                    )}
                    <Button className="w-full" disabled={!canSignOff} onClick={() => setSignOffOpen(true)}>
                      {claim.status === "submitted" ? "Already submitted" : claim.stage === "submission" ? "Submitting…" : claim.stage === "failed" ? "Retry Sign Off & Submit" : "Sign Off & Submit"}
                    </Button>
                    {!canSignOff && blockers.length > 0 && claim.status !== "submitted" && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--color-text-tertiary)]" aria-label="Sign-off requirements">
                        {blockers.map((b) => (
                          <li key={b}>· {b}</li>
                        ))}
                      </ul>
                    )}
                    {claim.stage === "failed" && <p className="mt-2 text-[11px] text-[var(--color-danger)]">The last submission failed. Your decisions are preserved; you can retry.</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {claim && (
        <>
          <SignOffSheet open={signOffOpen} claim={claim} onClose={() => setSignOffOpen(false)} onConfirm={() => signOffClaim(claim.id)} />
          <RegenerateDialog open={regenOpen} onClose={() => setRegenOpen(false)} onConfirm={handleRegenerate} claimId={claim.id} />
        </>
      )}
    </div>
  );
}
