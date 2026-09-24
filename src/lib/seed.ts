import { mulberry32, pick, randInt } from "./utils";
import type {
  AppNotification,
  AuditEvent,
  Claim,
  ClaimStage,
  ClaimStatus,
  ClaimVersion,
  ComplianceAuditItem,
  DocRequest,
  Escalation,
  KpiPoint,
  KpiSnapshot,
  ModelMetadata,
  ProposedCode,
  ValidationGate,
  WorkflowHealth,
} from "../types";

const rand = mulberry32(88172645);

const DOCTORS = [
  "Dr. Amara Osei",
  "Dr. Liam Chen",
  "Dr. Priya Nair",
  "Dr. Daniel Reyes",
  "Dr. Sofia Marchetti",
  "Dr. Kwame Boateng",
];

const PATIENTS = [
  "Jordan Ellis", "Maria Castillo", "Ethan Park", "Naomi Fischer", "Owen Bright",
  "Aisha Rahman", "Lucas Ferreira", "Grace Lindqvist", "Malik Johnson", "Ivy Novak",
  "Ravi Deshmukh", "Chloe Bennett", "Samuel Okafor", "Elena Petrova", "Theo Marsh",
  "Nadia Haddad", "Caleb Whitfield", "Yuki Tanaka", "Isabel Duarte", "Marcus Webb",
];

const PAYERS = ["Meridian Health Plans", "Coastal Mutual", "Ashford Indemnity", "Northgate Assurance", "Beacon Point Insurance"];
const FACILITIES = ["Ridgeview Clinic — Main", "Ridgeview Clinic — North Annex", "Ridgeview Urgent Care"];

export const CPT_POOL: { code: string; description: string; complexity: "standard" | "high" }[] = [
  { code: "99213", description: "Established patient office visit, low complexity", complexity: "standard" },
  { code: "99214", description: "Established patient office visit, moderate complexity", complexity: "standard" },
  { code: "99215", description: "Established patient office visit, high complexity", complexity: "high" },
  { code: "99204", description: "New patient office visit, moderate-to-high complexity", complexity: "high" },
  { code: "93000", description: "Electrocardiogram, routine, with interpretation", complexity: "standard" },
  { code: "71046", description: "Chest X-ray, 2 views", complexity: "standard" },
  { code: "80053", description: "Comprehensive metabolic panel", complexity: "standard" },
  { code: "36415", description: "Collection of venous blood by venipuncture", complexity: "standard" },
  { code: "20610", description: "Arthrocentesis, aspiration/injection, major joint", complexity: "high" },
  { code: "99406", description: "Smoking cessation counseling, intermediate", complexity: "standard" },
];

export const ICD_POOL: { code: string; description: string }[] = [
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "M54.5", description: "Low back pain" },
  { code: "R07.9", description: "Chest pain, unspecified" },
  { code: "F41.1", description: "Generalized anxiety disorder" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "K21.9", description: "Gastro-esophageal reflux disease without esophagitis" },
  { code: "M17.11", description: "Unilateral primary osteoarthritis, right knee" },
  { code: "E78.5", description: "Hyperlipidemia, unspecified" },
];

interface NoteTemplate {
  text: string;
  /** codes this note genuinely supports, each tied to the sentence (0-based) that carries the evidence */
  codes: { code: string; sentence: number; alt?: string }[];
}

