import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

/**
 * Logs a request start/end pair (with duration and outcome) as structured JSON
 * keyed by the request's correlation ID.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const correlationId =
      (request.correlationId as string | undefined) ?? 'no-correlation-id';
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    this.logger.info('request_start', {
      correlationId,
      method,
      url: originalUrl,
    });

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.info('request_end', {
          correlationId,
          method,
          url: originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      }),
    );
  }
}
