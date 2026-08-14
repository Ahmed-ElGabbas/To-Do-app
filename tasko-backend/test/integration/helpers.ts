// eslint-disable-next-line @typescript-eslint/no-require-imports
require('better-sqlite3')().close();

// Seeds process.env with hermetic test defaults; must run before AppModule is
// imported because @nestjs/config reads the environment at import time.
import '../test-env';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { ThrottlerStorageService } from '@nestjs/throttler/dist/throttler.service';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { FirebaseAdminService } from '../../src/infrastructure/firebase/firebase-admin.service';
import { LogMailerService } from '../../src/infrastructure/mailer/log-mailer.service';
import { MailerService } from '../../src/infrastructure/mailer/mailer.service';
import { PushDispatcher } from '../../src/infrastructure/push/push-dispatcher.service';

/** Matches the raw one-time token embedded in a magic-link / verification URL. */
export const TOKEN_IN_HTML = /token=([A-Za-z0-9_-]+)/;
const TOKEN_IN_PATH = /\/invitations\/([A-Za-z0-9_-]+)/;

export interface IntegrationContext {
  app: INestApplication;
  mailer: LogMailerService;
  throttlerStorage: ThrottlerStorageService;
  http: ReturnType<INestApplication['getHttpServer']>;
}

export interface BootstrapOptions {
  /**
   * Replaces the real FirebaseAdminService (which needs live credentials).
   * Integration specs that exercise POST /auth/social-login must pass a stub
   * whose `verifyIdToken` resolves to a forged DecodedIdToken.
   */
  firebaseAdmin?: Partial<FirebaseAdminService>;
  /**
   * Replaces PushDispatcher with a spy so specs can assert whether (and to
   * which devices) a push was dispatched — required by the realtime spec's
   * FCM-suppression scenario (plan Section 12.2).
   */
  pushDispatcher?: Partial<PushDispatcher>;
}

/** Boots the full AppModule against an isolated in-memory sqlite database. */
export async function bootstrapApp(
  options: BootstrapOptions = {},
): Promise<IntegrationContext> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (options.firebaseAdmin) {
    builder
      .overrideProvider(FirebaseAdminService)
      .useValue(options.firebaseAdmin);
  }
  if (options.pushDispatcher) {
    builder.overrideProvider(PushDispatcher).useValue(options.pushDispatcher);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return {
    app,
    http: app.getHttpServer(),
    mailer: app.get(MailerService),
    throttlerStorage: app.get(getStorageToken()),
  };
}

/** Signs up a fresh user and returns their access token. */
export async function signUp(
  http: ReturnType<INestApplication['getHttpServer']>,
  email: string,
): Promise<string> {
  const res = await request(http)
    .post('/auth/signup')
    .send({
      email,
      password: 'password123',
      firstName: 'Integration',
      lastName: 'User',
    })
    .expect(201);
  return res.body.data.tokens.accessToken;
}

/** Extracts the raw one-time token from the latest invitation/verification mail. */
export function lastToken(
  mailer: LogMailerService,
  subjectPart: string,
): string {
  const mail = mailer.sentMessages
    .slice()
    .reverse()
    .find((m) => m.subject.includes(subjectPart));
  if (!mail) {
    throw new Error(`No mail with subject containing "${subjectPart}"`);
  }
  const token =
    mail.html.match(TOKEN_IN_HTML)?.[1] ?? mail.html.match(TOKEN_IN_PATH)?.[1];
  if (!token) {
    throw new Error(`No token in mail "${mail.subject}"`);
  }
  return token;
}
