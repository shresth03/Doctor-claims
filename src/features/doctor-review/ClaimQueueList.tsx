import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useAppStore } from "../../lib/store";
import { cx, relativeTime } from "../../lib/utils";
import { StatusPill } from "../../components/ui/StatusPill";
import type { Claim, ClaimStatus } from "../../types";
import { Search } from "lucide-react";

const STATUS_TONE: Record<ClaimStatus, { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }> = {
  pending_review: { tone: "info", label: "Pending review" },
  partially_reviewed: { tone: "warning", label: "Partially reviewed" },
  approved: { tone: "success", label: "Approved" },
  needs_correction: { tone: "danger", label: "Needs correction" },
  expired: { tone: "neutral", label: "Expired" },
  withdrawn: { tone: "neutral", label: "Withdrawn" },
  submitted: { tone: "success", label: "Submitted" },
};

export function ClaimQueueList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const claims = useAppStore((s) => s.claims);
  const user = useAppStore((s) => s.user);
  const [query, setQuery] = useState("");

  const queue = useMemo(() => {
    return claims
      .filter((c) => c.doctorName === user.name)
      .filter((c) => c.status !== "withdrawn")
      .filter((c) => (query ? c.patientName.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => {
        const rank = (c: Claim) => (c.status === "pending_review" ? 0 : c.status === "partially_reviewed" ? 1 : c.status === "needs_correction" ? 2 : 3);
        const scrutiny = (c: Claim) => (c.codes.some((code) => code.complexity === "high") ? 0 : 1);
        // Within the same actionability tier, extra-scrutiny claims surface first — a rushed doctor
        // shouldn't have to hunt for the high-complexity review buried under routine ones.
        return rank(a) - rank(b) || scrutiny(a) - scrutiny(b) || b.reviewAgeHours - a.reviewAgeHours;
      });
  }, [claims, user.name, query]);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] p-4">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-text)]">Review queue</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{queue.length} claims assigned to you</p>
        <div className="relative mt-3">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by patient or ID…"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {queue.map((c) => {
          const meta = STATUS_TONE[c.status];
          const isActive = c.id === selectedId;
          const highComplexity = c.codes.some((code) => code.complexity === "high");
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cx(
                "relative block w-full border-b border-[var(--color-border)] px-4 py-3.5 text-left transition-colors",
                isActive ? "bg-black/[0.055]" : "hover:bg-[var(--color-hover)]",
              )}
            >
              {isActive && (
                <motion.div layoutId="queue-active-rail" className="absolute left-0 top-0 h-full w-0.5 bg-[var(--color-accent)]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{c.patientName}</p>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-tertiary)]">{c.id}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <StatusPill tone={meta.tone} className="px-1.5 py-0.5 text-[10px]">
                  {meta.label}
                </StatusPill>
                {highComplexity && (
                  <StatusPill tone="scrutiny" className="px-1.5 py-0.5 text-[10px]">
                    Scrutiny
                  </StatusPill>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                {c.codes.length} codes · drafted {relativeTime(c.draftGeneratedAt)}
              </p>
            </button>
          );
        })}
        {queue.length === 0 && <p className="px-4 py-10 text-center text-xs text-[var(--color-text-tertiary)]">No claims match your filter.</p>}
      </div>
    </div>
  );
}
