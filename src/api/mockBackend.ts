import {
  CPT_POOL,
  ICD_POOL,
  generateAuditTrail,
  generateClaims,
  generateComplianceQueue,
  generateDocRequests,
  generateDraftCodes,
  generateEscalations,
  generateKpiSnapshot,
  generateNotifications,
  makeValidationGates,
  MODEL_METADATA,
} from "../lib/seed";
import { ApiError, ConflictError, REGEN_IN_PROGRESS_MESSAGE, ValidationRejectedError } from "./errors";
import type { BackendEvent, ClaimsApi, RegenerateAccepted, SubmitClaimResult } from "./contracts";
import type { ReadApi } from "./read";

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
    if (!kpiSimTimer) startKpiSimulator();
    return () => listeners.delete(handler);
  },
};

// ── Read API (mock): generated once, same shape/values the live Read API returns from Postgres ──

const mockClaims = generateClaims(48);
const mockDocRequests = generateDocRequests(mockClaims, 22);
const mockComplianceQueue = generateComplianceQueue(mockClaims, 14);
const mockEscalations = generateEscalations(mockClaims, 6);
const mockKpi = generateKpiSnapshot();
const mockAuditTrail = generateAuditTrail(mockClaims, 220);
const mockNotifications = generateNotifications(mockClaims);

export const mockReadApi: ReadApi = {
  listClaims: () => Promise.resolve(mockClaims),
  listDocRequests: () => Promise.resolve(mockDocRequests),
  listComplianceQueue: () => Promise.resolve(mockComplianceQueue),
  listEscalations: () => Promise.resolve(mockEscalations),
  listNotifications: () => Promise.resolve(mockNotifications),
  listAuditTrail: () => Promise.resolve(mockAuditTrail),
  getKpiSnapshot: () => Promise.resolve(mockKpi),
};

// ── Live KPI feel in mock mode ────────────────────────────────────────────────────────────────
// The real "Claims 09 · KPI refresh" cron pushes a kpi.updated event every 5 minutes; this mirrors
// that on a shorter, demo-friendly interval so the Observability tiles visibly move instead of
// sitting static, using the same event the live backend emits (see store.ts's handleBackendEvent).
let kpiSimTimer: ReturnType<typeof setInterval> | null = null;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function startKpiSimulator() {
  let editRate = mockKpi.doctorEditRate;
  let latency = mockKpi.latencyMedianHours;
  let denial = mockKpi.denialRateCurrent;

  kpiSimTimer = setInterval(() => {
    editRate = clamp(editRate + (Math.random() - 0.5) * 0.012, 0.08, 0.26);
    latency = clamp(latency + (Math.random() - 0.5) * 0.8, 4, 20);
    denial = clamp(denial + (Math.random() - 0.5) * 0.006, 0.03, 0.09);

    emit({
      type: "kpi.updated",
      kpi: {
        doctorEditRate: editRate,
        doctorEditRateSampleSize: mockKpi.doctorEditRateSampleSize + Math.floor(Math.random() * 3),
        latencyMedianHours: latency,
        latencyP90Hours: latency * 1.9 + Math.random() * 2,
        claimsProcessed30d: mockKpi.claimsProcessed30d,
        pendingDoctorReviews: mockKpi.pendingDoctorReviews,
        regenerationCount30d: mockKpi.regenerationCount30d,
        validationFailures30d: mockKpi.validationFailures30d,
        slaApproaching: mockKpi.slaApproaching,
        reconciliationDiscrepancies: mockKpi.reconciliationDiscrepancies,
        denialRateCurrent: denial,
        denialRateBaseline: mockKpi.denialRateBaseline,
        generatedAt: new Date().toISOString(),
      },
    });
  }, 15_000);
}
