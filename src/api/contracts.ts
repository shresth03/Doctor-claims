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

/** Events pushed from n8n to the UI (SSE / WebSocket in live mode). */
export type BackendEvent =
  | { type: "regeneration.running"; claimId: string; runId: string }
  | { type: "regeneration.completed"; claimId: string; draft: DraftPayload }
  | { type: "regeneration.failed"; claimId: string; runId: string; message: string }
  | { type: "workflow.health"; status: "healthy" | "degraded" | "down"; queueDepth: number }
  | { type: "dedup.suppressed"; key: string; entity: string; claimId?: string; requestId?: string };

export interface ClaimsApi {
  requestRegeneration(req: RegenerateRequest): Promise<RegenerateAccepted>;
  submitClaim(req: SubmitClaimRequest): Promise<SubmitClaimResult>;
  validateCode(req: ValidateCodeRequest): Promise<ValidateCodeResult>;
  subscribe(handler: (event: BackendEvent) => void): () => void;
}