// Every code is paired with a sentence that actually supports it, so evidence highlighting is clinically coherent.
const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    text: "Patient with type 2 diabetes presents with worsening glycemic control despite current therapy, requiring medication adjustment. Blood pressure remains elevated at 148/92 on repeat measurement. Metformin dose increased and lisinopril initiated with follow-up in four weeks. Comprehensive metabolic panel ordered to reassess renal function and baseline markers.",
    codes: [
      { code: "99214", sentence: 2, alt: "99215" },
      { code: "E11.9", sentence: 0 },
      { code: "I10", sentence: 1 },
      { code: "80053", sentence: 3 },
    ],
  },
  {
    text: "Follow-up visit for chronic asthma management with partial improvement since the last visit. Independent interpretation of chest imaging was performed and reviewed with the patient. Escalation of medication management was discussed, including initiation of a higher-intensity controller regimen. Plan reviewed and agreed upon.",
    codes: [
      { code: "99215", sentence: 1, alt: "99214" },
      { code: "J45.909", sentence: 0 },
      { code: "71046", sentence: 1 },
    ],
  },
  {
    text: "New patient intake with comprehensive history and physical examination. Patient reports intermittent non-exertional chest pain over the past three weeks. Resting ECG was obtained and interpreted in the office. Diagnostic workup initiated including relevant labs and an imaging referral.",
    codes: [
      { code: "99204", sentence: 0, alt: "99203" },
      { code: "R07.9", sentence: 1 },
      { code: "93000", sentence: 2 },
    ],
  },
  {
    text: "Routine wellness visit with no acute complaints. Intermediate smoking cessation counseling of about seven minutes was provided. Fasting lipid results were reviewed and hyperlipidemia remains uncontrolled on current therapy. Venipuncture performed for screening labs per standard protocol.",
    codes: [
      { code: "99213", sentence: 0, alt: "99214" },
      { code: "99406", sentence: 1 },
      { code: "E78.5", sentence: 2 },
      { code: "36415", sentence: 3 },
    ],
  },
  {
    text: "Patient presents for acute complaint with localized right knee pain and limited range of motion. Physical exam consistent with osteoarthritis and a joint effusion. Arthrocentesis with corticosteroid injection was performed on the right knee under sterile technique. Follow-up scheduled in two weeks.",
    codes: [
      { code: "99213", sentence: 0, alt: "99214" },
      { code: "M17.11", sentence: 1 },
      { code: "20610", sentence: 2 },
    ],
  },
  {
    text: "Patient reports two weeks of burning epigastric discomfort after meals, consistent with reflux. A trial of a proton pump inhibitor was started. Low back pain with prolonged sitting is managed conservatively. Anxiety symptoms are stable on the current plan.",
    codes: [
      { code: "99213", sentence: 1 },
      { code: "K21.9", sentence: 0 },
      { code: "M54.5", sentence: 2 },
      { code: "F41.1", sentence: 3 },
    ],
  },
];

const MODEL_METADATA: ModelMetadata = {
  model_provider: "internal-coding-assistant",
  model_name: "clinical-extraction-v3",
  model_version: "3.4.1",
  workflow_version: "claims-pipeline-2026.09",
  ruleset_version: "cms-payer-ruleset-2026-Q3",
};

function isoMinusHours(hours: number): string {
  return new Date(Date.now() - hours * 36e5).toISOString();
}
function isoPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 36e5).toISOString();
}

type GateMode = "ok" | "warning" | "failed" | "unavailable";

export function makeValidationGates(mode: GateMode = "ok"): ValidationGate[] {
  const gates: ValidationGate[] = [
    { key: "documentation_requirement", label: "Documentation requirement", status: "passed" },
    { key: "signed_note", label: "Signed note", status: "passed" },
    { key: "billable_event", label: "Billable event", status: "passed" },
    { key: "active_policy", label: "Active policy", status: "passed" },
  ];
  if (mode === "warning") {
    gates[0] = { ...gates[0], status: "warning", detail: "Documentation is present but does not meet the payer's preferred level of specificity." };
  } else if (mode === "failed") {
    gates[0] = { ...gates[0], status: "failed", detail: "Required documentation evidence could not be verified." };
  } else if (mode === "unavailable") {
    gates[3] = { ...gates[3], status: "unavailable", detail: "Policy eligibility service did not respond. Validation could not be completed." };
  }
  return gates;
}

function pickGateMode(): GateMode {
  const r = rand();
  if (r > 0.95) return "unavailable";
  if (r > 0.9) return "failed";
  if (r > 0.82) return "warning";
  return "ok";
}

/** Splits note text into sentences with character offsets so evidence always aligns to a full sentence. */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const re = /[^.!?]+[.!?]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const start = m.index + lead;
    const trimmed = raw.trim();
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

let codeSeq = 0;

const CATALOG = new Map<string, { description: string; category: "CPT" | "ICD-10"; complexity: "standard" | "high" }>([
  ...CPT_POOL.map((c) => [c.code, { description: c.description, category: "CPT" as const, complexity: c.complexity }] as const),
  ...ICD_POOL.map((c) => [c.code, { description: c.description, category: "ICD-10" as const, complexity: "standard" as const }] as const),
]);

