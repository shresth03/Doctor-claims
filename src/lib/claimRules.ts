import type { BreachState } from "../components/ui/KpiTile";
import type { Claim, KpiPoint, ProposedCode } from "../types";

const LOCKED_STATUSES: Claim["status"][] = ["submitted", "withdrawn", "expired"];

export function isClaimLocked(claim: Claim): boolean {
  return LOCKED_STATUSES.includes(claim.status) || claim.stage === "submission";
}

export function isRegenerationBusy(claim: Claim): boolean {
  return claim.regeneration.state === "requested" || claim.regeneration.state === "running";
}

/** Returns why a code cannot be approved, or null if approval is allowed. Missing validation is never treated as passed. */
export function approvalBlocker(code: ProposedCode): string | null {
  if (code.revalidating) return "Replacement code is being re-validated.";
  if (code.quarantined || code.validation.some((v) => v.status === "failed")) {
    return "Quarantined: a validation gate failed. Reject or replace this code.";
  }
  if (code.validation.some((v) => v.status === "unavailable")) {
    return "Validation incomplete: a required check was unavailable. It cannot be approved until it passes.";
  }
  return null;
}

/** Everything that must be resolved before Sign Off & Submit is enabled. Empty array = ready. */
export function getSignOffBlockers(claim: Claim): string[] {
  const blockers: string[] = [];
  if (claim.status === "submitted") return ["This claim has already been submitted."];
  if (claim.status === "withdrawn") return ["This review request was withdrawn."];
  if (claim.status === "expired") return ["This review request has expired."];
  if (claim.stage === "submission") blockers.push("Submission is already in progress.");
  if (isRegenerationBusy(claim)) blockers.push("A regeneration is in progress.");

  const pending = claim.codes.filter((c) => c.decision === "pending");
  if (pending.length > 0) blockers.push(`${pending.length} code${pending.length > 1 ? "s" : ""} still need an individual decision.`);

  if (claim.codes.some((c) => c.revalidating)) blockers.push("A replacement code is still being validated.");

  for (const c of claim.codes) {
    if (c.decision === "approved") {
      const blocker = approvalBlocker(c);
      if (blocker) blockers.push(`${c.code}: ${blocker}`);
    }
  }

  if (pending.length === 0 && !claim.codes.some((c) => c.decision === "approved")) {
    blockers.push("At least one code must be approved to submit a claim.");
  }
  return blockers;
}

/**
 * The backend/database contract stores and computes "doctor edit rate" — how often a doctor changes
 * an AI-proposed code — because that's the number the compliance queue and the KPI-refresh workflow
 * actually query. But displaying it under that name frames the doctor as the thing being watched.
 * This reframes the identical number as "AI match rate" (1 - edit rate): same data, but it centers
 * the model's performance instead of implying a doctor's decisions are under surveillance. Only the
 * presentation layer changes here — never rename the underlying field, since that's the backend's
 * source of truth (see n8n/README.md and Claims 09 · KPI refresh).
 */
export function toAiMatchRate(editRate: number, history: KpiPoint[]): { value: number; breach: BreachState; history: KpiPoint[] } {
  const value = 1 - editRate;
  return {
    value,
    breach: value < 0.8 ? "breach" : value < 0.84 ? "approaching" : "normal",
    history: history.map((p) => ({ t: p.t, value: 1 - p.value })),
  };
}
