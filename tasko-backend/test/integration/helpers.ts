// eslint-disable-next-line @typescript-eslint/no-require-imports
require('better-sqlite3')().close();

// Defaults are only applied when unset so a CI job can run this suite against a
// real Postgres service container by setting DB_TYPE=postgres (+ DB_HOST etc.).
if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'test';
if (process.env.DB_TYPE === undefined) process.env.DB_TYPE = 'sqlite';
if (process.env.DB_FILE === undefined) process.env.DB_FILE = ':memory:';
if (process.env.JWT_SECRET === undefined) {
  process.env.JWT_SECRET =
    'integration-test-secret-that-is-definitely-long-enough-123456';
}
if (process.env.REDIS_URL === undefined) process.env.REDIS_URL = '';
if (process.env.SMTP_HOST === undefined) process.env.SMTP_HOST = '';
if (process.env.MAIL_FROM === undefined)
  process.env.MAIL_FROM = 'no-reply@tasko.dev';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { ThrottlerStorageService } from '@nestjs/throttler/dist/throttler.service';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { LogMailerService } from '../../src/infrastructure/mailer/log-mailer.service';
import { MailerService } from '../../src/infrastructure/mailer/mailer.service';

/** Matches the raw one-time token embedded in a magic-link / verification URL. */
export const TOKEN_IN_HTML = /token=([A-Za-z0-9_-]+)/;
const TOKEN_IN_PATH = /\/invitations\/([A-Za-z0-9_-]+)/;

export interface IntegrationContext {
  app: INestApplication;
  mailer: LogMailerService;
  throttlerStorage: ThrottlerStorageService;
  http: ReturnType<INestApplication['getHttpServer']>;
}

/** Boots the full AppModule against an isolated in-memory sqlite database. */
export async function bootstrapApp(): Promise<IntegrationContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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
