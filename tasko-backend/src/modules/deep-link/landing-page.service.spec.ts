import { LandingPageService } from './landing-page.service';

describe('LandingPageService', () => {
  const service = new LandingPageService();
  const data = {
    token: 'abc123',
    baseUrl: 'https://tasko.example',
    teamName: 'Invite Squad',
    email: 'someone@example.com',
    role: 'editor',
    status: 'pending',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
  };

  it('renders the team, role and a pending call to action', () => {
    const html = service.render(data);
    expect(html).toContain('Invite Squad');
    expect(html).toContain('editor');
    expect(html).toContain('https://tasko.example/invitations/abc123');
    expect(html).toContain('Open in the Tasko app');
    expect(html).toContain('Tue, 01 Jan 2030 00:00:00 GMT');
  });

  it('escapes HTML in interpolated values', () => {
    const html = service.render({
      ...data,
      teamName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not offer the Open button for resolved invitations', () => {
    const html = service.render({ ...data, status: 'accepted' });
    expect(html).not.toContain('Open in the Tasko app');
    expect(html).toContain('accepted');
  });

  it('renders friendly error pages by status', () => {
    expect(service.renderError(404)).toContain('not valid');
    expect(service.renderError(409)).toContain('already been used');
    expect(service.renderError(500)).toContain('try again later');
  });
});
