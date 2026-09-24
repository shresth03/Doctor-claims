import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";

export function RegenerateDialog({
  open,
  onClose,
  onConfirm,
  claimId,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  claimId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Regenerate claim draft" width={440}>
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-dim)] px-3 py-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          A new draft will be generated from the signed note for claim <span className="font-[family-name:var(--font-mono)]">{claimId}</span>. Any existing
          approve/reject decisions on the current draft will be superseded, and every code will need to be reviewed again. The earlier draft stays in the audit trail.
        </p>
      </div>

      {error && <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleConfirm} loading={submitting}>
          {submitting ? "Regenerating…" : "Regenerate claim"}
        </Button>
      </div>
    </Modal>
  );
}
