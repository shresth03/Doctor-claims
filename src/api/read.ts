import { ApiError } from "./errors";
import { BASE_URL, ENDPOINTS } from "./endpoints";
import type { AppNotification, AuditEvent, Claim, ComplianceAuditItem, DocRequest, Escalation, KpiSnapshot } from "../types";

/**
 * The initial-load half of the API layer. `ClaimsApi` (contracts.ts) covers actions the doctor/
 * billing/compliance UI triggers; this covers what the app fetches once on startup to populate
 * the store. Split out because they have very different shapes (GET+no-body vs POST+idempotency)
 * and because mock mode can serve this synchronously from local generators with zero network.
 */
export interface ReadApi {
  listClaims(): Promise<Claim[]>;
  listDocRequests(): Promise<DocRequest[]>;
  listComplianceQueue(): Promise<ComplianceAuditItem[]>;
  listEscalations(): Promise<Escalation[]>;
  listNotifications(): Promise<AppNotification[]>;
  listAuditTrail(): Promise<AuditEvent[]>;
  getKpiSnapshot(): Promise<KpiSnapshot>;
}

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new ApiError(res.status, "http_error", `Failed to load ${path} (${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError(0, "timeout", `Timed out loading ${path}`);
    throw new ApiError(0, "network", `Could not reach the workflow service for ${path}`);
  } finally {
    clearTimeout(timer);
  }
}

export const httpReadApi: ReadApi = {
  listClaims: () => get(ENDPOINTS.list.claims),
  listDocRequests: () => get(ENDPOINTS.list.docRequests),
  listComplianceQueue: () => get(ENDPOINTS.list.complianceQueue),
  listEscalations: () => get(ENDPOINTS.list.escalations),
  listNotifications: () => get(ENDPOINTS.list.notifications),
  listAuditTrail: () => get(ENDPOINTS.list.auditTrail),
  getKpiSnapshot: () => get(ENDPOINTS.list.kpi),
};
