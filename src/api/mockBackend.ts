import { CPT_POOL, ICD_POOL, MODEL_METADATA, generateDraftCodes, makeValidationGates } from "../lib/seed";
import { ApiError, ConflictError, REGEN_IN_PROGRESS_MESSAGE, ValidationRejectedError } from "./errors";
import type { BackendEvent, ClaimsApi, RegenerateAccepted, SubmitClaimResult } from "./contracts";

/**
 * In-browser stand-in for the n8n workflows so the UI is fully exercisable without a backend.
 * It reproduces the behaviours the UI must handle: the per-visit regeneration lock (409),
 * idempotent retries, dedup on visit_id + claim_status, final server-side validation,
 * and asynchronous events pushed back to the client.
 */

type LockState = "idle" | "requested" | "running" | "completed" | "failed";

const listeners = new Set<(e: BackendEvent) => void>();
const locks = new Map<string, LockState>(); // key: visitId
const idempotent = new Map<string, unknown>();
const submitted = new Map<string, SubmitClaimResult>(); // key: `${visitId}+submitted`

let noteLookup: (claimId: string) => { noteText: string; codeCount: number } | null = () => null;

/** Demo switches for exercising failure paths. Exposed on window.__claimsDemo in dev. */
export const mockControls = {
  failNextSubmission: false,
  failNextRegeneration: false,
  /** simulate another session already holding the regeneration lock */
  lockVisit(visitId: string) {
    locks.set(visitId, "running");
  },
  unlockVisit(visitId: string) {
    locks.set(visitId, "idle");
  },
};

export function configureMock(opts: { noteLookup: typeof noteLookup }) {
  noteLookup = opts.noteLookup;
}

function emit(e: BackendEvent) {
  listeners.forEach((l) => l(e));
}
const delay = (min: number, spread = 0) => new Promise((r) => setTimeout(r, min + Math.random() * spread));
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const mockApi: ClaimsApi = {
  async requestRegeneration(req): Promise<RegenerateAccepted> {
    await delay(250, 250);
    const cached = idempotent.get(req.idempotencyKey);
    if (cached) return cached as RegenerateAccepted;

    const state = locks.get(req.visitId) ?? "idle";
    if (state === "requested" || state === "running") {
      throw new ConflictError("regeneration_locked", REGEN_IN_PROGRESS_MESSAGE);
    }

    const runId = id("run");
    locks.set(req.visitId, "requested");
    const accepted: RegenerateAccepted = { runId, lock: "requested" };
    idempotent.set(req.idempotencyKey, accepted);

    void (async () => {
      await delay(500, 400);
      locks.set(req.visitId, "running");
      emit({ type: "regeneration.running", claimId: req.claimId, runId });
      await delay(1600, 1400);

      if (mockControls.failNextRegeneration) {
        mockControls.failNextRegeneration = false;
        locks.set(req.visitId, "failed");
        emit({ type: "regeneration.failed", claimId: req.claimId, runId, message: "Extraction step timed out. The previous draft is unchanged." });
        locks.set(req.visitId, "idle");
        return;
      }

      const note = noteLookup(req.claimId);
      const noteText = note?.noteText ?? "";
      locks.set(req.visitId, "completed");
      emit({
        type: "regeneration.completed",
        claimId: req.claimId,
        draft: { runId, codes: generateDraftCodes(noteText, undefined, true), model: MODEL_METADATA, generatedAt: new Date().toISOString() },
      });
      locks.set(req.visitId, "idle");
    })();

    return accepted;
  },

  async submitClaim(req): Promise<SubmitClaimResult> {
    await delay(700, 700);
    const dedupKey = `${req.visitId}+submitted`;
    const existing = submitted.get(dedupKey);
    if (existing) {
      emit({ type: "dedup.suppressed", key: "visit_id + claim_status", entity: `Claim ${req.claimId}`, claimId: req.claimId });
      return existing;
    }

    const approved = req.decisions.filter((d) => d.decision === "approved");
    if (approved.length === 0) {
      throw new ValidationRejectedError("Final validation failed: at least one approved code is required to submit a claim.", ["no_approved_codes"]);
    }
    if (mockControls.failNextSubmission) {
      mockControls.failNextSubmission = false;
      throw new ApiError(502, "edi_rejected", "The EDI clearinghouse rejected the 837 submission (837-REJ-14). The claim was not modified and can be resubmitted.");
    }

    const result: SubmitClaimResult = {
      submittedAt: new Date().toISOString(),
      runId: id("run"),
      ediControlNumber: `ISA${Math.floor(100000000 + Math.random() * 899999999)}`,
    };
    submitted.set(dedupKey, result);
    return result;
  },

  async validateCode(req) {
    await delay(500, 500);
    const code = req.code.trim().toUpperCase();
    const isCpt = /^\d{5}$/.test(code);
    const isIcd = /^[A-TV-Z]\d{2}(\.[A-Z0-9]{1,4})?$/.test(code);
    if (!isCpt && !isIcd) {
      const gates = makeValidationGates("failed");
      gates[0] = { ...gates[0], detail: `"${req.code}" is not a recognised CPT or ICD-10 code format.` };
      return { category: "CPT", description: "Unrecognised code", validation: gates };
    }
    const known = [...CPT_POOL, ...ICD_POOL].find((c) => c.code === code);
    // A doctor-supplied replacement has no machine-verified evidence yet: surface that honestly as a warning.
    const gates = makeValidationGates("warning");
    gates[0] = { ...gates[0], detail: "Replacement entered by the doctor. Supporting evidence has not been machine-verified against the note." };
    return {
      category: isCpt ? "CPT" : "ICD-10",
      description: known?.description ?? "Description pending catalog lookup",
      validation: gates,
    };
  },

  subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
};
