import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Search, GitCompare } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { StatusPill, type Tone } from "../../components/ui/StatusPill";
import { formatClock, formatTimestamp } from "../../lib/utils";
import type { AuditActorType, AuditEvent, Claim, ClaimVersion } from "../../types";

const ACTOR_TONE: Record<AuditActorType, Tone> = {
  system: "neutral",
  ai: "info",
  doctor: "scrutiny",
  billing_coordinator: "warning",
  compliance_officer: "success",
};

const PAGE_SIZE = 25;

export function AuditTrailPage() {
  const auditTrail = useAppStore((s) => s.auditTrail);
  const claims = useAppStore((s) => s.claims);
  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<AuditActorType | "all">("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const doctors = useMemo(() => [...new Set(claims.map((c) => c.doctorName))].sort(), [claims]);
  const actions = useMemo(() => [...new Set(auditTrail.map((e) => e.event))].sort(), [auditTrail]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return auditTrail
      .filter((e) => (actorFilter === "all" ? true : e.actorType === actorFilter))
      .filter((e) => (actionFilter === "all" ? true : e.event === actionFilter))
      .filter((e) => (doctorFilter === "all" ? true : (e.claimId && claimById.get(e.claimId)?.doctorName === doctorFilter) || e.actor === doctorFilter))
      .filter((e) => (from ? new Date(e.timestamp) >= new Date(`${from}T00:00:00`) : true))
      .filter((e) => (to ? new Date(e.timestamp) <= new Date(`${to}T23:59:59`) : true))
      .filter((e) =>
        q
          ? [e.claimId, e.visitId, e.patientId, e.code, e.actor, e.event, e.runId].some((f) => f?.toLowerCase().includes(q))
          : true,
      );
  }, [auditTrail, query, actorFilter, actionFilter, doctorFilter, from, to, claimById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Audit trail</h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
          <Lock size={10} /> Append-only · read-only
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{filtered.length} immutable events. Earlier versions are never overwritten.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-80">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Claim, visit, patient, code, actor, run ID…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]/50"
          />
        </div>
        <select
          value={actorFilter}
          onChange={(e) => {
            setActorFilter(e.target.value as AuditActorType | "all");
            setPage(1);
          }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none"
        >
          <option value="all">All actors</option>
          {Object.keys(ACTOR_TONE).map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={doctorFilter}
          onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}
          aria-label="Filter by doctor"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none"
        >
          <option value="all">All doctors</option>
          {doctors.map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          aria-label="Filter by action"
          className="max-w-[16rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none"
        >
          <option value="all">All actions</option>
          {actions.map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] outline-none [color-scheme:dark]" />
          <span>to</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] outline-none [color-scheme:dark]" />
        </div>
        {(actorFilter !== "all" || doctorFilter !== "all" || actionFilter !== "all" || from || to || query) && (
          <button onClick={() => { setActorFilter("all"); setDoctorFilter("all"); setActionFilter("all"); setFrom(""); setTo(""); setQuery(""); setPage(1); }} className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text)] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="absolute bottom-6 left-[27px] top-6 w-px bg-[var(--color-border)]" />
          <ul className="space-y-1">
            {paged.map((e) => {
              const active = selected?.id === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setSelected(e)}
                    className={`relative flex w-full items-start gap-4 rounded-lg px-2 py-2.5 text-left transition ${active ? "bg-black/[0.055]" : "hover:bg-[var(--color-hover)]"}`}
                  >
                    <span className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--color-surface)] ${active ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-tertiary)]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[var(--color-text)]">{e.event}</span>
                        <StatusPill tone={ACTOR_TONE[e.actorType]} className="px-1.5 py-0.5 text-[10px]">
                          {e.actorType.replace(/_/g, " ")}
                        </StatusPill>
                        {e.version && <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-tertiary)]">{e.version}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">
                        {e.actor} · <span className="font-[family-name:var(--font-mono)]">{e.entity}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">{formatClock(e.timestamp)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-tertiary)]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 disabled:opacity-40">
                Previous
              </button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22 }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Event detail</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{selected.event}</p>
              <dl className="mt-4 space-y-3 text-xs">
                <Row label="Event ID" value={selected.id} mono />
                <Row label="Timestamp" value={formatTimestamp(selected.timestamp)} />
                <Row label="Actor" value={`${selected.actor} (${selected.actorType.replace(/_/g, " ")})`} />
                <Row label="Entity" value={selected.entity} mono />
                {selected.claimId && <Row label="Claim" value={selected.claimId} mono />}
                {selected.visitId && <Row label="Visit" value={selected.visitId} mono />}
                {selected.patientId && <Row label="Patient" value={selected.patientId} mono />}
                <Row label="Workflow run" value={selected.runId} mono />
                {selected.version && <Row label="Claim version" value={selected.version} mono />}
              </dl>

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Structured metadata</p>
                  <dl className="mt-2 space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-well)] p-3 text-[11px]">
                    {Object.entries(selected.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <dt className="font-[family-name:var(--font-mono)] text-[var(--color-text-tertiary)]">{k}</dt>
                        <dd className="break-words text-right text-[var(--color-text-secondary)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {selected.previousValue && selected.newValue && (
                <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-well)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Change</p>
                  <div className="mt-2 flex items-center gap-2 font-[family-name:var(--font-mono)] text-sm">
                    <span className="rounded bg-[var(--color-danger-dim)] px-2 py-0.5 text-[var(--color-danger)] line-through">{selected.previousValue}</span>
                    <ArrowRight size={13} className="text-[var(--color-text-tertiary)]" />
                    <span className="rounded bg-[var(--color-success-dim)] px-2 py-0.5 text-[var(--color-success)]">{selected.newValue}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">Previous value → new value. The earlier value is retained in the log.</p>
                </div>
              )}

              {selected.claimId && claimById.get(selected.claimId) && <VersionHistory claim={claimById.get(selected.claimId)!} />}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-text-tertiary)]">
              Select an event to inspect its structured metadata.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className={`text-right text-[var(--color-text-secondary)] ${mono ? "font-[family-name:var(--font-mono)]" : ""}`}>{value}</dd>
    </div>
  );
}

