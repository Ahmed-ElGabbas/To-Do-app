import request from 'supertest';
import { IntegrationContext, bootstrapApp, signUp } from './helpers';

describe('comments integration', () => {
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

  it('runs the full comment lifecycle on a personal task, author-scoped', async () => {
    const token = await signUp(ctx.http, 'comment-lifecycle@example.com');

    const task = await request(ctx.http)
      .post('/tasks')
      .set(auth(token))
      .send({ title: 'Comment me', time: '10:00 AM', date: 'today' })
      .expect(201);
    const taskId = task.body.data.id;

    const created = await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(token))
      .send({ body: 'First draft' })
      .expect(201);
    expect(created.body.data.taskId).toBe(taskId);
    expect(created.body.data.body).toBe('First draft');
    expect(created.body.data.userId).toBeTruthy();
    const commentId = created.body.data.id;

    const listed = await request(ctx.http)
      .get(`/tasks/${taskId}/comments`)
      .set(auth(token))
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].body).toBe('First draft');

    const updated = await request(ctx.http)
      .patch(`/comments/${commentId}`)
      .set(auth(token))
      .send({ body: 'Second draft' })
      .expect(200);
    expect(updated.body.data.body).toBe('Second draft');

    await request(ctx.http)
      .delete(`/comments/${commentId}`)
      .set(auth(token))
      .expect(200);

    const afterDelete = await request(ctx.http)
      .get(`/tasks/${taskId}/comments`)
      .set(auth(token))
      .expect(200);
    expect(afterDelete.body.data).toHaveLength(0);
  });

  it('isolates personal tasks: other users get a 404, no token a 401', async () => {
    const alice = await signUp(ctx.http, 'comment-alice@example.com');
    const bob = await signUp(ctx.http, 'comment-bob@example.com');

    const task = await request(ctx.http)
      .post('/tasks')
      .set(auth(alice))
      .send({ title: 'Private', time: '10:00 AM', date: 'today' })
      .expect(201);
    const taskId = task.body.data.id;

    await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(bob))
      .send({ body: 'intrusion' })
      .expect(404);

    await request(ctx.http)
      .get(`/tasks/${taskId}/comments`)
      .set(auth(bob))
      .expect(404);

    await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .send({ body: 'anonymous' })
      .expect(401);
  });

  it('enforces team membership and editor/owner rights on team task comments', async () => {
    const owner = await signUp(ctx.http, 'comment-owner@example.com');
    const editor = await signUp(ctx.http, 'comment-editor@example.com');
    const viewer = await signUp(ctx.http, 'comment-viewer@example.com');
    const outsider = await signUp(ctx.http, 'comment-outsider@example.com');

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(owner))
      .send({ name: 'Comment Squad' })
      .expect(201);
    const teamId = team.body.data.id;

    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'comment-editor@example.com', role: 'editor' })
      .expect(201);
    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(owner))
      .send({ email: 'comment-viewer@example.com' })
      .expect(201);

    const task = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(owner))
      .send({ title: 'Team comment', time: '10:00 AM', date: 'today' })
      .expect(201);
    const taskId = task.body.data.id;

    await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(outsider))
      .send({ body: 'nope' })
      .expect(404);

    const editorComment = await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(editor))
      .send({ body: 'editor says hi' })
      .expect(201);
    const editorCommentId = editorComment.body.data.id;

    const viewerComment = await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(viewer))
      .send({ body: 'viewer can comment too' })
      .expect(201);
    const viewerCommentId = viewerComment.body.data.id;

    const listed = await request(ctx.http)
      .get(`/tasks/${taskId}/comments`)
      .set(auth(viewer))
      .expect(200);
    expect(listed.body.data).toHaveLength(2);

    // A viewer cannot edit someone else's comment, but can edit their own.
    await request(ctx.http)
      .patch(`/comments/${editorCommentId}`)
      .set(auth(viewer))
      .send({ body: 'hijack' })
      .expect(403);

    await request(ctx.http)
      .patch(`/comments/${viewerCommentId}`)
      .set(auth(viewer))
      .send({ body: 'my own edit' })
      .expect(200);

    // Editors and owners may moderate any comment on the team's tasks.
    await request(ctx.http)
      .patch(`/comments/${viewerCommentId}`)
      .set(auth(editor))
      .send({ body: 'moderated by editor' })
      .expect(200);

    await request(ctx.http)
      .delete(`/comments/${editorCommentId}`)
      .set(auth(owner))
      .expect(200);

    // Outsiders cannot target a team task's comments at all.
    await request(ctx.http)
      .patch(`/comments/${viewerCommentId}`)
      .set(auth(outsider))
      .send({ body: 'x' })
      .expect(404);
  });

  it('rejects an empty comment body with 400', async () => {
    const token = await signUp(ctx.http, 'comment-badbody@example.com');

    const task = await request(ctx.http)
      .post('/tasks')
      .set(auth(token))
      .send({ title: 'Body check', time: '10:00 AM', date: 'today' })
      .expect(201);
    const taskId = task.body.data.id;

    const res = await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(token))
      .send({ body: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
