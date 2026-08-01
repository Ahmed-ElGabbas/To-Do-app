import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { DomainError } from '../errors/domain-error';
import { LoggerService } from '../logger/logger.service';

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId: string;
  };
}

/**
 * Single global exception filter. Maps domain errors and HTTP exceptions to
 * the consistent error envelope; unknown errors are logged with a stack trace
 * and returned as a generic INTERNAL_ERROR with no internal detail leaked.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const correlationId = request.correlationId ?? randomUUID();

    const mapped = this.map(exception);
    const { status, code, message, details } = mapped;

    if (status >= 500) {
      this.logger.error('unhandled_exception', {
        correlationId,
        code,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn('request_rejected', {
        correlationId,
        code,
        message,
      });
    }

    response.status(status).json({
      success: false,
      error: { code, message, details, correlationId },
    } satisfies ApiErrorEnvelope);
  }

  private map(exception: unknown): {
    status: HttpStatus;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof DomainError) {
      return {
        status: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const code = this.codeForStatus(status);
      if (typeof payload === 'string') {
        return { status, code, message: payload };
      }
      const body = payload as { message?: string | string[]; error?: string };
      const details =
        typeof body.message === 'string' ? undefined : body.message;
      const message =
        typeof body.message === 'string'
          ? body.message
          : (body.error ?? 'Request rejected');
      return { status, code, message, details };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'HTTP_ERROR';
    }
  }
}