function makeCode(code: string, sentence: { text: string; start: number; end: number }, modelVariance = false): ProposedCode {
  const entry = CATALOG.get(code) ?? { description: "Description pending catalog lookup", category: "CPT" as const, complexity: "standard" as const };
  const high = entry.complexity === "high";
  const confidence = high ? 0.72 + rand() * 0.26 : 0.82 + rand() * 0.17;
  const mode = modelVariance ? pickGateMode() : rand() > 0.9 ? pickGateMode() : "ok";
  return {
    id: `code_${(++codeSeq).toString(36)}_${Math.floor(rand() * 1e6).toString(36)}`,
    code,
    category: entry.category,
    description: entry.description,
    confidence,
    complexity: entry.complexity,
    complexityReason: high
      ? "High-complexity level: complexity/reimbursement value is above the configured review threshold. Additional documentation review is required; this does not mean the code is incorrect."
      : undefined,
    evidence: { excerpt: sentence.text, start: sentence.start, end: sentence.end },
    validation: makeValidationGates(mode),
    quarantined: mode === "failed",
    decision: "pending",
  };
}

/**
 * Produces a fresh set of proposed codes for a note. Used by the seed and by the mock workflow backend on regeneration.
 * A regenerated draft may legitimately differ (e.g. a different E/M level), which is what makes version diffs meaningful.
 */
export function generateDraftCodes(noteText: string, _count?: number, variance = false): ProposedCode[] {
  const template = NOTE_TEMPLATES.find((t) => t.text === noteText);
  if (!template) return [];
  const sentences = splitSentences(noteText);
  return template.codes.map((c) => {
    const useAlt = variance && c.alt && rand() > 0.5;
    return makeCode(useAlt ? c.alt! : c.code, sentences[c.sentence] ?? sentences[0], variance);
  });
}

export function snapshotCodes(codes: ProposedCode[]): ClaimVersion["codes"] {
  return codes.map((c) => ({
    code: c.code,
    category: c.category,
    description: c.description,
    decision: c.decision,
    proposedCode: c.originalCode,
  }));
}

export { MODEL_METADATA };

const STAGE_BY_STATUS: Record<ClaimStatus, ClaimStage> = {
  pending_review: "doctor_review",
  partially_reviewed: "doctor_review",
  approved: "approved",
  needs_correction: "doctor_review",
  expired: "doctor_review",
  withdrawn: "doctor_review",
  submitted: "submitted",
};

export function generateClaims(count: number): Claim[] {
  const statuses: ClaimStatus[] = [
    "pending_review", "pending_review", "pending_review",
    "partially_reviewed", "partially_reviewed",
    "approved", "needs_correction", "expired", "withdrawn",
    "submitted", "submitted", "submitted",
  ];

  return Array.from({ length: count }).map((_, i) => {
    const doctorName = pick(rand, DOCTORS);
    const patientName = pick(rand, PATIENTS);
    const noteText = pick(rand, NOTE_TEMPLATES).text;
    const status = pick(rand, statuses);
    const codes = generateDraftCodes(noteText);
    const codeCount = codes.length;

    if (status === "partially_reviewed") {
      const decided = randInt(rand, 1, codes.length - 1);
      for (let d = 0; d < decided; d++) codes[d].decision = rand() > 0.2 ? "approved" : "rejected";
    }
    if (status === "approved" || status === "submitted") {
      codes.forEach((c) => (c.decision = "approved"));
    }
    if (status === "needs_correction") {
      codes[0].decision = "rejected";
      codes[0].rejectionReason = pick(rand, ["unsupported_by_documentation", "incorrect_code", "incorrect_complexity"] as const);
    }

    // Decided codes must be clean: an approved code can't carry a failed/unavailable gate.
    codes.forEach((c) => {
      if (c.decision === "approved" && (c.quarantined || c.validation.some((v) => v.status === "unavailable"))) {
        c.validation = makeValidationGates("ok");
        c.quarantined = false;
      }
    });

    // Seed a doctor-edited final code on some finished claims so version diffs have real content.
    const cptIdx = codes.findIndex((c) => c.category === "CPT" && c.decision === "approved");
    if ((status === "approved" || status === "submitted") && cptIdx >= 0 && rand() > 0.7) {
      const replacement = pick(rand, CPT_POOL.filter((p) => p.code !== codes[cptIdx].code));
      codes[cptIdx] = {
        ...codes[cptIdx],
        originalCode: codes[cptIdx].code,
        originalDescription: codes[cptIdx].description,
        code: replacement.code,
        description: replacement.description,
      };
    }

    const reviewAgeHours = status === "pending_review" || status === "partially_reviewed"
      ? randInt(rand, 1, 40)
      : randInt(rand, 1, 12);

    const draftGeneratedAt = isoMinusHours(reviewAgeHours + randInt(rand, 0, 3));

    const regenCount = rand() > 0.85 ? 1 : 0;
    const claimRun = `run_V-${73000 + i}`;
    const versions: ClaimVersion[] = [];
    // Draft v1 is always the AI's original proposal (pre-edit, undecided).
    const proposedCodes = codes.map((c) => ({ ...c, decision: "pending" as const, code: c.originalCode ?? c.code, description: c.originalDescription ?? c.description }));
    if (regenCount > 0) {
      versions.push({ label: "Draft v1", number: 1, kind: "draft", createdAt: isoMinusHours(reviewAgeHours + 20), createdBy: "Coding Assistant", runId: `${claimRun}_a`, codes: snapshotCodes(generateDraftCodes(noteText, codeCount, true)) });
      versions.push({ label: "Draft v2", number: 2, kind: "draft", createdAt: draftGeneratedAt, createdBy: "Coding Assistant", runId: `${claimRun}_b`, codes: snapshotCodes(proposedCodes) });
    } else {
      versions.push({ label: "Draft v1", number: 1, kind: "draft", createdAt: draftGeneratedAt, createdBy: "Coding Assistant", runId: claimRun, codes: snapshotCodes(proposedCodes) });
    }
    if (status === "submitted") {
      const n = versions.length + 1;
      versions.push({ label: `Submitted v${n}`, number: n, kind: "submitted", createdAt: isoMinusHours(randInt(rand, 0, 5)), createdBy: doctorName, runId: claimRun, codes: snapshotCodes(codes) });
    }

    return {
      id: `C-${48000 + i}`,
      visitId: `V-${73000 + i}`,
      patientName,
      patientId: `P-${10000 + i}`,
      doctorId: doctorName.replace(/\W+/g, "-").toLowerCase(),
      doctorName,
      payer: pick(rand, PAYERS),
      facility: pick(rand, FACILITIES),
      draftGeneratedAt,
      stage: STAGE_BY_STATUS[status],
      status,
      codes,
      noteText,
      noteSignedAt: isoMinusHours(reviewAgeHours + randInt(rand, 3, 6)),
      submittedAt: status === "submitted" ? isoMinusHours(randInt(rand, 0, 5)) : undefined,
      regeneration: { state: "idle", count: regenCount },
      model: MODEL_METADATA,
      reviewAgeHours,
      versions,
    };
  });
}

