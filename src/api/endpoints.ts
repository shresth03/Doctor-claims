/** n8n webhook paths. Base URL comes from VITE_N8N_BASE_URL; no credentials ever live in the bundle. */
export const ENDPOINTS = {
  regenerate: "/webhook/claims/regenerate",
  submit: "/webhook/claims/doctor-callback",
  validateCode: "/webhook/claims/validate-code",
  events: "/events/stream",
} as const;

export const API_MODE: "mock" | "live" = import.meta.env.VITE_API_MODE === "live" ? "live" : "mock";
export const BASE_URL: string = import.meta.env.VITE_N8N_BASE_URL ?? "";