function codeKey(c: ClaimVersion["codes"][number]) {
  return c.code;
}

function VersionHistory({ claim }: { claim: Claim }) {
  const versions = claim.versions;
  if (versions.length === 0) return null;
  const finalVersion = versions[versions.length - 1];
  const edits = finalVersion.codes.filter((c) => c.proposedCode && c.proposedCode !== c.code);

  return (
    <div className="mt-5 border-t border-[var(--color-border)] pt-4">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
        <GitCompare size={11} /> Version history · {claim.id}
      </p>

      {edits.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-well)] p-3">
          {edits.map((c) => (
            <div key={c.code} className="text-[11px]">
              <div className="flex items-center justify-between gap-2 font-[family-name:var(--font-mono)] text-xs">
                <span className="text-[var(--color-text-tertiary)]">AI proposed</span>
                <span className="rounded bg-[var(--color-surface-3)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">{c.proposedCode}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 font-[family-name:var(--font-mono)] text-xs">
                <span className="text-[var(--color-text-tertiary)]">Doctor changed</span>
                <span className="rounded bg-[var(--color-warning-dim)] px-1.5 py-0.5 text-[var(--color-warning)]">{c.code}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 font-[family-name:var(--font-mono)] text-xs">
                <span className="text-[var(--color-text-tertiary)]">Final</span>
                <span className="rounded bg-[var(--color-success-dim)] px-1.5 py-0.5 text-[var(--color-success)]">{c.code}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ol className="mt-3 space-y-2">
        {versions.map((v, i) => {
          const prev = i > 0 ? versions[i - 1] : null;
          const prevSet = new Set((prev?.codes ?? []).map(codeKey));
          const curSet = new Set(v.codes.map(codeKey));
          const removed = prev ? prev.codes.filter((c) => !curSet.has(c.code)) : [];
          return (
            <li key={v.label} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-mono)] text-xs font-medium text-[var(--color-text)]">{v.label}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">{formatTimestamp(v.createdAt)} · {v.createdBy}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 font-[family-name:var(--font-mono)] text-[11px]">
                {v.codes.map((c) => {
                  const added = prev && !prevSet.has(c.code);
                  return (
                    <span key={c.code} className={`rounded px-1.5 py-0.5 ${added ? "bg-[var(--color-success-dim)] text-[var(--color-success)]" : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]"}`}>
                      {added ? "+ " : ""}{c.code}
                    </span>
                  );
                })}
                {removed.map((c) => (
                  <span key={`r-${c.code}`} className="rounded bg-[var(--color-danger-dim)] px-1.5 py-0.5 text-[var(--color-danger)] line-through">
                    {c.code}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
