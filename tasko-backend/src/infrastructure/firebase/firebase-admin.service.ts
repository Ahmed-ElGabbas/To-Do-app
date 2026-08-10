import { readFileSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { UnauthorizedError } from '../../common/errors/domain-error';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Thin, lazy wrapper around the Firebase Admin SDK's ID-token verification.
 *
 * The Admin SDK is only initialized on first use, when `verifyIdToken()` is
 * called. This keeps local dev and the test suites bootable without any
 * Firebase credentials: with no `FIREBASE_PROJECT_ID` /
 * `FIREBASE_SERVICE_ACCOUNT_PATH` / `FIREBASE_SERVICE_ACCOUNT_JSON` configured,
 * social-login requests are rejected as unauthorized instead of crashing the
 * process at startup.
 */
@Injectable()
export class FirebaseAdminService {
  private app: App | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Verifies a Firebase ID token issued by the app's Firebase Auth project and
   * returns its decoded claims. Invalid/expired tokens surface as a 401.
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await this.getAuth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.warn('firebase_id_token_rejected', {
        message: error instanceof Error ? error.message : 'Invalid ID token',
      });
      throw new UnauthorizedError('Invalid or expired sign-in token');
    }
  }

  private getAuth(): Auth {
    return getAuth(this.ensureInitialized());
  }

  /** Returns the default Admin app, initializing it exactly once per process. */
  private ensureInitialized(): App {
    if (this.app) {
      return this.app;
    }

    const existing = getApps().find((a) => a.name === '[DEFAULT]');
    if (existing) {
      this.app = existing;
      return existing;
    }

    const projectId = this.config.get<string>('firebase.projectId', '');
    const serviceAccount = this.loadServiceAccount();
    if (!serviceAccount || !projectId) {
      throw new UnauthorizedError(
        'Social login is not configured on this server',
      );
    }

    this.app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
    this.logger.info('firebase_admin_initialized', { projectId });
    return this.app;
  }

  private loadServiceAccount(): ServiceAccount | null {
    const path = this.config.get<string>('firebase.serviceAccountPath', '');
    if (path) {
      return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
    }

    const encoded = this.config.get<string>('firebase.serviceAccountJson', '');
    if (!encoded) {
      return null;
    }

    // Accept either raw JSON or the base64-encoded form documented in .env.example.
    const raw = encoded.startsWith('{')
      ? encoded
      : Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(raw) as ServiceAccount;
  }
}
