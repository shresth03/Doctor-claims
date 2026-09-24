import type { Claim, ProposedCode } from "../types";

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
