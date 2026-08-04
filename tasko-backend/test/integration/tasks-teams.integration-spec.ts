import request from 'supertest';
import { IntegrationContext, bootstrapApp, signUp } from './helpers';

const TASK_BODY = { title: 'Tenant check', time: '10:00 AM', date: 'today' };

describe('tasks & teams integration', () => {
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

  it('isolates personal tasks: another user gets 404s and sees nothing', async () => {
    const alice = await signUp(ctx.http, 'tenant-alice@example.com');
    const bob = await signUp(ctx.http, 'tenant-bob@example.com');

    const created = await request(ctx.http)
      .post('/tasks')
      .set(auth(alice))
      .send(TASK_BODY)
      .expect(201);
    const taskId = created.body.data.id;

    // Cross-user reads, writes, toggles and deletes all hide as 404.
    await request(ctx.http).get(`/tasks/${taskId}`).set(auth(bob)).expect(404);
    await request(ctx.http)
      .patch(`/tasks/${taskId}`)
      .set(auth(bob))
      .send({ title: 'hijack' })
      .expect(404);
    await request(ctx.http)
      .patch(`/tasks/${taskId}/done`)
      .set(auth(bob))
      .send({ isDone: true })
      .expect(404);
    await request(ctx.http)
      .delete(`/tasks/${taskId}`)
      .set(auth(bob))
      .expect(404);

    // Bob's list does not include Alice's task; Alice's does.
    const bobList = await request(ctx.http)
      .get('/tasks')
      .set(auth(bob))
      .expect(200);
    expect(bobList.body.data.items).toHaveLength(0);

    const aliceList = await request(ctx.http)
      .get('/tasks')
      .set(auth(alice))
      .expect(200);
    expect(aliceList.body.data.items).toHaveLength(1);
    expect(aliceList.body.data.items[0].id).toBe(taskId);

    // Anonymous access is rejected with 401.
    await request(ctx.http).get(`/tasks/${taskId}`).expect(401);
  });

  it('accepts a client-generated UUID and validates the date/priority enums', async () => {
    const token = await signUp(ctx.http, 'tenant-uuid@example.com');
    const clientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    const created = await request(ctx.http)
      .post('/tasks')
      .set(auth(token))
      .send({ ...TASK_BODY, id: clientId, priority: 'high' })
      .expect(201);
    expect(created.body.data.id).toBe(clientId);

    await request(ctx.http)
      .post('/tasks')
      .set(auth(token))
      .send({ ...TASK_BODY, date: 'not-a-date', priority: 'urgent' })
      .expect(400);
  });

  it('hides team tasks from personal lists and personal tasks from team scopes', async () => {
    const owner = await signUp(ctx.http, 'tenant-owner@example.com');
    const member = await signUp(ctx.http, 'tenant-member@example.com');

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Tenant Squad' })
      .expect(201);
    const teamId = team.body.data.id;

    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'tenant-member@example.com' })
      .expect(201);

    const teamTask = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(owner))
      .send(TASK_BODY)
      .expect(201);
    const teamTaskId = teamTask.body.data.id;

    const personalTask = await request(ctx.http)
      .post('/tasks')
      .set(auth(owner))
      .send(TASK_BODY)
      .expect(201);
    const personalTaskId = personalTask.body.data.id;

    // The team task is not in anyone's personal task list.
    const ownerList = await request(ctx.http)
      .get('/tasks')
      .set(auth(owner))
      .expect(200);
    expect(ownerList.body.data.items.map((t: { id: string }) => t.id)).toEqual([
      personalTaskId,
    ]);

    // The personal task is not reachable through the team scope.
    await request(ctx.http)
      .get(`/teams/${teamId}/tasks/${personalTaskId}`)
      .set(auth(owner))
      .expect(404);

    // Members can read team tasks; non-members get 403 from the guard.
    const outsider = await signUp(ctx.http, 'tenant-outsider@example.com');
    await request(ctx.http)
      .get(`/teams/${teamId}/tasks/${teamTaskId}`)
      .set(auth(member))
      .expect(200);
    await request(ctx.http)
      .get(`/teams/${teamId}/tasks`)
      .set(auth(outsider))
      .expect(403);
    await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(outsider))
      .send(TASK_BODY)
      .expect(403);
  });

  it('enforces team roles on writes: viewers read, editors and owners write', async () => {
    const owner = await signUp(ctx.http, 'role-owner@example.com');
    const editor = await signUp(ctx.http, 'role-editor@example.com');
    const viewer = await signUp(ctx.http, 'role-viewer@example.com');

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Role Squad' })
      .expect(201);
    const teamId = team.body.data.id;

    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'role-editor@example.com', role: 'editor' })
      .expect(201);
    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'role-viewer@example.com' })
      .expect(201);

    // A viewer may list and read but never create, update, toggle or delete.
    await request(ctx.http)
      .get(`/teams/${teamId}/tasks`)
      .set(auth(viewer))
      .expect(200);
    await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(viewer))
      .send(TASK_BODY)
      .expect(403);

    // An editor can create and toggle.
    const created = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(editor))
      .send(TASK_BODY)
      .expect(201);
    const taskId = created.body.data.id;
    await request(ctx.http)
      .patch(`/teams/${teamId}/tasks/${taskId}/done`)
      .set(auth(editor))
      .send({ isDone: true })
      .expect(200);
    await request(ctx.http)
      .patch(`/teams/${teamId}/tasks/${taskId}/done`)
      .set(auth(viewer))
      .send({ isDone: false })
      .expect(403);

    // The owner sees the editor's completion in team-wide lists.
    const list = await request(ctx.http)
      .get(`/teams/${teamId}/tasks`)
      .set(auth(owner))
      .expect(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].isDone).toBe(true);
  });
});
