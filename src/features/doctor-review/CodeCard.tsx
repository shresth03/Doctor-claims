import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Ban, Check, CheckCircle2, CircleSlash, Loader2, Pencil, ShieldAlert, X, XCircle } from "lucide-react";
import type { ProposedCode, RejectionReason, ValidationStatus } from "../../types";
import { cx, formatPct } from "../../lib/utils";
import { approvalBlocker } from "../../lib/claimRules";
import { StatusPill } from "../../components/ui/StatusPill";

export const REASON_LABEL: Record<RejectionReason, string> = {
  unsupported_by_documentation: "Unsupported by documentation",
  incorrect_code: "Incorrect code",
  incorrect_complexity: "Incorrect complexity",
  duplicate: "Duplicate",
  other: "Other",
};

const VALIDATION_META: Record<ValidationStatus, { icon: typeof Check; className: string; word: string }> = {
  passed: { icon: Check, className: "text-[var(--color-success)]", word: "Passed" },
  failed: { icon: X, className: "text-[var(--color-danger)]", word: "Failed" },
  warning: { icon: AlertTriangle, className: "text-[var(--color-warning)]", word: "Warning" },
  unavailable: { icon: CircleSlash, className: "text-[var(--color-text-tertiary)]", word: "Unavailable" },
};

