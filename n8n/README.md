# n8n backend for the claims review platform

This is the orchestration layer the frontend (`../src/api/`) expects. It implements every workflow
described in the product spec: draft generation, doctor sign-off, regeneration with a concurrency lock,
insurer documentation requests, the stuck-draft/SLA/reconciliation crons, and KPI refresh.

## Pieces

| Path | What it is |
|---|---|
| `schema.sql` | Postgres schema: dedup keys, regeneration locks, claims + immutable draft/submission versions, audit log (append-only, enforced by trigger), doc requests, notifications. |
| `workflows/*.json` | 10 n8n workflows, importable as-is. |
| `event-relay/` | A ~150-line Node server that bridges n8n (request/response) to the frontend's SSE `api.subscribe()`. n8n POSTs events to it; the frontend connects to `/events/stream`. |
| `.env.example` | Every environment variable the workflows reference, plus the credential names n8n needs configured. |

## Workflow map

| # | File | Trigger | Mirrors |
|---|---|---|---|
| 00 | `00-draft-core.json` | Sub-workflow (called by 01 and 03) | Fetch → pre-flight validate → AI extract → catalog/rules → build+validate draft → persist → audit → notify |
| 01 | `01-visit-note-signed.json` | Webhook `claims/visit-note-signed` | "Webhook: Visit note signed" |
| 02 | `02-doctor-callback-submit.json` | Webhook `claims/doctor-callback` | Doctor callback → final validation → EDI 837 submission → audit → KPI feed |
| 03 | `03-regenerate-claim.json` | Webhook `claims/regenerate` | "Webhook: Doctor clicks Regenerate Claim", with the concurrency lock |
| 04 | `04-insurer-doc-request.json` | Webhook `claims/insurer-doc-request` | "Webhook: Insurer documentation request received" |
| 05 | `05-stuck-draft-reminder-cron.json` | Every 30 min | Stuck draft reminder (>24h) |
| 06 | `06-sla-sweep-cron.json` | Every 15 min | "Cron: SLA timer sweep", + Slack/email at 5+ days |
| 07 | `07-validate-replacement-code.json` | Webhook `claims/validate-code` | Re-validates a doctor-entered replacement code |
| 08 | `08-nightly-reconciliation-cron.json` | Nightly 02:00 | "Cron: Nightly reconciliation of signed visits vs drafted claims" |
| 09 | `09-kpi-refresh-cron.json` | Every 5 min | Feeds the Observability KPIs |

Workflow 00 is a **sub-workflow**: workflows 01 and 03 both call it via Execute Workflow, so the
extraction → validation → draft-building logic lives in exactly one place. After importing, open
01 and 03 and repoint their "Run draft core" node at 00's real workflow ID if n8n reassigns it (it
won't, if you import with `--separate`, since 00 carries a fixed `id`).

## Design decisions the frontend depends on

- **The AI layer is provider-agnostic.** The "AI extraction adapter" node calls one HTTP endpoint
  (`AI_EXTRACTION_URL`) with a fixed request/response contract. Swap models by pointing that URL
  elsewhere; no workflow or frontend code changes. `model_provider/name/version` only ever end up in
  audit metadata and the `ModelMetadata` tooltip — never in a status label or button.
- **Evidence is verified server-side, not trusted from the model.** "Build draft claim" locates each
  AI-cited quote in the actual signed note text (exact match, falling back to whitespace-tolerant
  fuzzy match) and snaps it to full sentence boundaries. A quote that isn't found in the note fails
  the `documentation_requirement` gate — the AI cannot self-report unverifiable evidence as valid.
- **Missing ≠ passed.** Every validation gate defaults to `unavailable` with a detail string when a
  dependency doesn't respond, never `passed`. Same rule in "Finalize validation" on the doctor callback.
- **The regeneration lock is atomic in SQL**, not "check then set" — `ON CONFLICT ... WHERE state NOT
  IN (...)` means two simultaneous requests can't both acquire it. A losing request gets a 409 with the
  exact message the frontend's `RegenerateDialog` expects: *"Another regeneration is already in
  progress for this visit."*
- **The doctor callback re-derives the claim from the stored draft**, not from what the browser sends.
  It rejects if `draftVersion` doesn't match the latest stored version (claim was regenerated under the
  doctor), if any stored code lacks a decision, or if an approval targets a code with a failed/unavailable
  gate — mirroring `src/lib/claimRules.ts` but enforced server-side, which the frontend README always
  said was required.
- **Dedup is exactly the two keys the frontend spec names**: `visit_id + claim_status` (draft generation,
  submission) and `claim_id + request_id` (insurer requests), via `INSERT ... ON CONFLICT DO NOTHING`.
  A suppressed duplicate still emits an audit row and a `dedup.suppressed` UI event.
- **The audit log is append-only** — `schema.sql` adds a trigger that raises on any UPDATE/DELETE.
  Verified in this session with `@electric-sql/pglite` (embedded Postgres): both an UPDATE and a DELETE
  against `audit_events` were rejected.
- **Denial rate is intentionally left unpopulated** (`denialRateCurrent/Baseline: null` in workflow 09).
  It requires a payer remittance/835 feed this build has no source for — filled with plausible seed data
  in the frontend, but nothing here should be built to fake it.

## Wiring it up

1. Create the 10 n8n credentials listed in `.env.example` (Postgres + 8 HTTP header-auth credentials +
   2 webhook-auth credentials).
2. `psql <your-db> -f schema.sql`
3. `n8n import:workflow --separate --input=workflows/` (validated in this session against a live n8n
   2.39 instance — imports cleanly with no node/parameter errors).
4. `cd event-relay && EVENT_RELAY_SECRET=<same value as .env> node server.mjs`
5. Point the frontend at it: `VITE_API_MODE=live`, `VITE_N8N_BASE_URL=<n8n base>`, and change
   `src/api/http.ts`'s SSE URL to the event relay's `/events/stream` (currently it assumes the relay is
   mounted behind the same base URL — adjust if you deploy it separately, as this kit does by default).
6. Activate each workflow in the n8n UI.

## What's still a stub

- `08-nightly-reconciliation-cron.json`'s "Signed visits without a draft" node is a placeholder query —
  it assumes the EHR exposes a `/visits/signed-since` HTTP endpoint (called in the next node) rather than
  a table this database can query directly. Point it at whatever your EHR actually offers.
- The code catalog, payer/CMS rules, EDI clearinghouse and AI extraction adapter are all assumed to be
  HTTP services with the request/response shapes each workflow's node comments describe. None of those
  services exist yet — this kit is the n8n side of the contract, not those services themselves.
