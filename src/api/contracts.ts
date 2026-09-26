import type { CodeDecision, ModelMetadata, ProposedCode, RejectionReason, ValidationGate } from "../types";

/**
 * Wire contracts between this frontend and the n8n orchestration layer.
 * The frontend never talks to source systems (EHR, payer, clearinghouse) directly:
 * n8n owns those credentials and calls. Model/provider details only ever travel
 * as `ModelMetadata` and are never interpreted by the UI.
 */

export interface RegenerateRequest {
  claimId: string;
  visitId: string;
  requestedBy: string;
  /** client-generated key so retried requests can never start duplicate workflows */
  idempotencyKey: string;
}
export interface RegenerateAccepted {
  runId: string;
  lock: "requested" | "running";
}

export interface CodeDecisionPayload {
  codeId: string;
  code: string;
  decision: Exclude<CodeDecision, "pending">;
  reason?: RejectionReason;
  note?: string;
  replacedFrom?: string;
}
/** Doctor callback that resumes the paused ("wait for callback") n8n execution. */
export interface SubmitClaimRequest {
  claimId: string;
  visitId: string;
  draftVersion: number;
  submittedBy: string;
  decisions: CodeDecisionPayload[];
  idempotencyKey: string;
}
export interface SubmitClaimResult {
  submittedAt: string;
  runId: string;
  ediControlNumber: string;
}

export interface ValidateCodeRequest {
  claimId: string;
  visitId: string;
  code: string;
}
export interface ValidateCodeResult {
  category: ProposedCode["category"];
  description: string;
  validation: ValidationGate[];
}

export interface DraftPayload {
  runId: string;
  codes: ProposedCode[];
  model: ModelMetadata;
  generatedAt: string;
}

/**
 * The scalar snapshot n8n's "Claims 09 · KPI refresh" cron pushes every 5 minutes.
 * No history arrays and no derived breach flags: the query only has current-period numbers,
 * and "is this a breach" is a UI concern (src/features/observability), not the backend's to decide.
 * denialRateCurrent/Baseline are null until an 835/remittance feed exists — see that workflow's
 * comment. A null here must never overwrite a previously-known value with "no data".
 */
export interface KpiUpdatePayload {
  doctorEditRate: number;
  doctorEditRateSampleSize: number;
  latencyMedianHours: number;
  latencyP90Hours: number;
  claimsProcessed30d: number;
  pendingDoctorReviews: number;
  regenerationCount30d: number;
  validationFailures30d: number;
  slaApproaching: number;
  reconciliationDiscrepancies: number;
  denialRateCurrent: number | null;
  denialRateBaseline: number | null;
  generatedAt: string;
  /** The backend's own read of its thresholds. The UI recomputes breach state itself (see ObservabilityPage)
   *  so its thresholds stay the single source of truth — these are carried through for audit/debugging only. */
  doctorEditRateBreach?: boolean;
  latencyBreach?: boolean;
  denialRateNote?: string;
}

/** Events pushed from n8n to the UI (SSE / WebSocket in live mode). */
export type BackendEvent =
  | { type: "regeneration.running"; claimId: string; runId: string }
  | { type: "regeneration.completed"; claimId: string; draft: DraftPayload }
  | { type: "regeneration.failed"; claimId: string; runId: string; message: string }
  | { type: "workflow.health"; status: "healthy" | "degraded" | "down"; queueDepth: number }
  | { type: "dedup.suppressed"; key: string; entity: string; claimId?: string; requestId?: string }
  | { type: "kpi.updated"; kpi: KpiUpdatePayload };

export interface ClaimsApi {
  requestRegeneration(req: RegenerateRequest): Promise<RegenerateAccepted>;
  submitClaim(req: SubmitClaimRequest): Promise<SubmitClaimResult>;
  validateCode(req: ValidateCodeRequest): Promise<ValidateCodeResult>;
  subscribe(handler: (event: BackendEvent) => void): () => void;
}