const DOC_TYPES = [
  "Medical necessity documentation", "Itemized procedure notes", "Prior authorization proof",
  "Diagnostic imaging report", "Physician attestation letter", "Corrected claim justification",
];

export function generateDocRequests(claims: Claim[], count: number): DocRequest[] {
  const statuses = ["new", "in_progress", "awaiting_document", "ready_to_send", "submitted", "sla_breach"] as const;
  return Array.from({ length: count }).map((_, i) => {
    const claim = pick(rand, claims);
    const status = pick(rand, statuses);
    const receivedHoursAgo = randInt(rand, 2, 140);
    const dueOffset = status === "sla_breach" ? -randInt(rand, 1, 30) : randInt(rand, 2, 96);
    return {
      id: `DR-${9100 + i}`,
      claimId: claim.id,
      insurer: claim.payer,
      patientId: claim.patientId,
      requestType: pick(rand, DOC_TYPES),
      receivedAt: isoMinusHours(receivedHoursAgo),
      dueAt: dueOffset < 0 ? isoMinusHours(-dueOffset) : isoPlusHours(dueOffset),
      priority: pick(rand, ["low", "normal", "high", "urgent"] as const),
      status,
      owner: pick(rand, ["Jenna Park", "Marcus Diallo", "Hannah Lindgren"]),
      requestedDocs: [pick(rand, DOC_TYPES), pick(rand, DOC_TYPES)],
      notes: [],
      responseHistory: status === "submitted" ? [{ at: isoMinusHours(randInt(rand, 1, 40)), summary: "Response package sent to insurer portal." }] : [],
    };
  });
}

export function generateComplianceQueue(claims: Claim[], count: number): ComplianceAuditItem[] {
  const highComplexityClaims = claims.filter((c) => c.codes.some((code) => code.complexity === "high"));
  const statuses = ["selected", "in_review", "validated", "issue_found", "escalated"] as const;
  return Array.from({ length: count }).map((_, i) => {
    const claim = pick(rand, highComplexityClaims.length ? highComplexityClaims : claims);
    const code = claim.codes.find((c) => c.complexity === "high") ?? claim.codes[0];
    return {
      id: `AUD-${5200 + i}`,
      claimId: claim.id,
      code: code.code,
      doctorName: claim.doctorName,
      complexity: code.complexity,
      aiProposal: `${code.code} — ${code.description}`,
      doctorDecision: code.decision,
      evidence: code.evidence.excerpt,
      payerRule: "CMS documentation-sufficiency standard, high-complexity E/M",
      selectionReason: "Random weekly sample — high-complexity code above review threshold",
      status: pick(rand, statuses),
      workflowVersion: MODEL_METADATA.workflow_version,
    };
  });
}

