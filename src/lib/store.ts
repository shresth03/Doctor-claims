import { create } from "zustand";
import { generateWorkflowHealth, snapshotCodes } from "./seed";
import { getSignOffBlockers, isClaimLocked, isRegenerationBusy, approvalBlocker } from "./claimRules";
import { ApiError, ConflictError, api, configureMock, readApi } from "../api";
import type { BackendEvent } from "../api";
import type {
  AppNotification,
  AuditActorType,
  AuditEvent,
  Claim,
  ClaimVersion,
  CodeDecision,
  ComplianceAuditItem,
  DocRequest,
  Escalation,
  KpiPoint,
  KpiSnapshot,
  ProposedCode,
  RejectionReason,
  Role,
  SessionUser,
  WorkflowHealth,
} from "../types";

let eventSeq = 0;
const newKey = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function currentDraftLabel(claim: Claim): string | undefined {
  return [...claim.versions].reverse().find((v) => v.kind === "draft")?.label;
}

function makeAuditEvent(
  claim: Claim | undefined,
  base: Pick<AuditEvent, "actor" | "actorType" | "event" | "entity"> & Partial<AuditEvent>,
): AuditEvent {
  return {
    id: `EVT-live-${Date.now()}-${++eventSeq}`,
    timestamp: new Date().toISOString(),
    claimId: claim?.id,
    visitId: claim?.visitId,
    patientId: claim?.patientId,
    runId: claim ? `run_${claim.visitId}` : "run_manual",
    version: claim ? currentDraftLabel(claim) : undefined,
    ...base,
  };
}

interface AppState {
  // session
  user: SessionUser;
  setRole: (role: Role) => void;

  // data
  claims: Claim[];
  docRequests: DocRequest[];
  complianceQueue: ComplianceAuditItem[];
  escalations: Escalation[];
  kpi: KpiSnapshot;
  auditTrail: AuditEvent[];
  notifications: AppNotification[];
  workflowHealth: WorkflowHealth;

  // Initial load: mock mode resolves this near-instantly from local generators; live mode fetches
  // from the n8n Read API. Everything above starts empty/zeroed until this resolves — see AppShell
  // for the loading screen gated on `hydrated`.
  hydrated: boolean;
  hydrating: boolean;
  hydrationError: string | null;
  hydrate: () => Promise<void>;

  // ui
  selectedClaimId: string | null;
  selectClaim: (id: string | null) => void;

  // actions (backed by the n8n API layer)
  decideCode: (claimId: string, codeId: string, decision: Exclude<CodeDecision, "pending">, reason?: RejectionReason, note?: string) => void;
  editCode: (claimId: string, codeId: string, newCode: string) => Promise<void>;
  regenerateClaim: (claimId: string) => Promise<void>;
  signOffClaim: (claimId: string) => Promise<{ ok: boolean; error?: string }>;
  withdrawRequest: (claimId: string, reason?: string) => void;
  expireRequest: (claimId: string, reason?: string) => void;
  markNotification: (id: string, state: AppNotification["state"]) => void;
  markAllNotificationsRead: () => void;
  updateDocRequestStatus: (id: string, status: DocRequest["status"], summary?: string) => void;
}

const workflowHealth = generateWorkflowHealth();

const EMPTY_KPI: KpiSnapshot = {
  doctorEditRate: 0,
  doctorEditRateSampleSize: 0,
  doctorEditRateHistory: [],
  denialRateCurrent: 0,
  denialRateBaseline: 0,
  denialRateHistory: [],
  latencyMedianHours: 0,
  latencyP90Hours: 0,
  latencyHistory: [],
  claimsProcessed30d: 0,
  pendingDoctorReviews: 0,
  regenerationCount30d: 0,
  validationFailures30d: 0,
  slaApproaching: 0,
  reconciliationDiscrepancies: 0,
};

const ROLE_NAMES: Record<Role, string> = {
  doctor: "Dr. Amara Osei",
  billing: "Jenna Park",
  compliance: "Rhea Kapoor",
  admin: "System Administrator",
};

