import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../../infrastructure/firebase/firebase-admin.service';
import { UnauthorizedError } from '../errors/domain-error';
import { LoggerService } from '../logger/logger.service';

export const APP_CHECK_TOKEN_HEADER = 'x-firebase-app-check';

/**
 * Path prefixes that can never carry an App Check token by design: infra
 * liveness/readiness probes and the `/.well-known/` association files served
 * to verification crawlers. Skipped entirely (no log, no enforcement) so
 * monitor-mode logs reflect real app traffic and a future enforce-mode flip
 * cannot break infra probes or App Links/Universal Links verification.
 */
const EXEMPT_PATH_PREFIXES = ['/health', '/.well-known/'];

/**
 * Firebase App Check guard.
 *
 * App Check answers "is this request coming from a genuine, unmodified
 * instance of the Tasko app?" — a client-integrity guarantee that is distinct
 * from ThrottlerGuard (rate) and JwtAuthGuard (user identity) and replaces
 * neither.
 *
 * MONITOR MODE (default, APP_CHECK_ENFORCE unset or false): the token is
 * verified when present and the outcome (pass / reject / missing) is logged as
 * structured JSON against the request's correlation ID, but the request is
 * always allowed through. Flipping `APP_CHECK_ENFORCE=true` switches to real
 * enforcement with no code change.
 */
@Injectable()
export class AppCheckGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.firebase.isConfigured()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const correlationId =
      (request.correlationId as string | undefined) ?? 'no-correlation-id';
    const method = request.method as string;
    const path = request.path as string;

    if (EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    const enforce = this.config.get<boolean>('appCheck.enforce', false);
    const header = request.headers[APP_CHECK_TOKEN_HEADER];
    const token =
      typeof header === 'string' && header.trim() !== '' ? header.trim() : null;

    if (!token) {
      this.logger.warn('app_check_missing', {
        correlationId,
        method,
        path,
        enforce,
      });
      if (enforce) {
        throw new UnauthorizedError('App Check token is required');
      }
      return true;
    }

    try {
      const result = await this.firebase.getAppCheck().verifyToken(token);
      this.logger.info('app_check_pass', {
        correlationId,
        method,
        path,
        appId: result.appId,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid App Check token';
      const code = (error as { code?: unknown }).code;
      this.logger.warn('app_check_reject', {
        correlationId,
        method,
        path,
        enforce,
        message,
        code: typeof code === 'string' ? code : undefined,
      });
      if (enforce) {
        throw new UnauthorizedError('App Check verification failed');
      }
      return true;
    }
  }
}
