import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { Claim, EvidenceSpan } from "../../types";
import { formatTimestamp } from "../../lib/utils";
import { FileText } from "lucide-react";

export function NoteViewer({ claim, activeSpan }: { claim: Claim; activeSpan: EvidenceSpan | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSpan) return;
    containerRef.current?.querySelector("mark")?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [activeSpan]);

  const segments = useMemo(() => {
    if (!activeSpan) return [{ text: claim.noteText, highlighted: false }];
    const { start, end } = activeSpan;
    return [
      { text: claim.noteText.slice(0, start), highlighted: false },
      { text: claim.noteText.slice(start, end), highlighted: true },
      { text: claim.noteText.slice(end), highlighted: false },
    ];
  }, [claim.noteText, activeSpan]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-4">
        <FileText size={15} className="text-[var(--color-text-tertiary)]" />
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Visit note</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            Signed {formatTimestamp(claim.noteSignedAt)} · {claim.facility}
          </p>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6">
        <p className="max-w-prose text-[15px] leading-8 text-[var(--color-text-secondary)]">
          {segments.map((seg, i) =>
            seg.highlighted ? (
              <motion.mark
                key={i}
                layout
                initial={{ backgroundColor: "rgba(94,234,212,0)" }}
                animate={{ backgroundColor: "rgba(94,234,212,0.18)" }}
                transition={{ duration: 0.3 }}
                className="rounded px-0.5 py-0.5 text-[var(--color-text)] ring-1 ring-[var(--color-accent)]/40"
              >
                {seg.text}
              </motion.mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-6 text-xs">
          <div>
            <p className="text-[var(--color-text-tertiary)]">Patient</p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">{claim.patientName} · {claim.patientId}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-tertiary)]">Payer</p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">{claim.payer}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-tertiary)]">Visit ID</p>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[var(--color-text-secondary)]">{claim.visitId}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-tertiary)]">Claim ID</p>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[var(--color-text-secondary)]">{claim.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
