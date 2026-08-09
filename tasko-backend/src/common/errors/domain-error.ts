/**
 * Base class for all domain-level errors.
 *
 * Services throw these instead of raw NestJS HTTP exceptions so that business
 * logic stays testable without an HTTP context. The global HttpExceptionFilter
 * maps `code` + `httpStatus` to the consistent error envelope.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor(message = 'Resource not found', details?: unknown) {
    super('RESOURCE_NOT_FOUND', 404, message, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super('CONFLICT', 409, message, details);
  }
}

export class ForbiddenActionError extends DomainError {
  constructor(message = 'You are not allowed to perform this action') {
    super('FORBIDDEN', 403, message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(code, 401, message);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('BUSINESS_VALIDATION_ERROR', 422, message, details);
  }
}
