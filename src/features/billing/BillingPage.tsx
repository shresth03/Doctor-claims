import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bookmark, BookmarkPlus, Clock3, Search, X, XCircle } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { StatusPill, type Tone } from "../../components/ui/StatusPill";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { getSignOffBlockers } from "../../lib/claimRules";
import { cx, formatTimestamp, relativeTime } from "../../lib/utils";
import type { Claim, ClaimStatus } from "../../types";

const STATUS_TONE: Record<ClaimStatus, Tone> = {
  pending_review: "info",
  partially_reviewed: "warning",
  approved: "success",
  needs_correction: "danger",
  expired: "neutral",
  withdrawn: "neutral",
  submitted: "success",
};

const STATUS_LABEL: Record<ClaimStatus, string> = {
  pending_review: "Pending Review",
  partially_reviewed: "Partially Reviewed",
  approved: "Approved",
  needs_correction: "Rejected / Needs Correction",
  expired: "Expired",
  withdrawn: "Withdrawn",
  submitted: "Submitted",
};

type Readiness = "ready" | "blocked" | "awaiting" | "submitted" | "closed";
const READINESS_LABEL: Record<Readiness, string> = {
  ready: "Ready to submit",
  blocked: "Blocked",
  awaiting: "Awaiting review",
  submitted: "Submitted",
  closed: "Closed",
};
const READINESS_TONE: Record<Readiness, Tone> = { ready: "success", blocked: "danger", awaiting: "neutral", submitted: "success", closed: "neutral" };

function readinessOf(claim: Claim): Readiness {
  if (claim.status === "submitted") return "submitted";
  if (claim.status === "withdrawn" || claim.status === "expired") return "closed";
  const blockers = getSignOffBlockers(claim);
  if (blockers.length === 0) return "ready";
  return claim.codes.some((c) => c.decision === "pending") ? "awaiting" : "blocked";
}

interface Filters {
  query: string;
  status: ClaimStatus | "all";
  doctor: string;
  complexity: "all" | "high" | "standard";
  age: "all" | "24" | "48";
  payer: string;
  readiness: Readiness | "all";
}
const DEFAULT_FILTERS: Filters = { query: "", status: "all", doctor: "all", complexity: "all", age: "all", payer: "all", readiness: "all" };

interface SavedFilter {
  name: string;
  filters: Filters;
  builtIn?: boolean;
}
const BUILT_IN_VIEWS: SavedFilter[] = [
  { name: "Stuck > 24h", builtIn: true, filters: { ...DEFAULT_FILTERS, age: "24" } },
  { name: "Ready to submit", builtIn: true, filters: { ...DEFAULT_FILTERS, readiness: "ready" } },
  { name: "High complexity", builtIn: true, filters: { ...DEFAULT_FILTERS, complexity: "high" } },
];
const STORAGE_KEY = "claims.billing.savedFilters.v1";

function loadSaved(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilter[]) : [];
  } catch {
    return [];
  }
}
function persistSaved(list: SavedFilter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: saved views simply won't persist */
  }
}

type SortKey = "patient" | "draft" | "age" | "activity" | "status";
const PAGE_SIZE = 10;

