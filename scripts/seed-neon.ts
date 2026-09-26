/**
 * Ports the exact demo dataset the frontend's mock mode generates (src/lib/seed.ts, same
 * deterministic mulberry32 seed) into the real Neon database, so switching the frontend to
 * VITE_API_MODE=live shows the identical data — just read from Postgres instead of generated
 * in-browser.
 *
 * Run: node --env-file=n8n/.env --import tsx scripts/seed-neon.ts
 * (DATABASE_URL comes from n8n/.env, never passed on the command line.)
 */
import { Client } from "pg";
import {
  generateAuditTrail,
  generateClaims,
  generateComplianceQueue,
  generateDocRequests,
  generateEscalations,
  generateKpiSnapshot,
  generateNotifications,
} from "../src/lib/seed";
import type { Claim, ClaimVersion } from "../src/types";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run via: node --env-file=n8n/.env --import tsx scripts/seed-neon.ts");

const claims = generateClaims(48);
const docRequests = generateDocRequests(claims, 22);
const complianceQueue = generateComplianceQueue(claims, 14);
const escalations = generateEscalations(claims, 6);
const kpi = generateKpiSnapshot();
const auditTrail = generateAuditTrail(claims, 220);
const notifications = generateNotifications(claims);

const STAGE_BY_STATUS: Record<Claim["status"], Claim["stage"]> = {
  pending_review: "doctor_review",
  partially_reviewed: "doctor_review",
  approved: "approved",
  needs_correction: "doctor_review",
  expired: "doctor_review",
  withdrawn: "doctor_review",
  submitted: "submitted",
};

function latestVersion(versions: ClaimVersion[]): number {
  return versions.length ? Math.max(...versions.map((v) => v.number)) : 0;
}

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Demo reseed: wipe everything this script owns. Note TRUNCATE bypasses the audit_events
  // append-only trigger (it only blocks UPDATE/DELETE) — that's intentional here, for a clean
  // demo reset, and a real deployment would additionally REVOKE TRUNCATE from the app role.
  await client.query(`
    TRUNCATE claims, claim_drafts, submissions, claim_metrics, doc_requests,
             compliance_queue, escalations, kpi_snapshots, notifications, audit_events
  `);
  console.log("Truncated existing demo tables.");

  // ── claims + claim_drafts (one full-snapshot row per claim; see the read API for why one row is enough) ──
  for (const c of claims) {
    await client.query(
      `INSERT INTO claims (claim_id, visit_id, doctor_id, patient_id, payer, note_signed_at, draft_generated_at,
                            stage, status, latest_version, regeneration_count, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        c.id, c.visitId, c.doctorId, c.patientId, c.payer, c.noteSignedAt, c.draftGeneratedAt,
        STAGE_BY_STATUS[c.status], c.status, latestVersion(c.versions), c.regeneration.count, c.submittedAt ?? null,
      ],
    );
    const v = latestVersion(c.versions);
    await client.query(
      `INSERT INTO claim_drafts (claim_id, visit_id, version, kind, run_id, payload, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [c.id, c.visitId, v, c.status === "submitted" ? "submitted" : "draft", `seed_${c.id}`, JSON.stringify(c), c.draftGeneratedAt],
    );
    if (c.status === "submitted" && c.submittedAt) {
      await client.query(
        `INSERT INTO submissions (visit_id, claim_id, run_id, edi_control_number, submitted_at, submitted_by, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (visit_id) DO NOTHING`,
        [c.visitId, c.id, `seed_${c.id}`, `ISA${Math.floor(100000000 + Math.random() * 899999999)}`, c.submittedAt, c.doctorName, JSON.stringify(c.codes)],
      );
      await client.query(
        `INSERT INTO claim_metrics (claim_id, visit_id, doctor_id, note_signed_at, submitted_at, proposed_count, changed_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (claim_id) DO NOTHING`,
        [c.id, c.visitId, c.doctorId, c.noteSignedAt, c.submittedAt, c.codes.length, c.codes.filter((code) => code.originalCode || code.decision === "rejected").length],
      );
    }
  }
  console.log(`Seeded ${claims.length} claims.`);

  // ── doc_requests ──
  for (const r of docRequests) {
    await client.query(
      `INSERT INTO doc_requests (request_id, claim_id, insurer, patient_id, request_type, requested_docs, priority,
                                  status, owner, notes, response_history, received_at, due_at, escalated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)`,
      [
        r.id, r.claimId, r.insurer, r.patientId, r.requestType, JSON.stringify(r.requestedDocs), r.priority,
        r.status, r.owner, JSON.stringify(r.notes), JSON.stringify(r.responseHistory), r.receivedAt, r.dueAt,
        r.status === "sla_breach" ? r.receivedAt : null,
      ],
    );
  }
  console.log(`Seeded ${docRequests.length} doc requests.`);

  // ── compliance_queue ──
  for (const item of complianceQueue) {
    await client.query(
      `INSERT INTO compliance_queue (id, claim_id, code, doctor_name, complexity, ai_proposal, doctor_decision,
                                      evidence, payer_rule, selection_reason, status, workflow_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [item.id, item.claimId, item.code, item.doctorName, item.complexity, item.aiProposal, item.doctorDecision,
       item.evidence, item.payerRule, item.selectionReason, item.status, item.workflowVersion],
    );
  }
  console.log(`Seeded ${complianceQueue.length} compliance queue items.`);

  // ── escalations ──
  for (const e of escalations) {
    await client.query(
      `INSERT INTO escalations (id, claim_id, code, confidence, error_type, evidence, final_correction, model,
                                 severity, status, assigned_to, findings, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb,$13)`,
      [e.id, e.claimId, e.code, e.confidence, e.errorType, e.evidence, e.finalCorrection, JSON.stringify(e.model),
       e.severity, e.status, e.assignedTo ?? null, JSON.stringify(e.findings), e.timestamp],
    );
  }
  console.log(`Seeded ${escalations.length} escalations.`);

  // ── kpi_snapshots (history for the trend charts) ──
  const days = kpi.latencyHistory.length;
  for (let i = 0; i < days; i++) {
    await client.query(
      `INSERT INTO kpi_snapshots (captured_at, doctor_edit_rate, denial_rate_current, latency_median_hours)
       VALUES ($1,$2,$3,$4) ON CONFLICT (captured_at) DO NOTHING`,
      [kpi.latencyHistory[i].t, kpi.doctorEditRateHistory[i]?.value ?? kpi.doctorEditRate,
       kpi.denialRateHistory[i]?.value ?? kpi.denialRateCurrent, kpi.latencyHistory[i].value],
    );
  }
  console.log(`Seeded ${days} KPI history points.`);

  // ── notifications ──
  for (const n of notifications) {
    await client.query(
      `INSERT INTO notifications (kind, severity, title, message, claim_id, ref_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [n.kind, n.severity, n.title, n.message, n.claimId ?? null, null, n.createdAt],
    );
  }
  console.log(`Seeded ${notifications.length} notifications.`);

  // ── audit_events ──
  for (const e of auditTrail) {
    await client.query(
      `INSERT INTO audit_events (ts, actor, actor_type, event, entity, claim_id, visit_id, patient_id, code,
                                  previous_value, new_value, run_id, version, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [e.timestamp, e.actor, e.actorType, e.event, e.entity, e.claimId ?? null, e.visitId ?? null, e.patientId ?? null,
       e.code ?? null, e.previousValue ?? null, e.newValue ?? null, e.runId, e.version ?? null, JSON.stringify(e.metadata ?? {})],
    );
  }
  console.log(`Seeded ${auditTrail.length} audit events.`);

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
