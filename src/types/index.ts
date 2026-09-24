// ── Roles & session ──────────────────────────────────────────────

export type Role = "doctor" | "billing" | "compliance" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  facility: string;
}

// ── Shared/model metadata ────────────────────────────────────────
// Provider-agnostic. Only ever rendered inside technical metadata/tooltips.

export interface ModelMetadata {
  model_provider: string;
  model_name: string;
  model_version: string;
  workflow_version: string;
  ruleset_version: string;
}

export type ValidationStatus = "passed" | "failed" | "warning" | "unavailable";

export interface ValidationGate {
  key: "documentation_requirement" | "signed_note" | "billable_event" | "active_policy";
  label: string;
  status: ValidationStatus;
  detail?: string;
}

export type CodeCategory = "CPT" | "ICD-10";
export type ComplexityLevel = "standard" | "high";
export type CodeDecision = "pending" | "approved" | "rejected";
export type RejectionReason =
  | "unsupported_by_documentation"
  | "incorrect_code"
  | "incorrect_complexity"
  | "duplicate"
  | "other";

export interface EvidenceSpan {
  excerpt: string;
  /** character offsets into the visit note text, for highlighting */
  start: number;
  end: number;
}

export interface ProposedCode {
  id: string;
  code: string;
  category: CodeCategory;
  description: string;
  confidence: number; // 0-1
  complexity: ComplexityLevel;
  complexityReason?: string;
  evidence: EvidenceSpan;
  validation: ValidationGate[];
  decision: CodeDecision;
  rejectionReason?: RejectionReason;
  rejectionNote?: string;
  originalCode?: string; // set if this code is an edited replacement
  originalDescription?: string;
  /** true when a validation gate failed; a quarantined code cannot be approved */
  quarantined?: boolean;
  /** true while the backend re-validates a doctor-supplied replacement code */
  revalidating?: boolean;
}

/** Immutable snapshot of a claim draft. Earlier versions are never overwritten. */
export interface ClaimVersion {
  /** e.g. "Draft v1", "Draft v2", "Submitted v3" */
  label: string;
  number: number;
  kind: "draft" | "submitted";
  createdAt: string;
  createdBy: string;
  runId: string;
  codes: {
    code: string;
    category: CodeCategory;
    description: string;
    decision: CodeDecision;
    /** code originally proposed by the AI when this row was later edited */
    proposedCode?: string;
  }[];
}

export type ClaimStage =
  | "draft_generated"
  | "doctor_review"
  | "approved"
  | "submission"
  | "submitted"
  | "failed";

export type ClaimStatus =
  | "pending_review"
  | "partially_reviewed"
  | "approved"
  | "needs_correction"
  | "expired"
  | "withdrawn"
  | "submitted";

export interface Claim {
  id: string;
  visitId: string;
  patientName: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  payer: string;
  facility: string;
  draftGeneratedAt: string;
  stage: ClaimStage;
  status: ClaimStatus;
  codes: ProposedCode[];
  noteText: string;
  noteSignedAt: string;
  submittedAt?: string;
  regeneration: {
    state: "idle" | "requested" | "running" | "completed" | "failed";
    count: number;
    lastRequestedAt?: string;
  };
  model: ModelMetadata;
  reviewAgeHours: number;
  versions: ClaimVersion[];
}

// ── Documentation requests ───────────────────────────────────────

export type DocRequestStatus =
  | "new"
  | "in_progress"
  | "awaiting_document"
  | "ready_to_send"
  | "submitted"
  | "sla_breach";

export type Priority = "low" | "normal" | "high" | "urgent";

export interface DocRequestNote {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface DocRequest {
  id: string;
  claimId: string;
  insurer: string;
  patientId: string;
  requestType: string;
  receivedAt: string;
  dueAt: string;
  priority: Priority;
  status: DocRequestStatus;
  owner: string;
  requestedDocs: string[];
  notes: DocRequestNote[];
  responseHistory: { at: string; summary: string }[];
}

// ── Compliance ────────────────────────────────────────────────────

export type AuditQueueStatus = "selected" | "in_review" | "validated" | "issue_found" | "escalated";

export interface ComplianceAuditItem {
  id: string;
  claimId: string;
  code: string;
  doctorName: string;
  complexity: ComplexityLevel;
  aiProposal: string;
  doctorDecision: CodeDecision;
  evidence: string;
  payerRule: string;
  selectionReason: string;
  status: AuditQueueStatus;
  workflowVersion: string;
}

export type EscalationSeverity = "low" | "medium" | "high" | "critical";
export type EscalationStatus = "open" | "investigating" | "assigned" | "resolved";

export interface Escalation {
  id: string;
  claimId: string;
  code: string;
  confidence: number;
  errorType: string;
  evidence: string;
  finalCorrection: string;
  model: ModelMetadata;
  timestamp: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  assignedTo?: string;
  findings: string[];
}

// ── Observability ─────────────────────────────────────────────────

export interface KpiPoint {
  t: string;
  value: number;
}

export interface KpiSnapshot {
  doctorEditRate: number; // 0-1
  doctorEditRateSampleSize: number;
  doctorEditRateHistory: KpiPoint[];
  denialRateCurrent: number; // 0-1
  denialRateBaseline: number; // 0-1
  denialRateHistory: KpiPoint[];
  latencyMedianHours: number;
  latencyP90Hours: number;
  latencyHistory: KpiPoint[];
  claimsProcessed30d: number;
  pendingDoctorReviews: number;
  regenerationCount30d: number;
  validationFailures30d: number;
  slaApproaching: number;
  reconciliationDiscrepancies: number;
}

// ── Audit trail ────────────────────────────────────────────────────

export type AuditActorType = "system" | "ai" | "doctor" | "billing_coordinator" | "compliance_officer";

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorType: AuditActorType;
  event: string;
  entity: string;
  claimId?: string;
  visitId?: string;
  patientId?: string;
  code?: string;
  previousValue?: string;
  newValue?: string;
  runId: string;
  /** claim version this event applies to, e.g. "Draft v2" */
  version?: string;
  /** structured, event-specific key/value metadata (rejection reason, gate results, excerpt offsets…) */
  metadata?: Record<string, string>;
}

// ── Notifications ────────────────────────────────────────────────

export type NotificationKind = "stuck_draft" | "sla_breach" | "quarantine" | "system";
export type NotificationState = "unread" | "read" | "acknowledged";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  state: NotificationState;
  claimId?: string;
  severity: "info" | "warning" | "critical";
}

// ── Workflow / connection health ───────────────────────────────────

export interface WorkflowHealth {
  status: "healthy" | "degraded" | "down";
  lastEventAt: string;
  queueDepth: number;
  environment: "production" | "staging" | "demo";
}
