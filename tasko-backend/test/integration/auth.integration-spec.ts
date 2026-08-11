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

describe('auth social login (Firebase stubbed)', () => {
  let ctx: IntegrationContext;
  const verifyIdToken = jest.fn();

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const googleToken = {
    uid: 'firebase-uid-social',
    email: 'social-user@example.com',
    email_verified: true,
    name: 'Social User',
    given_name: 'Social',
    family_name: 'User',
    firebase: { sign_in_provider: 'google.com' },
  };

  beforeAll(async () => {
    ctx = await bootstrapApp({
      firebaseAdmin: { verifyIdToken, isConfigured: () => false },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValue(googleToken);
    ctx.mailer.clearSentMessages();
    ctx.throttlerStorage.storage.clear();
  });

  it('creates an email-verified account from a Google token and reuses it on later sign-ins', async () => {
    const res = await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'google', idToken: 'id-token-123' })
      .expect(200);

    expect(res.body.data.user.email).toBe('social-user@example.com');
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();

    const me = await request(ctx.http)
      .get('/auth/me')
      .set(auth(res.body.data.tokens.accessToken))
      .expect(200);
    expect(me.body.data.email).toBe('social-user@example.com');

    // The social account has no usable password.
    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'social-user@example.com', password: 'password123' })
      .expect(401);

    // Second sign-in links to the existing account instead of failing/duplicating.
    await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'google', idToken: 'id-token-123' })
      .expect(200);
  });

  it('links an existing password account without marking its email verified', async () => {
    await signUp(ctx.http, 'social-dup@example.com');

    verifyIdToken.mockResolvedValue({
      ...googleToken,
      uid: 'firebase-uid-2',
      email: 'social-dup@example.com',
      name: 'Social Dup',
      given_name: 'Social',
      family_name: 'Dup',
    });

    const res = await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'google', idToken: 'id-token-456' })
      .expect(200);

    const me = await request(ctx.http)
      .get('/auth/me')
      .set(auth(res.body.data.tokens.accessToken))
      .expect(200);
    expect(me.body.data.email).toBe('social-dup@example.com');
    expect(me.body.data.isEmailVerified).toBe(false);

    // Password login still works for the pre-existing account.
    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'social-dup@example.com', password: 'password123' })
      .expect(200);
  });

  it('rejects a token whose provider does not match the request', async () => {
    const res = await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'apple', idToken: 'id-token-apple' })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token without a verified email claim', async () => {
    verifyIdToken.mockResolvedValue({ ...googleToken, email_verified: false });
    const res = await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'google', idToken: 'id-token-unverified' })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid payloads with a 400', async () => {
    await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'google' })
      .expect(400);
    await request(ctx.http)
      .post('/auth/social-login')
      .send({ idToken: 'abc' })
      .expect(400);
    await request(ctx.http)
      .post('/auth/social-login')
      .send({ provider: 'microsoft', idToken: 'abc' })
      .expect(400);
  });
});
