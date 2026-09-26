import { API_MODE } from "./endpoints";
import { httpApi } from "./http";
import { httpReadApi } from "./read";
import { mockApi, mockReadApi } from "./mockBackend";
import type { ClaimsApi } from "./contracts";
import type { ReadApi } from "./read";

export const api: ClaimsApi = API_MODE === "live" ? httpApi : mockApi;
export const readApi: ReadApi = API_MODE === "live" ? httpReadApi : mockReadApi;
export { API_MODE };
export { configureMock, mockControls } from "./mockBackend";
export { setAuthTokenProvider } from "./http";
export { ApiError, ConflictError, ValidationRejectedError, REGEN_IN_PROGRESS_MESSAGE } from "./errors";
export type * from "./contracts";
export type { ReadApi } from "./read";
