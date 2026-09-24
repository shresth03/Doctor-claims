import { API_MODE } from "./endpoints";
import { httpApi } from "./http";
import { mockApi } from "./mockBackend";
import type { ClaimsApi } from "./contracts";

export const api: ClaimsApi = API_MODE === "live" ? httpApi : mockApi;
export { API_MODE };
export { configureMock, mockControls } from "./mockBackend";
export { setAuthTokenProvider } from "./http";
export { ApiError, ConflictError, ValidationRejectedError, REGEN_IN_PROGRESS_MESSAGE } from "./errors";
export type * from "./contracts";
