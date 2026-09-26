/** n8n webhook paths. Base URL comes from VITE_N8N_BASE_URL; no credentials ever live in the bundle. */
export const ENDPOINTS = {
  regenerate: "/webhook/claims/regenerate",
  submit: "/webhook/claims/doctor-callback",
  validateCode: "/webhook/claims/validate-code",
  /** served by the event relay, not n8n — see EVENT_RELAY_URL below */
  events: "/events/stream",
  list: {
    claims: "/webhook/claims/list",
    docRequests: "/webhook/claims/doc-requests",
    complianceQueue: "/webhook/claims/compliance-queue",
    escalations: "/webhook/claims/escalations",
    notifications: "/webhook/claims/notifications",
    auditTrail: "/webhook/claims/audit-trail",
    kpi: "/webhook/claims/kpi",
  },
} as const;

export const API_MODE: "mock" | "live" = import.meta.env.VITE_API_MODE === "live" ? "live" : "mock";
export const BASE_URL: string = import.meta.env.VITE_N8N_BASE_URL ?? "";
/**
 * The event relay is a separate process from n8n (n8n has no way to push to open browser tabs on
 * its own — see n8n/event-relay/README-equivalent notes in n8n/README.md). Falls back to BASE_URL
 * so a same-origin deployment (relay reverse-proxied behind the n8n host) still works with one var.
 */
export const EVENT_RELAY_URL: string = import.meta.env.VITE_EVENT_RELAY_URL ?? BASE_URL;
