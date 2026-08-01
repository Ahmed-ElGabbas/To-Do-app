process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.DB_FILE = ':memory:';
process.env.JWT_SECRET =
  'e2e-test-secret-that-is-definitely-long-enough-123456';
process.env.REDIS_URL = '';
process.env.SMTP_HOST = '';
process.env.MAIL_FROM = 'no-reply@tasko.dev';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { ThrottlerStorageService } from '@nestjs/throttler/dist/throttler.service';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { LogMailerService } from '../src/infrastructure/mailer/log-mailer.service';
import { MailerService } from '../src/infrastructure/mailer/mailer.service';

const TOKEN_IN_HTML = /token=([A-Za-z0-9_-]+)/;

describe('Tasko API (e2e)', () => {
  let app: INestApplication;
  let mailer: LogMailerService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    mailer = app.get(MailerService);
    throttlerStorage = app.get(getStorageToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mailer.clearSentMessages();
    throttlerStorage.storage.clear();
  });

  describe('health', () => {
    it('GET /health reports liveness', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/ready is ready when dependencies are up', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
      expect(res.body.status).toBe('ready');
    });
  });

  describe('auth lifecycle', () => {
    it('signs up, logs in, reads /auth/me, refreshes, and rotates tokens', async () => {
      const signup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'e2e@example.com',
          password: 'password123',
          firstName: 'E2E',
          lastName: 'User',
        })
        .expect(201);

      const signupData = signup.body.data;
      expect(signupData.user.email).toBe('e2e@example.com');
      expect(signupData.user.isEmailVerified).toBe(false);
      expect(signupData.tokens.accessToken).toBeTruthy();
      expect(signupData.tokens.refreshToken).toBeTruthy();

      const verificationMail = mailer.sentMessages.find((m) =>
        m.subject.includes('Verify'),
      );
      expect(verificationMail).toBeDefined();

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${signupData.tokens.accessToken}`)
        .expect(200)
        .expect((res) => expect(res.body.data.email).toBe('e2e@example.com'));

      const meWithoutToken = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
      expect(meWithoutToken.body.error.code).toBe('UNAUTHORIZED');

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@example.com', password: 'password123' })
        .expect(200);
      expect(login.body.data.tokens.refreshToken).toBeTruthy();

      const refresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.data.tokens.refreshToken })
        .expect(200);
      const rotated = refresh.body.data;
      expect(rotated.refreshToken).not.toBe(
        login.body.data.tokens.refreshToken,
      );
      expect(rotated.accessToken).toBeTruthy();
    });

    it('rejects a reused (rotated) refresh token by revoking the family', async () => {
      const signup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'reuse@example.com',
          password: 'password123',
          firstName: 'Reuse',
          lastName: 'User',
        })
        .expect(201);
      const originalRefresh = signup.body.data.tokens.refreshToken;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: originalRefresh })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: originalRefresh })
        .expect(401);
    });

    it('verifies email with a single-use token', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'verify@example.com',
          password: 'password123',
          firstName: 'Verify',
          lastName: 'User',
        })
        .expect(201);

      const mail = mailer.sentMessages.find((m) =>
        m.subject.includes('Verify'),
      );
      const token = mail?.html.match(TOKEN_IN_HTML)?.[1] ?? '';

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(401);
    });

    it('resets a forgotten password and revokes all sessions', async () => {
      const signup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'reset@example.com',
          password: 'password123',
          firstName: 'Reset',
          lastName: 'User',
        })
        .expect(201);
      const beforeResetRefresh = signup.body.data.tokens.refreshToken;

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'reset@example.com' })
        .expect(200);

      const resetMail = mailer.sentMessages.find((m) =>
        m.subject.includes('Reset'),
      );
      const resetToken = resetMail?.html.match(TOKEN_IN_HTML)?.[1] ?? '';

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'newpassword456' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: beforeResetRefresh })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset@example.com', password: 'password123' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset@example.com', password: 'newpassword456' })
        .expect(200);
    });

    it('forgot-password never reveals whether an account exists', async () => {
      const unknown = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'ghost@example.com' })
        .expect(200);
      expect(unknown.body.data.message).toContain('If an account exists');
      expect(mailer.sentMessages).toHaveLength(0);
    });

    it('logs out all sessions', async () => {
      const signup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'logout@example.com',
          password: 'password123',
          firstName: 'Logout',
          lastName: 'User',
        })
        .expect(201);
      const { accessToken, refreshToken } = signup.body.data.tokens;

      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('validation and throttling', () => {
    it('rejects an invalid signup payload with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rate-limits login to 5 per minute', async () => {
      const creds = { email: 'ratelimit@example.com', password: 'password123' };
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(creds)
          .expect(401);
      }
      const sixth = await request(app.getHttpServer())
        .post('/auth/login')
        .send(creds)
        .expect(429);
      expect(sixth.body.error.code).toBe('RATE_LIMITED');
    });
  });

  async function signUp(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'password123',
        firstName: 'Phase',
        lastName: 'Two',
      })
      .expect(201);
    return res.body.data.tokens.accessToken;
  }

  describe('tags', () => {
    it('creates, lists, gets, updates, and deletes a tag', async () => {
      const token = await signUp('tags@example.com');

      const created = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Work' })
        .expect(201);
      expect(created.body.data.name).toBe('Work');
      const id = created.body.data.id;

      const list = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.data).toHaveLength(1);

      const got = await request(app.getHttpServer())
        .get(`/tags/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(got.body.data.name).toBe('Work');

      const updated = await request(app.getHttpServer())
        .patch(`/tags/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Career' })
        .expect(200);
      expect(updated.body.data.name).toBe('Career');

      await request(app.getHttpServer())
        .delete(`/tags/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const missing = await request(app.getHttpServer())
        .get(`/tags/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects duplicate tag names for the same user', async () => {
      const token = await signUp('tagdup@example.com');
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Errands' })
        .expect(201);

      const dup = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Errands' })
        .expect(409);
      expect(dup.body.error.code).toBe('CONFLICT');
    });
  });

  describe('categories', () => {
    it('creates, lists, gets, updates, and deletes a category', async () => {
      const token = await signUp('cats@example.com');

      const created = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Home' })
        .expect(201);
      expect(created.body.data.name).toBe('Home');
      const id = created.body.data.id;

      const list = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.data).toHaveLength(1);

      const updated = await request(app.getHttpServer())
        .patch(`/categories/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Household' })
        .expect(200);
      expect(updated.body.data.name).toBe('Household');

      await request(app.getHttpServer())
        .delete(`/categories/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const missing = await request(app.getHttpServer())
        .get(`/categories/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects duplicate category names for the same user', async () => {
      const token = await signUp('catdup@example.com');
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Study' })
        .expect(201);

      const dup = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Study' })
        .expect(409);
      expect(dup.body.error.code).toBe('CONFLICT');
    });
  });

  describe('tasks', () => {
    it('creates a task with a client-generated UUID and defaults', async () => {
      const token = await signUp('tasks@example.com');
      const id = randomUUID();

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ id, title: 'Buy milk', time: '06:30 AM', date: 'today' })
        .expect(201);

      expect(res.body.data.id).toBe(id);
      expect(res.body.data.title).toBe('Buy milk');
      expect(res.body.data.priority).toBe('medium');
      expect(res.body.data.isDone).toBe(false);
      expect(res.body.data.categoryId).toBeNull();
      expect(res.body.data.tagIds).toEqual([]);
    });

    it('creates a task linked to a category and tags', async () => {
      const token = await signUp('tasklinks@example.com');

      const cat = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Chores' })
        .expect(201);
      const tag1 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Home' })
        .expect(201);
      const tag2 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Urgent' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Clean kitchen',
          time: '07:00 PM',
          date: 'tomorrow',
          categoryId: cat.body.data.id,
          tagIds: [tag1.body.data.id, tag2.body.data.id],
        })
        .expect(201);

      expect(res.body.data.categoryId).toBe(cat.body.data.id);
      expect(res.body.data.tagIds).toEqual(
        [tag1.body.data.id, tag2.body.data.id].sort(),
      );

      const filtered = await request(app.getHttpServer())
        .get(`/tasks?categoryId=${cat.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(filtered.body.data.total).toBe(1);
    });

    it('lists tasks with pagination, filters, and search', async () => {
      const token = await signUp('tasklist@example.com');

      const create = (title: string, date: string, priority: string) =>
        request(app.getHttpServer())
          .post('/tasks')
          .set('Authorization', `Bearer ${token}`)
          .send({ title, time: '09:00 AM', date, priority })
          .expect(201);

      await create('Alpha', '2026-08-10', 'high');
      await create('Beta', '2026-08-11', 'medium');
      await create('Gamma', '2026-08-12', 'low');

      const all = await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(all.body.data.items).toHaveLength(3);
      expect(all.body.data.total).toBe(3);
      expect(all.body.data.page).toBe(1);

      const high = await request(app.getHttpServer())
        .get('/tasks?priority=high')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        high.body.data.items.map((t: { title: string }) => t.title),
      ).toEqual(['Alpha']);

      const search = await request(app.getHttpServer())
        .get('/tasks?query=beta')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(search.body.data.total).toBe(1);

      const range = await request(app.getHttpServer())
        .get('/tasks?dateFrom=2026-08-11&dateTo=2026-08-12')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(range.body.data.total).toBe(2);
    });

    it('updates a task, toggles done, and deletes it', async () => {
      const token = await signUp('taskmut@example.com');

      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Draft', time: '08:00 AM', date: 'today' })
        .expect(201);
      const id = created.body.data.id;

      const patched = await request(app.getHttpServer())
        .patch(`/tasks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Final', notes: 'remember' })
        .expect(200);
      expect(patched.body.data.title).toBe('Final');
      expect(patched.body.data.notes).toBe('remember');

      const done = await request(app.getHttpServer())
        .patch(`/tasks/${id}/done`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDone: true })
        .expect(200);
      expect(done.body.data.isDone).toBe(true);

      await request(app.getHttpServer())
        .delete(`/tasks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const missing = await request(app.getHttpServer())
        .get(`/tasks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it("does not expose another user's task or category", async () => {
      const owner = await signUp('taskowner@example.com');
      const other = await signUp('taskother@example.com');

      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${owner}`)
        .send({ title: 'Private', time: '10:00 AM', date: '2026-08-01' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/tasks/${created.body.data.id}`)
        .set('Authorization', `Bearer ${other}`)
        .expect(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');

      const foreignCat = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${owner}`)
        .send({ name: 'OwnerOnly' })
        .expect(201);

      const linked = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${other}`)
        .send({
          title: 'Sneaky',
          time: '11:00 AM',
          date: 'today',
          categoryId: foreignCat.body.data.id,
        })
        .expect(404);
      expect(linked.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects an invalid task payload with 400', async () => {
      const token = await signUp('taskbad@example.com');
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '', time: '25:00 XX', date: 'yesterday' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('notifications and activity', () => {
    it('registers, lists, and revokes push device tokens', async () => {
      const token = await signUp('notify-device@example.com');

      await request(app.getHttpServer())
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'device-token-1', platform: 'android' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'device-token-2', platform: 'web' })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.data).toHaveLength(2);

      await request(app.getHttpServer())
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'device-token-1', platform: 'ios' })
        .expect(201);
      const relisted = await request(app.getHttpServer())
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(relisted.body.data).toHaveLength(2);

      await request(app.getHttpServer())
        .delete('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'device-token-1' })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(after.body.data).toHaveLength(1);
      expect(after.body.data[0].token).toBe('device-token-2');
    });

    it('emits notifications and activity for the task lifecycle', async () => {
      const token = await signUp('notify-lifecycle@example.com');

      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Notify me', time: '09:00 AM', date: 'today' })
        .expect(201);
      const id = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/tasks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'hello' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/tasks/${id}/done`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDone: true })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/tasks/${id}/done`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDone: false })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/tasks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const notifications = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const types = notifications.body.data.items.map(
        (n: { type: string }) => n.type,
      );
      expect(notifications.body.data.total).toBe(5);
      expect(types.sort()).toEqual([
        'task_completed',
        'task_created',
        'task_deleted',
        'task_reopened',
        'task_updated',
      ]);

      const feed = await request(app.getHttpServer())
        .get('/users/me/activity')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(feed.body.data.total).toBe(5);
      const summaries = feed.body.data.items.map(
        (a: { summary: string }) => a.summary,
      );
      expect(summaries).toEqual(
        expect.arrayContaining([
          'Task created: "Notify me"',
          'Task updated: "Notify me"',
          'Task completed: "Notify me"',
          'Task reopened: "Notify me"',
          'Task deleted: "Notify me"',
        ]),
      );
    });

    it('filters the activity feed by event type and paginates', async () => {
      const token = await signUp('notify-filter@example.com');

      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Alpha', time: '09:00 AM', date: 'today' })
        .expect(201);
      const id = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/tasks/${id}/done`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDone: true })
        .expect(200);
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Beta', time: '10:00 AM', date: 'today' })
        .expect(201);

      const completed = await request(app.getHttpServer())
        .get('/users/me/activity?type=task.completed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(completed.body.data.total).toBe(1);
      expect(completed.body.data.items[0].summary).toBe(
        'Task completed: "Alpha"',
      );

      const page = await request(app.getHttpServer())
        .get('/users/me/activity?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(page.body.data.items).toHaveLength(2);
      expect(page.body.data.totalPages).toBe(2);
    });

    it('marks notifications read individually and all at once', async () => {
      const token = await signUp('notify-read@example.com');

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Read me', time: '09:00 AM', date: 'today' })
        .expect(201);

      const unread = await request(app.getHttpServer())
        .get('/notifications?isRead=false')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(unread.body.data.total).toBe(1);
      const notificationId = unread.body.data.items[0].id;

      const marked = await request(app.getHttpServer())
        .patch(`/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(marked.body.data.isRead).toBe(true);
      expect(marked.body.data.readAt).toBeTruthy();

      const read = await request(app.getHttpServer())
        .get('/notifications?isRead=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(read.body.data.total).toBe(1);

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Another', time: '11:00 AM', date: 'today' })
        .expect(201);

      const all = await request(app.getHttpServer())
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(all.body.data.updated).toBe(1);

      const allRead = await request(app.getHttpServer())
        .get('/notifications?isRead=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(allRead.body.data.total).toBe(2);
    });

    it('rejects invalid notification payloads with 400', async () => {
      const token = await signUp('notify-bad@example.com');
      await request(app.getHttpServer())
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '' })
        .expect(400);
    });
  });

  describe('settings', () => {
    it('returns defaults and persists updates', async () => {
      const token = await signUp('settings@example.com');

      const initial = await request(app.getHttpServer())
        .get('/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(initial.body.data.darkMode).toBe(false);
      expect(initial.body.data.notificationsEnabled).toBe(true);
      expect(initial.body.data.language).toBe('en');

      const updated = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ darkMode: true, language: 'ar' })
        .expect(200);
      expect(updated.body.data.darkMode).toBe(true);
      expect(updated.body.data.language).toBe('ar');
      expect(updated.body.data.notificationsEnabled).toBe(true);

      const again = await request(app.getHttpServer())
        .get('/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(again.body.data.darkMode).toBe(true);
    });

    it('rejects an unsupported language', async () => {
      const token = await signUp('settingsbad@example.com');
      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ language: 'xx' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('avatar files', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    it('uploads, fetches, replaces, and deletes an avatar', async () => {
      const token = await signUp('avatar@example.com');

      const first = await request(app.getHttpServer())
        .post('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', png, { filename: 'me.png', contentType: 'image/png' })
        .expect(201);
      expect(first.body.data.mimeType).toBe('image/png');
      expect(first.body.data.kind).toBe('avatar');
      expect(first.body.data.url).toContain('/uploads/avatars/');
      const firstId = first.body.data.id;

      const got = await request(app.getHttpServer())
        .get('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(got.body.data.id).toBe(firstId);

      const second = await request(app.getHttpServer())
        .post('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', png, { filename: 'new.png', contentType: 'image/png' })
        .expect(201);
      expect(second.body.data.id).not.toBe(firstId);

      const after = await request(app.getHttpServer())
        .get('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(after.body.data.id).toBe(second.body.data.id);

      await request(app.getHttpServer())
        .delete('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await request(app.getHttpServer())
        .get('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(gone.body.data).toBeNull();
    });

    it('rejects non-image uploads', async () => {
      const token = await signUp('avatar-bad-type@example.com');
      const res = await request(app.getHttpServer())
        .post('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('hello'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a missing file with 422', async () => {
      const token = await signUp('avatar-no-file@example.com');
      const res = await request(app.getHttpServer())
        .post('/files/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
