import { isUUID } from 'class-validator';
import type { Response } from 'express';
import {
  correlationIdMiddleware,
  CORRELATION_ID_HEADER,
} from './correlation-id.middleware';

function createRequest(headers: Record<string, string>) {
  return { headers, correlationId: undefined };
}

function createResponse() {
  const setHeader = jest.fn();
  return { response: { setHeader } as unknown as Response, setHeader };
}

function createNext() {
  return jest.fn();
}

describe('correlationIdMiddleware', () => {
  it('reuses an incoming X-Correlation-Id header and echoes it back', () => {
    const req = createRequest({ [CORRELATION_ID_HEADER]: 'trace-123' });
    const { response, setHeader } = createResponse();
    const next = createNext();

    correlationIdMiddleware(req as never, response, next);

    expect(req.correlationId).toBe('trace-123');
    expect(setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'trace-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID v4 when the header is absent', () => {
    const req = createRequest({});
    const { response, setHeader } = createResponse();
    const next = createNext();

    correlationIdMiddleware(req as never, response, next);

    expect(req.correlationId).toBeDefined();
    expect(isUUID(req.correlationId as string, '4')).toBe(true);
    expect(setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      req.correlationId,
    );
  });

  it('ignores a blank header value', () => {
    const req = createRequest({ [CORRELATION_ID_HEADER]: '   ' });
    const response = createResponse().response;
    const next = createNext();

    correlationIdMiddleware(req as never, response, next);

    expect(req.correlationId).toBeDefined();
    expect(isUUID(req.correlationId as string, '4')).toBe(true);
  });
});