export const useAppStore = create<AppState>((set, get) => {
  const patchClaim = (claimId: string, fn: (c: Claim) => Claim) =>
    set((s) => ({ claims: s.claims.map((c) => (c.id === claimId ? fn(c) : c)) }));
  const pushAudit = (...events: AuditEvent[]) => set((s) => ({ auditTrail: [...events, ...s.auditTrail] }));
  const pushNotification = (n: Omit<AppNotification, "id" | "createdAt" | "state">) =>
    set((s) => ({
      notifications: [{ ...n, id: `NTF-live-${Date.now()}-${++eventSeq}`, createdAt: new Date().toISOString(), state: "unread" as const }, ...s.notifications],
    }));
  const actor = (): { actor: string; actorType: AuditActorType } => {
    const { user } = get();
    return {
      actor: user.name,
      actorType: user.role === "doctor" ? "doctor" : user.role === "billing" ? "billing_coordinator" : user.role === "compliance" ? "compliance_officer" : "system",
    };
  };

  return {
    user: { id: "u_1", name: ROLE_NAMES.doctor, role: "doctor", facility: "Ridgeview Clinic — Main" },
    setRole: (role) => set((s) => ({ user: { ...s.user, role, name: ROLE_NAMES[role] } })),

    claims: [],
    docRequests: [],
    complianceQueue: [],
    escalations: [],
    kpi: EMPTY_KPI,
    auditTrail: [],
    notifications: [],
    workflowHealth,

    hydrated: false,
    hydrating: false,
    hydrationError: null,
    hydrate: async () => {
      if (get().hydrating || get().hydrated) return;
      set({ hydrating: true, hydrationError: null });
      try {
        const [claims, docRequests, complianceQueue, escalations, kpi, auditTrail, notifications] = await Promise.all([
          readApi.listClaims(),
          readApi.listDocRequests(),
          readApi.listComplianceQueue(),
          readApi.listEscalations(),
          readApi.getKpiSnapshot(),
          readApi.listAuditTrail(),
          readApi.listNotifications(),
        ]);
        set({ claims, docRequests, complianceQueue, escalations, kpi, auditTrail, notifications, hydrated: true, hydrating: false });
      } catch (e) {
        set({ hydrating: false, hydrationError: e instanceof ApiError ? e.message : "Could not load claims data." });
      }
    },

    selectedClaimId: null,
    selectClaim: (id) => set({ selectedClaimId: id }),

    decideCode: (claimId, codeId, decision, reason, note) => {
      const claim = get().claims.find((c) => c.id === claimId);
      const target = claim?.codes.find((c) => c.id === codeId);
      if (!claim || !target || isClaimLocked(claim) || isRegenerationBusy(claim)) return;
      // Approval is refused for quarantined / unvalidated codes — enforced here, not just in the UI.
      if (decision === "approved" && approvalBlocker(target)) return;

      patchClaim(claimId, (c) => {
        const codes: ProposedCode[] = c.codes.map((code) =>
          code.id === codeId
            ? { ...code, decision, rejectionReason: decision === "rejected" ? reason : undefined, rejectionNote: decision === "rejected" ? note : undefined }
            : code,
        );
        const allDecided = codes.every((code) => code.decision !== "pending");
        const anyDecided = codes.some((code) => code.decision !== "pending");
        const status = allDecided ? (codes.every((code) => code.decision === "approved") ? "approved" : "needs_correction") : anyDecided ? "partially_reviewed" : "pending_review";
        return { ...c, codes, status };
      });

      pushAudit(
        makeAuditEvent(claim, {
          ...actor(),
          event: decision === "approved" ? "Doctor approved code" : "Doctor rejected code",
          entity: `Code ${target.code}`,
          code: target.code,
          previousValue: target.decision,
          newValue: decision,
          metadata: {
            decision_scope: "single code",
            ...(decision === "rejected" ? { reason: reason ?? "unspecified", ...(note ? { note } : {}) } : {}),
            ...(target.complexity === "high" ? { high_complexity_review: "explicit decision recorded" } : {}),
            evidence_excerpt: `"${target.evidence.excerpt}"`,
          },
        }),
      );
    },

    editCode: async (claimId, codeId, rawCode) => {
      const claim = get().claims.find((c) => c.id === claimId);
      const target = claim?.codes.find((c) => c.id === codeId);
      const newCode = rawCode.trim().toUpperCase();
      if (!claim || !target || !newCode || newCode === target.code || isClaimLocked(claim) || isRegenerationBusy(claim)) return;

      const previous = target.code;
      // The replacement must be explicitly re-decided and re-validated: reset the decision and mark validation incomplete.
      patchClaim(claimId, (c) => ({
        ...c,
        status: "partially_reviewed",
        codes: c.codes.map((code) =>
          code.id === codeId
            ? {
                ...code,
                originalCode: code.originalCode ?? code.code,
                originalDescription: code.originalDescription ?? code.description,
                code: newCode,
                decision: "pending" as const,
                rejectionReason: undefined,
                rejectionNote: undefined,
                revalidating: true,
                quarantined: false,
                validation: code.validation.map((v) => ({ ...v, status: "unavailable" as const, detail: "Re-validating replacement code…" })),
              }
            : code,
        ),
      }));

      pushAudit(
        makeAuditEvent(claim, {
          ...actor(),
          event: "Doctor edited code",
          entity: `Code ${newCode}`,
          code: newCode,
          previousValue: previous,
          newValue: newCode,
          metadata: { ai_proposed: target.originalCode ?? previous, prior_decision: target.decision, requires_new_decision: "true" },
        }),
      );

      try {
        const result = await api.validateCode({ claimId, visitId: claim.visitId, code: newCode });
        const quarantined = result.validation.some((v) => v.status === "failed");
        // If the draft was regenerated meanwhile, the code row no longer exists and this is a no-op.
        patchClaim(claimId, (c) => ({
          ...c,
          codes: c.codes.map((code) =>
            code.id === codeId && code.code === newCode
              ? { ...code, category: result.category, description: result.description, validation: result.validation, quarantined, revalidating: false }
              : code,
          ),
        }));
        const fresh = get().claims.find((c) => c.id === claimId);
        pushAudit(
          makeAuditEvent(fresh ?? claim, {
            actor: "Workflow Engine",
            actorType: "system",
            event: quarantined ? "Code quarantined — validation failed" : "Validation result recorded",
            entity: `Code ${newCode}`,
            code: newCode,
            metadata: Object.fromEntries(result.validation.map((v) => [v.key, v.status])),
          }),
        );
        if (quarantined) {
          pushNotification({
            kind: "quarantine",
            severity: "warning",
            claimId,
            title: "Code quarantined",
            message: `Code ${newCode} has been quarantined because required documentation evidence could not be verified.`,
          });
        }
      } catch (e) {
        // Validation service unreachable: leave the gates "unavailable" so the code stays unapprovable. Never fake a pass.
        patchClaim(claimId, (c) => ({
          ...c,
          codes: c.codes.map((code) =>
            code.id === codeId
              ? {
                  ...code,
                  revalidating: false,
                  validation: code.validation.map((v) => ({ ...v, status: "unavailable" as const, detail: e instanceof Error ? e.message : "Validation unavailable." })),
                }
              : code,
          ),
        }));
      }
    },

    regenerateClaim: async (claimId) => {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim) return;
      // Client-side guard so repeated clicks never emit a second request; the backend lock is the source of truth.
      if (isRegenerationBusy(claim)) throw new ConflictError("regeneration_locked", "Regeneration is already in progress.");

      const previousState = claim.regeneration.state;
      patchClaim(claimId, (c) => ({ ...c, regeneration: { ...c.regeneration, state: "requested", lastRequestedAt: new Date().toISOString() } }));

      try {
        const accepted = await api.requestRegeneration({
          claimId,
          visitId: claim.visitId,
          requestedBy: get().user.id,
          idempotencyKey: newKey(`regen_${claim.visitId}`),
        });
        pushAudit(
          makeAuditEvent(claim, {
            ...actor(),
            event: "Regeneration requested",
            entity: `Claim ${claimId}`,
            runId: accepted.runId,
            metadata: { lock_state: accepted.lock, supersedes: currentDraftLabel(claim) ?? "n/a" },
          }),
        );
      } catch (e) {
        // A 409 means someone else holds the lock: restore our previous state and surface the backend message.
        patchClaim(claimId, (c) => ({ ...c, regeneration: { ...c.regeneration, state: e instanceof ConflictError ? previousState : "failed" } }));
        throw e;
      }
    },

    signOffClaim: async (claimId) => {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim) return { ok: false, error: "Claim not found." };
      const blockers = getSignOffBlockers(claim);
      if (blockers.length > 0) return { ok: false, error: blockers[0] };

      patchClaim(claimId, (c) => ({ ...c, stage: "submission" }));
      try {
        const result = await api.submitClaim({
          claimId,
          visitId: claim.visitId,
          draftVersion: claim.versions.filter((v) => v.kind === "draft").length,
          submittedBy: get().user.id,
          idempotencyKey: `submit_${claim.visitId}_${claim.versions.length}`,
          decisions: claim.codes.map((c) => ({
            codeId: c.id,
            code: c.code,
            decision: c.decision as "approved" | "rejected",
            reason: c.rejectionReason,
            note: c.rejectionNote,
            replacedFrom: c.originalCode,
          })),
        });

        const submittedVersion: ClaimVersion = {
          label: `Submitted v${claim.versions.length + 1}`,
          number: claim.versions.length + 1,
          kind: "submitted",
          createdAt: result.submittedAt,
          createdBy: get().user.name,
          runId: result.runId,
          codes: snapshotCodes(claim.codes.filter((c) => c.decision === "approved")),
        };
        patchClaim(claimId, (c) => ({ ...c, stage: "submitted", status: "submitted", submittedAt: result.submittedAt, versions: [...c.versions, submittedVersion] }));
        pushAudit(
          makeAuditEvent(claim, {
            actor: "Workflow Engine",
            actorType: "system",
            event: "Final claim version submitted",
            entity: `Claim ${claimId}`,
            runId: result.runId,
            version: submittedVersion.label,
            metadata: { edi_control_number: result.ediControlNumber, approved_codes: claim.codes.filter((c) => c.decision === "approved").map((c) => c.code).join(", ") },
          }),
        );
        return { ok: true };
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Submission failed.";
        patchClaim(claimId, (c) => ({ ...c, stage: "failed" }));
        pushAudit(
          makeAuditEvent(claim, {
            actor: "Workflow Engine",
            actorType: "system",
            event: "Submission failed",
            entity: `Claim ${claimId}`,
            metadata: { error: message, ...(e instanceof ApiError ? { status: String(e.status), code: e.code } : {}) },
          }),
        );
        return { ok: false, error: message };
      }
    },

    withdrawRequest: (claimId, reason) => {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim || isClaimLocked(claim)) return;
      patchClaim(claimId, (c) => ({ ...c, status: "withdrawn" }));
      pushAudit(
        makeAuditEvent(claim, {
          ...actor(),
          event: "Review request withdrawn",
          entity: `Claim ${claimId}`,
          previousValue: claim.status,
          newValue: "withdrawn",
          metadata: { reason: reason || "not provided", history: "preserved" },
        }),
      );
    },

    expireRequest: (claimId, reason) => {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim || isClaimLocked(claim)) return;
      patchClaim(claimId, (c) => ({ ...c, status: "expired" }));
      pushAudit(
        makeAuditEvent(claim, {
          ...actor(),
          event: "Review request expired",
          entity: `Claim ${claimId}`,
          previousValue: claim.status,
          newValue: "expired",
          metadata: { reason: reason || "not provided", history: "preserved" },
        }),
      );
    },

    markNotification: (id, state) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, state } : n)) })),
    markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => (n.state === "unread" ? { ...n, state: "read" } : n)) })),

    updateDocRequestStatus: (id, status, summary) => {
      set((s) => ({
        docRequests: s.docRequests.map((r) =>
          r.id === id ? { ...r, status, responseHistory: summary ? [{ at: new Date().toISOString(), summary }, ...r.responseHistory] : r.responseHistory } : r,
        ),
      }));
    },
  };
});

