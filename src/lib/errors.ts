/** Typed application errors used across CivicLens AI services. */

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/** Input failed validation (never used to penalise citizens). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super('validation_error', message);
    this.name = 'ValidationError';
  }
}

/** Actor lacks the role/authority for this action. */
export class AuthorizationError extends AppError {
  constructor(message: string) {
    super('authorization_error', message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('not_found', message);
    this.name = 'NotFoundError';
  }
}

/** Idempotency conflict — this event was already recorded/decided. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('conflict', message);
    this.name = 'ConflictError';
  }
}