export function BillingPage() {
  const claims = useAppStore((s) => s.claims);
  const auditTrail = useAppStore((s) => s.auditTrail);
  const withdrawRequest = useAppStore((s) => s.withdrawRequest);
  const expireRequest = useAppStore((s) => s.expireRequest);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "age", dir: "desc" });
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<SavedFilter[]>(loadSaved);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ claim: Claim; kind: "withdraw" | "expire" } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => persistSaved(saved), [saved]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const doctors = useMemo(() => [...new Set(claims.map((c) => c.doctorName))].sort(), [claims]);
  const payers = useMemo(() => [...new Set(claims.map((c) => c.payer))].sort(), [claims]);

  // Latest audit event per claim = "last activity". The trail is newest-first, so the first hit wins.
  const lastActivity = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of auditTrail) if (e.claimId && !map.has(e.claimId)) map.set(e.claimId, e.timestamp);
    return map;
  }, [auditTrail]);

  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = claims
      .map((c) => ({ claim: c, readiness: readinessOf(c), activity: lastActivity.get(c.id) ?? c.draftGeneratedAt }))
      .filter(({ claim: c }) => (filters.status === "all" ? true : c.status === filters.status))
      .filter(({ claim: c }) => (filters.doctor === "all" ? true : c.doctorName === filters.doctor))
      .filter(({ claim: c }) => (filters.payer === "all" ? true : c.payer === filters.payer))
      .filter(({ claim: c }) => {
        if (filters.complexity === "all") return true;
        const high = c.codes.some((code) => code.complexity === "high");
        return filters.complexity === "high" ? high : !high;
      })
      .filter(({ claim: c }) => (filters.age === "all" ? true : c.reviewAgeHours >= Number(filters.age)))
      .filter(({ readiness }) => (filters.readiness === "all" ? true : readiness === filters.readiness))
      .filter(({ claim: c }) => (q ? [c.patientName, c.id, c.visitId, c.doctorName].some((f) => f.toLowerCase().includes(q)) : true));

    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sort.key) {
        case "patient":
          return a.claim.patientName.localeCompare(b.claim.patientName) * dir;
        case "draft":
          return (new Date(a.claim.draftGeneratedAt).getTime() - new Date(b.claim.draftGeneratedAt).getTime()) * dir;
        case "activity":
          return (new Date(a.activity).getTime() - new Date(b.activity).getTime()) * dir;
        case "status":
          return a.claim.status.localeCompare(b.claim.status) * dir;
        default:
          return (a.claim.reviewAgeHours - b.claim.reviewAgeHours) * dir;
      }
    });
  }, [claims, filters, sort, lastActivity]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "patient" || key === "status" ? "asc" : "desc" }));
  }

  function saveCurrentView() {
    const name = savingName?.trim();
    if (!name) return;
    setSaved((list) => [...list.filter((s) => s.name !== name), { name, filters }]);
    setSavingName(null);
  }

  function confirmAction() {
    if (!actionTarget) return;
    if (actionTarget.kind === "withdraw") withdrawRequest(actionTarget.claim.id, reason.trim() || undefined);
    else expireRequest(actionTarget.claim.id, reason.trim() || undefined);
    setActionTarget(null);
    setReason("");
  }

  const selectCls = "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]/50";

  return (
    <div className="mx-auto max-w-[88rem] px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Billing operations queue</h1>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]" aria-live="polite">
        {rows.length} of {claims.length} claims in the draft-to-submission pipeline
      </p>

      {/* saved views */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
          <Bookmark size={11} /> Views
        </span>
        {[...BUILT_IN_VIEWS, ...saved].map((view) => {
          const active = JSON.stringify(view.filters) === JSON.stringify(filters);
          return (
            <span key={view.name} className="inline-flex items-center">
              <button
                onClick={() => {
                  setFilters(view.filters);
                  setPage(1);
                }}
                aria-pressed={active}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs transition",
                  active ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]",
                )}
              >
                {view.name}
              </button>
              {!view.builtIn && (
                <button onClick={() => setSaved((l) => l.filter((s) => s.name !== view.name))} aria-label={`Delete saved view ${view.name}`} className="-ml-1 rounded-full p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]">
                  <X size={11} />
                </button>
              )}
            </span>
          );
        })}
        {savingName === null ? (
          <button
            disabled={isDefault}
            onClick={() => setSavingName("")}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text)] disabled:opacity-40"
          >
            <BookmarkPlus size={12} /> Save current filters
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentView();
                if (e.key === "Escape") setSavingName(null);
              }}
              placeholder="View name"
              aria-label="Saved view name"
              className="w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] outline-none"
            />
            <button onClick={saveCurrentView} disabled={!savingName.trim()} className="text-xs text-[var(--color-accent)] disabled:opacity-40">
              Save
            </button>
            <button onClick={() => setSavingName(null)} className="text-xs text-[var(--color-text-tertiary)]">
              Cancel
            </button>
          </span>
        )}
      </div>

      {/* filters */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Patient, claim, visit or doctor…"
            aria-label="Search claims"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]/50"
          />
        </div>
        <select aria-label="Status" value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} className={selectCls}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as ClaimStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="Doctor" value={filters.doctor} onChange={(e) => set("doctor", e.target.value)} className={selectCls}>
          <option value="all">All doctors</option>
          {doctors.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select aria-label="Payer" value={filters.payer} onChange={(e) => set("payer", e.target.value)} className={selectCls}>
          <option value="all">All payers</option>
          {payers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select aria-label="Complexity" value={filters.complexity} onChange={(e) => set("complexity", e.target.value as Filters["complexity"])} className={selectCls}>
          <option value="all">Any complexity</option>
          <option value="high">High complexity</option>
          <option value="standard">Standard only</option>
        </select>
        <select aria-label="Review age" value={filters.age} onChange={(e) => set("age", e.target.value as Filters["age"])} className={selectCls}>
          <option value="all">Any age</option>
          <option value="24">Older than 24h</option>
          <option value="48">Older than 48h</option>
        </select>
        <select aria-label="Submission readiness" value={filters.readiness} onChange={(e) => set("readiness", e.target.value as Filters["readiness"])} className={selectCls}>
          <option value="all">Any readiness</option>
          {(Object.keys(READINESS_LABEL) as Readiness[]).map((r) => (
            <option key={r} value={r}>
              {READINESS_LABEL[r]}
            </option>
          ))}
        </select>
        {!isDefault && (
          <button
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
            className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text)] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
              <SortTh label="Patient / visit" k="patient" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 font-medium">Claim</th>
              <th className="px-4 py-3 font-medium">Doctor / payer</th>
              <SortTh label="Draft generated" k="draft" sort={sort} onSort={toggleSort} />
              <SortTh label="Review age" k="age" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 font-medium">Complexity</th>
              <th className="px-4 py-3 font-medium">Readiness</th>
              <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} />
              <SortTh label="Last activity" k="activity" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
                  No claims match these filters.
                </td>
              </tr>
            )}
            {paged.map(({ claim: c, readiness, activity }) => {
              const highComplexity = c.codes.some((code) => code.complexity === "high");
              const actionable = c.status === "pending_review" || c.status === "partially_reviewed" || c.status === "needs_correction";
              const stuck = actionable && c.reviewAgeHours > 24;
              return (
                <tr key={c.id} className="border-b border-[var(--color-border)] transition last:border-b-0 hover:bg-[var(--color-hover)]">
                  <td className="px-4 py-3">
                    <p className="text-[var(--color-text)]">{c.patientName}</p>
                    <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">{c.visitId}</p>
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-tertiary)]">{c.id}</td>
                  <td className="px-4 py-3">
                    <p className="whitespace-nowrap text-[var(--color-text-secondary)]">{c.doctorName}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">{c.payer}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">{formatTimestamp(c.draftGeneratedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cx("flex items-center gap-1 text-xs", stuck ? "text-[var(--color-warning)]" : "text-[var(--color-text-tertiary)]")}>
                      <Clock3 size={11} /> {Math.round(c.reviewAgeHours)}h{stuck && <span className="sr-only"> — over 24 hours</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={highComplexity ? "scrutiny" : "neutral"} className="px-1.5 py-0.5 text-[10px]">
                      {highComplexity ? "High" : "Standard"}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={READINESS_TONE[readiness]} className="px-1.5 py-0.5 text-[10px]">
                      {READINESS_LABEL[readiness]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[c.status]} className="px-1.5 py-0.5 text-[10px]">
                      {STATUS_LABEL[c.status]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">{relativeTime(activity)}</td>
                  <td className="px-4 py-3 text-right">
                    {actionable && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setActionTarget({ claim: c, kind: "withdraw" })}
                          className="rounded-md px-2 py-1 text-xs text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-text-secondary)]"
                        >
                          Withdraw
                        </button>
                        <button onClick={() => setActionTarget({ claim: c, kind: "expire" })} className="rounded-md px-2 py-1 text-xs text-[var(--color-danger)] transition hover:bg-[var(--color-danger-dim)]">
                          Expire
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 disabled:opacity-40">
            Previous
          </button>
          <button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>

      <Modal open={!!actionTarget} onClose={() => setActionTarget(null)} title={actionTarget?.kind === "withdraw" ? "Withdraw review request" : "Expire review request"}>
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {actionTarget?.kind === "withdraw"
            ? "This removes the claim from the doctor's active review queue but preserves the audit history."
            : "Mark this review request as expired because it is no longer actionable."}
        </p>
        {actionTarget && (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">
            {actionTarget.claim.id} · {actionTarget.claim.patientName} · {actionTarget.claim.doctorName}
          </p>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason…"
          aria-label="Reason (optional)"
          rows={2}
          className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActionTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={confirmAction}>
            Confirm {actionTarget?.kind}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SortTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th className="px-4 py-3 font-medium" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(k)} className={cx("inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-[var(--color-text-secondary)]", active && "text-[var(--color-text)]")}>
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
}
