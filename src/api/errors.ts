export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** HTTP 409 / application-level conflict, e.g. the regeneration lock is already held. */
export class ConflictError extends ApiError {
  constructor(code: string, message: string) {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

/** Backend refused the request because a validation rule did not pass (HTTP 422). */
export class ValidationRejectedError extends ApiError {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(422, "validation_rejected", message);
    this.name = "ValidationRejectedError";
    this.details = details;
  }
}

export const REGEN_IN_PROGRESS_MESSAGE = "Regeneration is already in progress.";
