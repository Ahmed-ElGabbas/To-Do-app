import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';

/**
 * Structured JSON logger. Every line is a single JSON object so logs stay
 * queryable in any aggregator without a later migration. Never logs request
 * bodies or secrets — only explicit fields callers pass in `meta`.
 *
 * Implements Nest's LoggerService so it can back `app.useLogger(...)` and still
 * exposes convenience methods (info/debug) used across the app.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;

  setContext(context: string): void {
    this.context = context;
  }

  private write(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const line = JSON.stringify({
      level,
      ts: new Date().toISOString(),
      message,
      context: this.context,
      ...meta,
    });

    console[level === 'debug' ? 'log' : level](line);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, this.parseOptional(optionalParams));
  }

  info(message: unknown, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, this.parseOptional(optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, this.parseOptional(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, this.parseOptional(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, this.parseOptional(optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, this.parseOptional(optionalParams));
  }

  private parseOptional(
    params: unknown[],
  ): Record<string, unknown> | undefined {
    if (params.length === 0) {
      return undefined;
    }
    if (
      params.length === 1 &&
      typeof params[0] === 'object' &&
      params[0] !== null
    ) {
      return params[0] as Record<string, unknown>;
    }
    return { detail: params };
  }
}
