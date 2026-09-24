import { ApiError, ConflictError, ValidationRejectedError } from "./errors";
import { BASE_URL, ENDPOINTS } from "./endpoints";
import type { BackendEvent, ClaimsApi } from "./contracts";

const TIMEOUT_MS = 20_000;

/** Auth-ready: swap in a real token source (OIDC session, cookie-backed BFF) without touching callers. */
let tokenProvider: () => string | null = () => null;
export function setAuthTokenProvider(fn: () => string | null) {
  tokenProvider = fn;
}

async function post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = tokenProvider();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.status === 409) throw new ConflictError(payload.code ?? "conflict", payload.message ?? "Conflict");
    if (res.status === 422) throw new ValidationRejectedError(payload.message ?? "Validation rejected", payload.details ?? []);
    if (!res.ok) throw new ApiError(res.status, payload.code ?? "http_error", payload.message ?? `Request failed (${res.status})`);
    return payload as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError(0, "timeout", "The workflow service did not respond in time.");
    throw new ApiError(0, "network", "Could not reach the workflow service.");
  } finally {
    clearTimeout(timer);
  }
}

export const httpApi: ClaimsApi = {
  requestRegeneration: (req) => post(ENDPOINTS.regenerate, req, req.idempotencyKey),
  submitClaim: (req) => post(ENDPOINTS.submit, req, req.idempotencyKey),
  validateCode: (req) => post(ENDPOINTS.validateCode, req),
  subscribe(handler) {
    const source = new EventSource(`${BASE_URL}${ENDPOINTS.events}`, { withCredentials: true });
    source.onmessage = (msg) => {
      try {
        handler(JSON.parse(msg.data) as BackendEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => source.close();
  },
};
