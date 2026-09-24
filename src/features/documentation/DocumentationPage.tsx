import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { Countdown } from "../../components/ui/Countdown";
import { StatusPill, type Tone } from "../../components/ui/StatusPill";
import { EmptyState } from "../../components/ui/EmptyState";
import { RequestDetailDrawer } from "./RequestDetailDrawer";
import { formatTimestamp } from "../../lib/utils";
import type { DocRequestStatus, Priority } from "../../types";
import { Inbox } from "lucide-react";

const STATUS_TONE: Record<DocRequestStatus, Tone> = {
  new: "info",
  in_progress: "neutral",
  awaiting_document: "warning",
  ready_to_send: "success",
  submitted: "success",
  sla_breach: "danger",
};

const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", normal: "info", high: "warning", urgent: "danger" };

const STATUS_FILTERS: (DocRequestStatus | "all")[] = ["all", "new", "in_progress", "awaiting_document", "ready_to_send", "submitted", "sla_breach"];

export function DocumentationPage() {
  const docRequests = useAppStore((s) => s.docRequests);
  const [statusFilter, setStatusFilter] = useState<DocRequestStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return docRequests
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (query ? r.id.toLowerCase().includes(query.toLowerCase()) || r.claimId.toLowerCase().includes(query.toLowerCase()) || r.insurer.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [docRequests, statusFilter, query]);

  const selected = docRequests.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Documentation requests</h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{filtered.length} open insurer requests</p>
        </div>
        <div className="relative w-72">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests, claims, insurers…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]/50"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              statusFilter === s
                ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests match your filters" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Insurer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">SLA</th>
                <th className="px-4 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-white/[0.03] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text)]">{r.id}</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">Claim {r.claimId} · {formatTimestamp(r.receivedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.insurer}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.requestType}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={PRIORITY_TONE[r.priority]} className="px-1.5 py-0.5 text-[10px] capitalize">
                      {r.priority}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[r.status]} className="px-1.5 py-0.5 text-[10px] capitalize">
                      {r.status.replace(/_/g, " ")}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <Countdown dueAt={r.dueAt} className="text-xs" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-tertiary)]">{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RequestDetailDrawer request={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
