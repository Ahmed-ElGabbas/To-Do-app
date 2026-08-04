import request from 'supertest';
import { IntegrationContext, bootstrapApp, lastToken, signUp } from './helpers';

describe('auth integration', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await bootstrapApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.mailer.clearSentMessages();
    ctx.throttlerStorage.storage.clear();
  });

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  it('signs up, issues a token pair, and verifies email via the emailed link', async () => {
    const res = await request(ctx.http)
      .post('/auth/signup')
      .send({
        email: 'auth-verify@example.com',
        password: 'password123',
        firstName: 'Auth',
        lastName: 'User',
      })
      .expect(201);

    const user = res.body.data.user;
    const tokens = res.body.data.tokens;
    expect(user.email).toBe('auth-verify@example.com');
    expect(user.isEmailVerified).toBe(false);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const me = await request(ctx.http)
      .get('/auth/me')
      .set(auth(tokens.accessToken))
      .expect(200);
    expect(me.body.data.isEmailVerified).toBe(false);

    const verifyToken = lastToken(ctx.mailer, 'Verify your Tasko email');
    await request(ctx.http)
      .post('/auth/verify-email')
      .send({ token: verifyToken })
      .expect(200);

    const afterVerify = await request(ctx.http)
      .get('/auth/me')
      .set(auth(tokens.accessToken))
      .expect(200);
    expect(afterVerify.body.data.isEmailVerified).toBe(true);
  });

  it('rejects a duplicate signup and a wrong login password with a 401', async () => {
    await request(ctx.http)
      .post('/auth/signup')
      .send({
        email: 'auth-dup@example.com',
        password: 'password123',
        firstName: 'Dup',
        lastName: 'User',
      })
      .expect(201);

    const dup = await request(ctx.http)
      .post('/auth/signup')
      .send({
        email: 'auth-dup@example.com',
        password: 'password123',
        firstName: 'Dup',
        lastName: 'User',
      })
      .expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');

    const badLogin = await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-dup@example.com', password: 'wrong-password' })
      .expect(401);
    expect(badLogin.body.error.code).toBe('UNAUTHORIZED');

    const goodLogin = await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-dup@example.com', password: 'password123' })
      .expect(200);
    expect(goodLogin.body.data.tokens.accessToken).toBeTruthy();
  });

  it('rotates refresh tokens and revokes the whole family on reuse', async () => {
    await signUp(ctx.http, 'auth-refresh@example.com');
    const login = await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-refresh@example.com', password: 'password123' })
      .expect(200);
    const refreshToken = login.body.data.tokens.refreshToken;

    const rotated = await request(ctx.http)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(rotated.body.data.refreshToken).toBeTruthy();

    await request(ctx.http)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('resets a forgotten password end to end', async () => {
    await signUp(ctx.http, 'auth-reset@example.com');

    await request(ctx.http)
      .post('/auth/forgot-password')
      .send({ email: 'auth-reset@example.com' })
      .expect(200);

    const resetToken = lastToken(ctx.mailer, 'Reset your Tasko password');
    await request(ctx.http)
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword: 'new-password-123' })
      .expect(200);

    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-reset@example.com', password: 'password123' })
      .expect(401);

    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-reset@example.com', password: 'new-password-123' })
      .expect(200);
  });

  it('changes the password only after verifying the current one', async () => {
    const token = await signUp(ctx.http, 'auth-changepw@example.com');

    await request(ctx.http)
      .patch('/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'nope-nope-nope', newPassword: 'brand-new-123' })
      .expect(401);

    await request(ctx.http)
      .patch('/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'password123', newPassword: 'brand-new-123' })
      .expect(200);

    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-changepw@example.com', password: 'password123' })
      .expect(401);

    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-changepw@example.com', password: 'brand-new-123' })
      .expect(200);
  });

  it('changes the email and requires re-verification of the new address', async () => {
    const token = await signUp(ctx.http, 'auth-changeemail@example.com');

    await request(ctx.http)
      .patch('/auth/change-email')
      .set(auth(token))
      .send({
        email: 'auth-renamed@example.com',
        currentPassword: 'bad-pw-here',
      })
      .expect(401);

    await request(ctx.http)
      .patch('/auth/change-email')
      .set(auth(token))
      .send({
        email: 'auth-renamed@example.com',
        currentPassword: 'password123',
      })
      .expect(200);

    const me = await request(ctx.http)
      .get('/auth/me')
      .set(auth(token))
      .expect(200);
    expect(me.body.data.email).toBe('auth-renamed@example.com');
    expect(me.body.data.isEmailVerified).toBe(false);

    const verifyToken = lastToken(ctx.mailer, 'Verify your Tasko email');
    await request(ctx.http)
      .post('/auth/verify-email')
      .send({ token: verifyToken })
      .expect(200);

    const afterVerify = await request(ctx.http)
      .get('/auth/me')
      .set(auth(token))
      .expect(200);
    expect(afterVerify.body.data.email).toBe('auth-renamed@example.com');
    expect(afterVerify.body.data.isEmailVerified).toBe(true);

    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-renamed@example.com', password: 'password123' })
      .expect(200);
  });

  it('logs out a single session and then every session', async () => {
    const token = await signUp(ctx.http, 'auth-logout@example.com');
    const tokens = await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-logout@example.com', password: 'password123' })
      .expect(200);
    const refreshToken = tokens.body.data.tokens.refreshToken;

    await request(ctx.http)
      .post('/auth/logout')
      .set(auth(token))
      .send({ refreshToken })
      .expect(200);

    await request(ctx.http)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    const fresh = await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'auth-logout@example.com', password: 'password123' })
      .expect(200);
    const freshRefresh = fresh.body.data.tokens.refreshToken;

    await request(ctx.http)
      .post('/auth/logout-all')
      .set(auth(fresh.body.data.tokens.accessToken))
      .expect(200);

    await request(ctx.http)
      .post('/auth/refresh')
      .send({ refreshToken: freshRefresh })
      .expect(401);
  });
});
