import request from 'supertest';
import { IntegrationContext, bootstrapApp, lastToken, signUp } from './helpers';

describe('invitations integration', () => {
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

  it('accepts a magic-link invite for an unregistered email via a stub account', async () => {
    const owner = await signUp(ctx.http, 'invite-owner@example.com');
    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Invite Squad' })
      .expect(201);
    const teamId = team.body.data.id;

    const invited = await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-stub@example.com', role: 'editor' })
      .expect(201);
    expect(invited.body.data.status).toBe('pending');
    expect(invited.body.data.teamName).toBe('Invite Squad');
    expect(invited.body.data.role).toBe('editor');
    expect(invited.body.data.expiresAt).toBeTruthy();

    const token = lastToken(ctx.mailer, 'invited');

    const lookup = await request(ctx.http)
      .get(`/invitations/${token}`)
      .expect(200);
    expect(lookup.body.data.email).toBe('invitee-stub@example.com');
    expect(lookup.body.data.status).toBe('pending');

    const accepted = await request(ctx.http)
      .post(`/invitations/${token}/accept`)
      .send({ firstName: 'Stub', lastName: 'Person' })
      .expect(201);
    expect(accepted.body.data.status).toBe('accepted');

    const members = await request(ctx.http)
      .get(`/teams/${teamId}/members`)
      .set(auth(owner))
      .expect(200);
    const member = members.body.data.find(
      (m: { user: { email: string } }) =>
        m.user.email === 'invitee-stub@example.com',
    );
    expect(member).toBeDefined();
    expect(member.role).toBe('editor');

    // Stub accounts carry an unusable password hash, so the accepted user
    // cannot sign in until they go through the real signup/verification flow.
    await request(ctx.http)
      .post('/auth/login')
      .send({ email: 'invitee-stub@example.com', password: 'password123' })
      .expect(401);

    // A resolved invitation cannot be accepted twice.
    await request(ctx.http)
      .post(`/invitations/${token}/accept`)
      .send({})
      .expect(409);
  });

  it('links an existing registered account when accepting', async () => {
    const owner = await signUp(ctx.http, 'invite-owner2@example.com');
    await signUp(ctx.http, 'invitee-existing@example.com');

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Existing User Team' })
      .expect(201);
    const teamId = team.body.data.id;

    const invited = await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-existing@example.com' })
      .expect(201);
    expect(invited.body.data.role).toBe('viewer');

    const token = lastToken(ctx.mailer, 'invited');

    await request(ctx.http)
      .post(`/invitations/${token}/accept`)
      .send({})
      .expect(201);

    const members = await request(ctx.http)
      .get(`/teams/${teamId}/members`)
      .set(auth(owner))
      .expect(200);
    const member = members.body.data.find(
      (m: { user: { email: string } }) =>
        m.user.email === 'invitee-existing@example.com',
    );
    expect(member).toBeDefined();
    expect(member.role).toBe('viewer');

    // The default VIEWER role means the invitee can read the team but not
    // create tasks on it.
    const inviteeLogin = await request(ctx.http)
      .post('/auth/login')
      .send({
        email: 'invitee-existing@example.com',
        password: 'password123',
      })
      .expect(200);
    const inviteeToken = inviteeLogin.body.data.tokens.accessToken;

    await request(ctx.http)
      .get(`/teams/${teamId}`)
      .set(auth(inviteeToken))
      .expect(200);
    await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(inviteeToken))
      .send({ title: 'Nope', time: '09:00 AM', date: 'today' })
      .expect(403);
  });

  it('rejects unknown, revoked, and already-resolved tokens', async () => {
    const owner = await signUp(ctx.http, 'invite-owner3@example.com');
    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Token Squad' })
      .expect(201);
    const teamId = team.body.data.id;

    await request(ctx.http).get('/invitations/not-a-real-token').expect(404);

    const declined = await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-decline@example.com' })
      .expect(201);
    const declineToken = lastToken(ctx.mailer, 'invited');

    await request(ctx.http)
      .post(`/invitations/${declineToken}/decline`)
      .expect(201);
    await request(ctx.http)
      .post(`/invitations/${declineToken}/accept`)
      .send({})
      .expect(409);

    // Revoking an already-resolved invitation is a conflict.
    await request(ctx.http)
      .delete(`/teams/${teamId}/invitations/${declined.body.data.id}`)
      .set(auth(owner))
      .expect(409);
    // Revoked invitations are treated as resolved (409), not pending (200).
    const revoked = await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-revoke@example.com' })
      .expect(201);
    const revokeToken = lastToken(ctx.mailer, 'invited');
    await request(ctx.http)
      .delete(`/teams/${teamId}/invitations/${revoked.body.data.id}`)
      .set(auth(owner))
      .expect(200);
    await request(ctx.http).get(`/invitations/${revokeToken}`).expect(409);
  });

  it('restricts invitation management to owners and rejects duplicates', async () => {
    const owner = await signUp(ctx.http, 'invite-owner4@example.com');
    const editor = await signUp(ctx.http, 'invite-editor@example.com');

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Owner Only' })
      .expect(201);
    const teamId = team.body.data.id;

    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'invite-editor@example.com', role: 'editor' })
      .expect(201);

    // Editors cannot create or list invitations.
    await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(editor))
      .send({ email: 'invitee-x@example.com' })
      .expect(403);
    await request(ctx.http)
      .get(`/teams/${teamId}/invitations`)
      .set(auth(editor))
      .expect(403);

    await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-dup@example.com' })
      .expect(201);
    // A duplicate pending invitation for the same email is rejected.
    await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invitee-dup@example.com' })
      .expect(409);

    // Inviting an address that already has a membership is rejected.
    await request(ctx.http)
      .post(`/teams/${teamId}/invitations`)
      .set(auth(owner))
      .send({ email: 'invite-editor@example.com' })
      .expect(409);
  });
});
