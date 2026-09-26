-- Claims review platform: state that n8n needs between executions.
-- n8n itself is stateless per run; locks, dedup keys, drafts and the audit log live here.
-- Target: PostgreSQL 13+.

-- ── Deduplication ─────────────────────────────────────────────────────────────
-- Keys: "<visit_id>+draft_generated", "<visit_id>+submitted", "<claim_id>+<request_id>".
-- INSERT ... ON CONFLICT DO NOTHING RETURNING key is an atomic "first delivery wins" test.
CREATE TABLE IF NOT EXISTS dedup_keys (
  key         text PRIMARY KEY,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Regeneration lock: one active regeneration per visit ─────────────────────
-- states: idle | requested | running | completed | failed
CREATE TABLE IF NOT EXISTS regen_locks (
  visit_id      text PRIMARY KEY,
  claim_id      text,
  state         text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle','requested','running','completed','failed')),
  run_id        text,
  idem_key      text,
  requested_by  text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Claims ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  claim_id            text PRIMARY KEY,
  visit_id            text NOT NULL UNIQUE,
  doctor_id           text,
  patient_id          text,
  payer               text,
  note_signed_at      timestamptz,
  draft_generated_at  timestamptz,
  stage               text NOT NULL DEFAULT 'draft_generated',
  status              text NOT NULL DEFAULT 'pending_review',
  latest_version      int  NOT NULL DEFAULT 0,
  regeneration_count  int  NOT NULL DEFAULT 0,
  submitted_at        timestamptz,
  stuck_notified_at   timestamptz
);

-- Immutable version history: Draft v1, Draft v2, Submitted v3 … Rows are never updated.
CREATE TABLE IF NOT EXISTS claim_drafts (
  claim_id    text NOT NULL,
  visit_id    text NOT NULL,
  version     int  NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('draft','submitted')),
  run_id      text,
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, version)
);

CREATE TABLE IF NOT EXISTS submissions (
  visit_id            text PRIMARY KEY,
  claim_id            text NOT NULL,
  run_id              text NOT NULL,
  edi_control_number  text NOT NULL,
  submitted_at        timestamptz NOT NULL,
  submitted_by        text,
  payload             jsonb NOT NULL
);

-- Feeds the KPIs: doctor edit rate and signed-note → submitted latency.
CREATE TABLE IF NOT EXISTS claim_metrics (
  claim_id        text PRIMARY KEY,
  visit_id        text NOT NULL,
  doctor_id       text,
  note_signed_at  timestamptz,
  submitted_at    timestamptz NOT NULL,
  proposed_count  int NOT NULL,
  changed_count   int NOT NULL  -- codes the doctor rejected or replaced
);

-- ── Insurer documentation requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_requests (
  request_id       text NOT NULL,
  claim_id         text NOT NULL,
  insurer          text NOT NULL,
  patient_id       text,
  request_type     text NOT NULL,
  requested_docs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority         text NOT NULL DEFAULT 'normal',
  status           text NOT NULL DEFAULT 'new',
  owner            text,
  notes            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- DocRequestNote[]
  response_history jsonb NOT NULL DEFAULT '[]'::jsonb,   -- { at, summary }[]
  received_at      timestamptz NOT NULL,
  due_at           timestamptz NOT NULL,
  escalated_at     timestamptz,
  PRIMARY KEY (claim_id, request_id)
);
-- CREATE TABLE IF NOT EXISTS only helps on a fresh database; these backfill columns added
-- after doc_requests first shipped, so re-running this file against an existing database
-- (e.g. after `git pull`) still converges to the current shape.
ALTER TABLE doc_requests ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE doc_requests ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE doc_requests ADD COLUMN IF NOT EXISTS response_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Compliance ────────────────────────────────────────────────────────────────
-- Weekly high-complexity audit sample. Selection itself is a random 30-day sample done at
-- seed/read time today; nothing here yet automates the actual weekly selection job.
CREATE TABLE IF NOT EXISTS compliance_queue (
  id                text PRIMARY KEY,
  claim_id          text NOT NULL,
  code              text NOT NULL,
  doctor_name       text,
  complexity        text NOT NULL,
  ai_proposal       text,
  doctor_decision   text,
  evidence          text,
  payer_rule        text,
  selection_reason  text,
  status            text NOT NULL DEFAULT 'selected',
  workflow_version  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Confidently-wrong findings: the AI was highly confident and still wrong. Never conflate
-- model confidence with correctness — see CompliancePage's own framing of this table.
CREATE TABLE IF NOT EXISTS escalations (
  id                text PRIMARY KEY,
  claim_id          text NOT NULL,
  code              text NOT NULL,
  confidence        numeric NOT NULL,
  error_type        text,
  evidence          text,
  final_correction  text,
  model             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ModelMetadata
  severity          text NOT NULL DEFAULT 'medium',
  status            text NOT NULL DEFAULT 'open',
  assigned_to       text,
  findings          jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

-- ── KPI history ───────────────────────────────────────────────────────────────
-- One row per KPI refresh tick. "Current" values for the three headline metrics are always
-- computed live from claim_metrics/claims/doc_requests (see Claims 09/10); this table exists
-- so the Observability trend charts have real history to draw instead of only ever showing
-- a single point on a fresh database.
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  captured_at          timestamptz PRIMARY KEY,
  doctor_edit_rate     numeric NOT NULL,
  denial_rate_current  numeric,
  latency_median_hours numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,
  severity    text NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  claim_id    text,
  ref_id      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Audit log: append-only ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id              bigserial PRIMARY KEY,
  ts              timestamptz NOT NULL DEFAULT now(),
  actor           text NOT NULL,
  actor_type      text NOT NULL,
  event           text NOT NULL,
  entity          text NOT NULL,
  claim_id        text,
  visit_id        text,
  patient_id      text,
  code            text,
  previous_value  text,
  new_value       text,
  run_id          text,
  version         text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_events_claim_idx ON audit_events (claim_id, ts);
CREATE INDEX IF NOT EXISTS audit_events_visit_idx ON audit_events (visit_id);
CREATE INDEX IF NOT EXISTS audit_events_event_idx ON audit_events (event, ts);

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS claim_drafts_immutable ON claim_drafts;
CREATE TRIGGER claim_drafts_immutable BEFORE UPDATE OR DELETE ON claim_drafts
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
