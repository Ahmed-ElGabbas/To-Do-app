import {
  ConflictError,
  DomainError,
  ForbiddenActionError,
  ResourceNotFoundError,
  UnauthorizedError,
  ValidationError,
} from './domain-error';

describe('DomainError', () => {
  it('subclasses Error with the subclass name', () => {
    const err = new ConflictError('taken');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe('ConflictError');
    expect(err.message).toBe('taken');
  });

  it('carries a stable code and http status', () => {
    expect(new ResourceNotFoundError('missing').code).toBe(
      'RESOURCE_NOT_FOUND',
    );
    expect(new ResourceNotFoundError('missing').httpStatus).toBe(404);
    expect(new ConflictError().code).toBe('CONFLICT');
    expect(new ConflictError().httpStatus).toBe(409);
    expect(new ForbiddenActionError().code).toBe('FORBIDDEN');
    expect(new ForbiddenActionError().httpStatus).toBe(403);
    expect(new UnauthorizedError().code).toBe('UNAUTHORIZED');
    expect(new UnauthorizedError().httpStatus).toBe(401);
    expect(new ValidationError('bad').code).toBe('VALIDATION_ERROR');
    expect(new ValidationError('bad').httpStatus).toBe(422);
  });

  it('attaches optional details', () => {
    const err = new ValidationError('bad', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});
