import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface CorrelationRequest extends Request {
  correlationId?: string;
}

/**
 * Reuses an incoming `X-Correlation-Id` header when present (echoing it back on
 * the response) and otherwise generates a fresh UUID. Guarantees every request
 * carries a correlationId for the logging interceptor and error filters.
 */
export function correlationIdMiddleware(
  req: CorrelationRequest,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const correlationId =
    typeof incoming === 'string' && incoming.trim() !== ''
      ? incoming.trim()
      : randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}