export function CodeCard({
  code,
  disabled,
  pinned,
  onHover,
  onPin,
  onDecide,
  onEdit,
}: {
  code: ProposedCode;
  /** claim is locked, submitting or regenerating */
  disabled: boolean;
  pinned: boolean;
  onHover: (evidence: ProposedCode["evidence"] | null) => void;
  onPin: () => void;
  onDecide: (decision: "approved" | "rejected", reason?: RejectionReason, note?: string) => void;
  onEdit: (newCode: string) => void;
}) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState<RejectionReason>("unsupported_by_documentation");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(code.code);
  const [pulse, setPulse] = useState(0);

  const highComplexity = code.complexity === "high";
  const blocker = approvalBlocker(code);
  const decided = code.decision !== "pending";
  const canEdit = !disabled && !code.revalidating && code.decision !== "approved";

  function handleApprove() {
    if (blocker || disabled) return;
    setPulse((p) => p + 1);
    onDecide("approved");
  }

  function confirmReject() {
    onDecide("rejected", reason, note.trim() || undefined);
    setShowReason(false);
    setNote("");
  }

  function commitEdit() {
    setEditing(false);
    if (editValue.trim() && editValue.trim().toUpperCase() !== code.code) onEdit(editValue);
    else setEditValue(code.code);
  }

  // High-volume review: a doctor going through dozens of cards a day shouldn't have to reach for
  // the mouse for every one. Scoped to this card's own focus, and bows out of text entry entirely
  // so typing a replacement code never gets intercepted as a shortcut.
  function handleCardKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (editing || showReason || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || disabled) return;
    if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      handleApprove();
    } else if ((e.key === "r" || e.key === "R") && !code.revalidating) {
      e.preventDefault();
      setShowReason(true);
    } else if ((e.key === "e" || e.key === "E") && canEdit) {
      e.preventDefault();
      setEditValue(code.code);
      setEditing(true);
    }
  }

  return (
    <motion.div
      layout
      onMouseEnter={() => onHover(code.evidence)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(code.evidence)}
      onBlur={() => onHover(null)}
      onClick={onPin}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={`Proposed code ${code.code}, ${code.description}. Keyboard: A to approve, R to reject, E to replace.`}
      className={cx(
        "relative rounded-xl border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
        pinned && "ring-1 ring-[var(--color-accent)]/50",
        code.quarantined && "border-[var(--color-danger)]/40 bg-[var(--color-danger-dim)]/25",
        !code.quarantined && code.decision === "approved" && "border-[var(--color-success)]/30 bg-[var(--color-success-dim)]/40",
        !code.quarantined && code.decision === "rejected" && "border-[var(--color-danger)]/30 bg-[var(--color-danger-dim)]/30 opacity-90",
        !code.quarantined && code.decision === "pending" && highComplexity && "border-[var(--color-scrutiny)]/40 bg-[var(--color-scrutiny-dim)]/20",
        !code.quarantined && code.decision === "pending" && !highComplexity && "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <AnimatePresence>
        {pulse > 0 && (
          <motion.div
            key={pulse}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.04 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[var(--color-success)]"
          />
        )}
      </AnimatePresence>

      {code.quarantined && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-dim)] px-3 py-2" role="alert">
          <Ban size={14} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-danger)]">Quarantined</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
              Required documentation evidence could not be verified. This code cannot be approved; reject it or replace it.
            </p>
          </div>
        </div>
      )}

      {highComplexity && (
        <div className="mb-3 rounded-lg border border-[var(--color-scrutiny)]/35 bg-[var(--color-scrutiny-dim)]/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="shrink-0 text-[var(--color-scrutiny)]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-scrutiny)]">Extra scrutiny · High-complexity review</p>
            {decided && <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">explicit decision recorded</span>}
          </div>
          {!decided && (
            <dl className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Why the threshold triggered</dt>
                <dd className="text-[var(--color-text-secondary)]">{code.complexityReason}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Documentation requirement</dt>
                <dd className="text-[var(--color-text-secondary)]">The note must independently support the documented level of complexity. Review the highlighted evidence before deciding.</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={editValue}
              aria-label="Replacement code"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setEditValue(code.code);
                  setEditing(false);
                }
              }}
              className="w-24 rounded border border-[var(--color-accent)]/50 bg-[var(--color-surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--color-text)] outline-none"
            />
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--color-text)]">{code.code}</span>
          )}
          <StatusPill tone={code.category === "CPT" ? "info" : "neutral"} className="px-1.5 py-0.5 text-[10px]">
            {code.category}
          </StatusPill>
          {highComplexity && (
            <StatusPill tone="scrutiny" className="px-1.5 py-0.5 text-[10px]">
              High complexity
            </StatusPill>
          )}
          {code.originalCode && <span className="text-[10px] text-[var(--color-text-tertiary)]">AI proposed {code.originalCode}</span>}
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]"
          title="Model confidence is not a measure of correctness. Color indicates how many codes reviewed today fall in this range, not whether this one is right."
        >
          <span>Model confidence</span>
          {/* Scannable at a glance across dozens of cards, not just readable one at a time. */}
          <span className={cx("h-1.5 w-1.5 rounded-full", code.confidence >= 0.9 ? "bg-[var(--color-success)]" : code.confidence >= 0.7 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]")} />
          <span className="font-tabular font-medium text-[var(--color-text-secondary)]">{formatPct(code.confidence, 0)}</span>
        </div>
      </div>

      <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">{code.description}</p>

      <div className={cx("mt-3 rounded-lg px-3 py-2", highComplexity ? "bg-[var(--color-scrutiny-dim)]/30 ring-1 ring-[var(--color-scrutiny)]/30" : "bg-[var(--color-well)]")}>
        <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Supporting evidence · note characters {code.evidence.start}–{code.evidence.end}
        </p>
        <p className={cx("mt-1 leading-relaxed text-[var(--color-text-secondary)]", highComplexity ? "text-[13px] font-medium text-[var(--color-text)]" : "text-xs italic")}>“{code.evidence.excerpt}”</p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Validation results">
        {code.validation.map((gate) => {
          const meta = VALIDATION_META[gate.status];
          const Icon = meta.icon;
          return (
            <li key={gate.key} className={cx("inline-flex items-center gap-1 text-[11px]", meta.className)} title={gate.detail}>
              {code.revalidating ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
              <span>{gate.label}</span>
              <span className="sr-only">: {meta.word}</span>
            </li>
          );
        })}
      </ul>
      {code.validation.some((g) => g.detail && g.status !== "passed") && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">{code.validation.find((g) => g.detail && g.status !== "passed")?.detail}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        {!decided ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={!!blocker || disabled}
              aria-label={`Approve code ${code.code}`}
              title={blocker ?? undefined}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-success)]/15 px-3 py-1.5 text-xs font-medium text-[var(--color-success)] transition hover:bg-[var(--color-success)]/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--color-success)]/15"
            >
              <CheckCircle2 size={14} /> Approve
            </button>
            <button
              onClick={() => setShowReason((v) => !v)}
              disabled={disabled || code.revalidating}
              aria-label={`Reject code ${code.code}`}
              aria-expanded={showReason}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <XCircle size={14} /> Reject
            </button>
            {canEdit && (
              <button
                onClick={() => {
                  setEditValue(code.code);
                  setEditing(true);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]"
                aria-label={`Replace code ${code.code}`}
                title="Replace code"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {code.decision === "approved" ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                <CheckCircle2 size={14} /> Approved
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]">
                <XCircle size={14} /> Rejected{code.rejectionReason && ` — ${REASON_LABEL[code.rejectionReason]}`}
              </span>
            )}
            {!disabled && (
              <button
                onClick={() => (code.decision === "approved" ? setShowReason(true) : handleApprove())}
                disabled={code.decision === "rejected" && !!blocker}
                title={code.decision === "rejected" ? (blocker ?? undefined) : undefined}
                className="text-[11px] text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-secondary)] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
              >
                Change to {code.decision === "approved" ? "reject" : "approve"}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => {
                  setEditValue(code.code);
                  setEditing(true);
                }}
                className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-secondary)] hover:underline"
              >
                <Pencil size={11} /> Replace code
              </button>
            )}
          </div>
        )}
        {blocker && !decided && <p className="basis-full text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">{blocker}</p>}
      </div>

      <AnimatePresence>
        {showReason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <label className="text-[11px] text-[var(--color-text-tertiary)]" htmlFor={`reason-${code.id}`}>
                Reason for rejection
              </label>
              <select
                id={`reason-${code.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value as RejectionReason)}
                className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] outline-none"
              >
                {Object.entries(REASON_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {reason === "other" && (
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe the reason"
                  aria-label="Rejection note"
                  className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
              )}
              <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">You can replace the code with a different one after rejecting it.</p>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setShowReason(false)} className="rounded-md px-2.5 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={reason === "other" && !note.trim()}
                  className="rounded-md bg-[var(--color-danger)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25 disabled:opacity-40"
                >
                  Confirm rejection
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
