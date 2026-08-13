import request from 'supertest';
import { IntegrationContext, bootstrapApp, lastToken, signUp } from './helpers';

describe('deep linking integration', () => {
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

  it('serves the Android App Links association file unenveloped', async () => {
    const res = await request(ctx.http)
      .get('/.well-known/assetlinks.json')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].relation).toEqual([
      'delegate_permission/common.handle_all_urls',
    ]);
    expect(res.body[0].target.package_name).toBe('com.tasko.app');
    expect(res.body[0].target.sha256_cert_fingerprints).toHaveLength(1);
  });

  it('serves the Apple Universal Links association file unenveloped', async () => {
    const res = await request(ctx.http)
      .get('/.well-known/apple-app-site-association')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(res.body.applinks.details[0].appIDs).toEqual([
      'TEAM_ID_PLACEHOLDER.com.tasko.app',
    ]);
    expect(res.body.applinks.details[0].components).toEqual([
      { '/': '/invitations/*' },
    ]);
  });

  it('returns the JSON envelope to API clients', async () => {
    const owner = await signUp(ctx.http, 'dl-owner@example.com');
    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Deep Link Team' })
      .expect(201);
    await request(ctx.http)
      .post(`/teams/${team.body.data.id}/invitations`)
      .set(auth(owner))
      .send({ email: 'dl-invitee@example.com' })
      .expect(201);
    const token = lastToken(ctx.mailer, 'invited');

    const res = await request(ctx.http)
      .get(`/invitations/${token}`)
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('dl-invitee@example.com');
    expect(res.body.data.teamName).toBe('Deep Link Team');
  });

  it('renders an HTML landing page for browsers', async () => {
    const owner = await signUp(ctx.http, 'dl-owner2@example.com');
    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Browser Team' })
      .expect(201);
    await request(ctx.http)
      .post(`/teams/${team.body.data.id}/invitations`)
      .set(auth(owner))
      .send({ email: 'dl-browser@example.com' })
      .expect(201);
    const token = lastToken(ctx.mailer, 'invited');

    const res = await request(ctx.http)
      .get(`/invitations/${token}`)
      .set('Accept', 'text/html')
      .expect(200)
      .expect('Content-Type', /html/);
    expect(res.text).toContain('Browser Team');
    expect(res.text).toContain('Open in the Tasko app');
    expect(res.text).toContain(`/invitations/${token}`);
  });

  it('renders an HTML error page for a stale link in a browser', async () => {
    const res = await request(ctx.http)
      .get('/invitations/not-a-real-token')
      .set('Accept', 'text/html')
      .expect(404)
      .expect('Content-Type', /html/);
    expect(res.text).toContain('not valid');
  });
});