export function generateEscalations(claims: Claim[], count: number): Escalation[] {
  const severities = ["low", "medium", "high", "critical"] as const;
  const statuses = ["open", "investigating", "assigned", "resolved"] as const;
  const errorTypes = [
    "High-confidence proposal rejected by doctor as unsupported",
    "Audit found proposal lacked required evidence despite high confidence",
    "Complexity level overstated relative to documented evidence",
  ];
  return Array.from({ length: count }).map((_, i) => {
    const claim = pick(rand, claims);
    const code = pick(rand, claim.codes);
    return {
      id: `ESC-${3100 + i}`,
      claimId: claim.id,
      code: code.code,
      confidence: 0.9 + rand() * 0.09,
      errorType: pick(rand, errorTypes),
      evidence: code.evidence.excerpt,
      finalCorrection: `Corrected to ${pick(rand, CPT_POOL).code} after doctor review`,
      model: MODEL_METADATA,
      timestamp: isoMinusHours(randInt(rand, 4, 300)),
      severity: pick(rand, severities),
      status: pick(rand, statuses),
      assignedTo: rand() > 0.5 ? pick(rand, ["Rhea Kapoor", "Compliance Team"]) : undefined,
      findings: [],
    };
  });
}

function history(days: number, base: number, amp: number): KpiPoint[] {
  return Array.from({ length: days }).map((_, i) => ({
    t: isoMinusHours((days - i) * 24),
    value: Math.max(0, base + Math.sin(i / 3) * amp + (rand() - 0.5) * amp * 0.6),
  }));
}

export function generateKpiSnapshot(): KpiSnapshot {
  return {
    doctorEditRate: 0.148,
    doctorEditRateSampleSize: 412,
    doctorEditRateHistory: history(30, 0.15, 0.04),
    denialRateCurrent: 0.072,
    denialRateBaseline: 0.058,
    denialRateHistory: history(30, 0.065, 0.015),
    latencyMedianHours: 8.7,
    latencyP90Hours: 19.4,
    latencyHistory: history(30, 9, 3),
    claimsProcessed30d: 1284,
    pendingDoctorReviews: 37,
    regenerationCount30d: 22,
    validationFailures30d: 64,
    slaApproaching: 5,
    reconciliationDiscrepancies: 2,
  };
}

const EVENT_TEMPLATES: { event: string; actorType: AuditEvent["actorType"] }[] = [
  { event: "Signed note received", actorType: "system" },
  { event: "Note excerpt used by AI extraction", actorType: "ai" },
  { event: "Diagnosis extracted", actorType: "ai" },
  { event: "Procedure code proposed", actorType: "ai" },
  { event: "Validation result recorded", actorType: "system" },
  { event: "Supporting evidence selected", actorType: "ai" },
  { event: "Doctor approved code", actorType: "doctor" },
  { event: "Doctor rejected code", actorType: "doctor" },
  { event: "Doctor edited code", actorType: "doctor" },
  { event: "Regeneration requested", actorType: "doctor" },
  { event: "Regeneration completed", actorType: "system" },
  { event: "Final claim version submitted", actorType: "system" },
  { event: "Insurer documentation request received", actorType: "system" },
  { event: "Documentation sent to insurer", actorType: "billing_coordinator" },
  { event: "Reconciliation result recorded", actorType: "system" },
  { event: "Audit selection recorded", actorType: "compliance_officer" },
  { event: "Compliance decision recorded", actorType: "compliance_officer" },
  { event: "Duplicate trigger suppressed", actorType: "system" },
  { event: "Code quarantined — validation failed", actorType: "system" },
];