// ── Backend → UI events (SSE in live mode, in-process in mock mode) ─────────────────────────────

/** Appends a live point to a trend array and trims it so it can't grow unbounded across a long session. */
function appendKpiPoint(history: KpiPoint[], t: string, value: number, max = 90): KpiPoint[] {
  return [...history, { t, value }].slice(-max);
}

function handleBackendEvent(event: BackendEvent) {
  const { getState, setState } = useAppStore;
  const patch = (claimId: string, fn: (c: Claim) => Claim) => setState((s) => ({ claims: s.claims.map((c) => (c.id === claimId ? fn(c) : c)) }));

  switch (event.type) {
    case "regeneration.running":
      patch(event.claimId, (c) => ({ ...c, regeneration: { ...c.regeneration, state: "running" } }));
      break;

    case "regeneration.completed": {
      const claim = getState().claims.find((c) => c.id === event.claimId);
      if (!claim) return;
      const superseded = claim.codes.filter((c) => c.decision !== "pending").length;
      const number = claim.versions.filter((v) => v.kind === "draft").length + 1;
      const version: ClaimVersion = {
        label: `Draft v${number}`,
        number,
        kind: "draft",
        createdAt: event.draft.generatedAt,
        createdBy: "Coding Assistant",
        runId: event.draft.runId,
        codes: snapshotCodes(event.draft.codes),
      };
      // Earlier versions are preserved untouched; the new draft simply becomes the current one and must be reviewed again.
      patch(event.claimId, (c) => ({
        ...c,
        codes: event.draft.codes,
        model: event.draft.model,
        status: "pending_review",
        stage: "doctor_review",
        draftGeneratedAt: event.draft.generatedAt,
        reviewAgeHours: 0,
        versions: [...c.versions, version],
        regeneration: { state: "completed", count: c.regeneration.count + 1 },
      }));
      setState((s) => ({
        auditTrail: [
          makeAuditEvent(claim, {
            actor: "Workflow Engine",
            actorType: "system",
            event: "Regeneration completed",
            entity: `Claim ${event.claimId}`,
            runId: event.draft.runId,
            version: version.label,
            metadata: { new_draft: version.label, decisions_superseded: String(superseded), review_required: "true" },
          }),
          ...s.auditTrail,
        ],
      }));
      break;
    }

    case "regeneration.failed": {
      const claim = getState().claims.find((c) => c.id === event.claimId);
      patch(event.claimId, (c) => ({ ...c, regeneration: { ...c.regeneration, state: "failed" } }));
      setState((s) => ({
        auditTrail: [
          makeAuditEvent(claim, { actor: "Workflow Engine", actorType: "system", event: "Regeneration failed", entity: `Claim ${event.claimId}`, runId: event.runId, metadata: { error: event.message } }),
          ...s.auditTrail,
        ],
        notifications: [
          { id: `NTF-live-${Date.now()}-${++eventSeq}`, kind: "system", severity: "warning", title: "Regeneration failed", message: `Claim ${event.claimId}: ${event.message}`, claimId: event.claimId, createdAt: new Date().toISOString(), state: "unread" },
          ...s.notifications,
        ],
      }));
      break;
    }

    case "workflow.health":
      setState((s) => ({ workflowHealth: { ...s.workflowHealth, status: event.status, queueDepth: event.queueDepth, lastEventAt: new Date().toISOString() } }));
      break;

    case "dedup.suppressed": {
      const claim = event.claimId ? getState().claims.find((c) => c.id === event.claimId) : undefined;
      setState((s) => ({
        auditTrail: [
          makeAuditEvent(claim, { actor: "Workflow Engine", actorType: "system", event: "Duplicate trigger suppressed", entity: event.entity, metadata: { dedup_key: event.key, ...(event.requestId ? { request_id: event.requestId } : {}) } }),
          ...s.auditTrail,
        ],
      }));
      break;
    }

    case "kpi.updated": {
      const k = event.kpi;
      setState((s) => ({
        kpi: {
          ...s.kpi,
          doctorEditRate: k.doctorEditRate,
          doctorEditRateSampleSize: k.doctorEditRateSampleSize,
          doctorEditRateHistory: appendKpiPoint(s.kpi.doctorEditRateHistory, k.generatedAt, k.doctorEditRate),
          latencyMedianHours: k.latencyMedianHours,
          latencyP90Hours: k.latencyP90Hours,
          latencyHistory: appendKpiPoint(s.kpi.latencyHistory, k.generatedAt, k.latencyMedianHours),
          // A null denial rate means "no remittance feed yet" (see the KPI-refresh workflow), never "zero" —
          // keep whatever the UI already had rather than overwrite it with missing data.
          denialRateCurrent: k.denialRateCurrent ?? s.kpi.denialRateCurrent,
          denialRateBaseline: k.denialRateBaseline ?? s.kpi.denialRateBaseline,
          denialRateHistory:
            k.denialRateCurrent != null ? appendKpiPoint(s.kpi.denialRateHistory, k.generatedAt, k.denialRateCurrent) : s.kpi.denialRateHistory,
          claimsProcessed30d: k.claimsProcessed30d,
          pendingDoctorReviews: k.pendingDoctorReviews,
          regenerationCount30d: k.regenerationCount30d,
          validationFailures30d: k.validationFailures30d,
          slaApproaching: k.slaApproaching,
          reconciliationDiscrepancies: k.reconciliationDiscrepancies,
        },
      }));
      break;
    }
  }
}

configureMock({
  noteLookup: (claimId) => {
    const c = useAppStore.getState().claims.find((x) => x.id === claimId);
    return c ? { noteText: c.noteText, codeCount: c.codes.length } : null;
  },
});
api.subscribe(handleBackendEvent);
void useAppStore.getState().hydrate();