function eventMetadata(event: string, claim: Claim, code?: ProposedCode): Record<string, string> | undefined {
  switch (event) {
    case "Note excerpt used by AI extraction":
    case "Supporting evidence selected":
      return code ? { excerpt: `"${code.evidence.excerpt}"`, offset: `${code.evidence.start}–${code.evidence.end}`, note_signed_at: claim.noteSignedAt } : undefined;
    case "Procedure code proposed":
    case "Diagnosis extracted":
      return code ? { code: code.code, category: code.category, model_confidence: `${Math.round(code.confidence * 100)}%`, ruleset_version: claim.model.ruleset_version } : undefined;
    case "Validation result recorded":
      return code ? Object.fromEntries(code.validation.map((v) => [v.key, v.status])) : undefined;
    case "Doctor rejected code":
      return { reason: code?.rejectionReason ?? "unsupported_by_documentation", decision_scope: "single code" };
    case "Doctor approved code":
      return { decision_scope: "single code", high_complexity_review: code?.complexity === "high" ? "acknowledged" : "n/a" };
    case "Duplicate trigger suppressed":
      return { dedup_key: `${claim.visitId}+${claim.status}`, suppressed_by: "visit_id + claim_status" };
    case "Code quarantined — validation failed":
      return { failed_gate: "documentation_requirement", detail: "Required documentation evidence could not be verified." };
    default:
      return { workflow_version: claim.model.workflow_version };
  }
}

export function generateAuditTrail(claims: Claim[], count: number): AuditEvent[] {
  const events = Array.from({ length: count }).map((_, i) => {
    const claim = pick(rand, claims);
    const tmpl = pick(rand, EVENT_TEMPLATES);
    const code = rand() > 0.4 ? pick(rand, claim.codes) : undefined;
    return {
      id: `EVT-${100000 + i}`,
      // events must fall inside the claim's own lifetime: after the note was signed, before now
      timestamp: new Date(new Date(claim.noteSignedAt).getTime() + rand() * (Date.now() - new Date(claim.noteSignedAt).getTime())).toISOString(),
      actor: tmpl.actorType === "ai" ? "Coding Assistant" : tmpl.actorType === "system" ? "Workflow Engine" : tmpl.actorType === "doctor" ? claim.doctorName : tmpl.actorType === "billing_coordinator" ? "Jenna Park" : "Rhea Kapoor",
      actorType: tmpl.actorType,
      event: tmpl.event,
      entity: code ? `Code ${code.code}` : `Claim ${claim.id}`,
      claimId: claim.id,
      visitId: claim.visitId,
      patientId: claim.patientId,
      code: code?.code,
      previousValue: tmpl.event === "Doctor edited code" ? code?.code : undefined,
      newValue: tmpl.event === "Doctor edited code" ? pick(rand, CPT_POOL).code : undefined,
      runId: `run_${claim.visitId}`,
      version: [...claim.versions].reverse().find((v) => v.kind === "draft")?.label,
      metadata: eventMetadata(tmpl.event, claim, code),
    } satisfies AuditEvent;
  });
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateNotifications(claims: Claim[]): AppNotification[] {
  const stuck = claims.filter((c) => c.reviewAgeHours > 24 && (c.status === "pending_review" || c.status === "partially_reviewed")).slice(0, 3);
  const quarantined = claims.filter((c) => c.codes.some((code) => code.quarantined)).slice(0, 2);

  const notifications: AppNotification[] = stuck.map((c, i) => ({
    id: `NTF-stuck-${i}`,
    kind: "stuck_draft",
    title: "Claim awaiting doctor review",
    message: `Claim ${c.id} has been awaiting doctor review for ${Math.round(c.reviewAgeHours)} hours.`,
    createdAt: isoMinusHours(1),
    state: "unread",
    claimId: c.id,
    severity: "warning",
  }));

  notifications.push({
    id: "NTF-sla-1",
    kind: "sla_breach",
    title: "Documentation SLA breach",
    message: "Request DR-9104 has been unanswered for 5+ days.",
    createdAt: isoMinusHours(2),
    state: "unread",
    severity: "critical",
  });

  quarantined.forEach((c, i) => {
    const code = c.codes.find((code) => code.quarantined);
    notifications.push({
      id: `NTF-quar-${i}`,
      kind: "quarantine",
      title: "Code quarantined",
      message: `Code ${code?.code} on claim ${c.id} has been quarantined because required documentation evidence could not be verified.`,
      createdAt: isoMinusHours(4 + i),
      state: i === 0 ? "unread" : "read",
      claimId: c.id,
      severity: "warning",
    });
  });

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function generateWorkflowHealth(): WorkflowHealth {
  return {
    status: "healthy",
    lastEventAt: isoMinusHours(0.02),
    queueDepth: 3,
    environment: "demo",
  };
}
