import { Injectable } from '@nestjs/common';

export interface LandingPageData {
  token: string;
  baseUrl: string;
  teamName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
}

/**
 * Renders the browser fallback for an invitation magic link. The invite URL
 * serves the app's JSON envelope to API clients and this self-contained HTML
 * page to browsers (content negotiation in InvitationController.get). There is
 * no templating engine — the page is a constant string with escaped
 * interpolations, so it works without any frontend build step.
 */
@Injectable()
export class LandingPageService {
  render(data: LandingPageData): string {
    const title = `You're invited to join ${data.teamName} on Tasko`;
    const joinUrl = `${data.baseUrl.replace(/\/$/, '')}/invitations/${encodeURIComponent(data.token)}`;
    const pending = data.status === 'pending';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.escape(title)}</title>
    <style>
      body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f4f6f8;color:#1c2430;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(20,40,80,.08);padding:40px;max-width:420px;width:100%;text-align:center}
      .badge{display:inline-block;background:#e8f0fe;color:#1a56db;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600}
      h1{font-size:22px;margin:20px 0 8px}
      p{margin:6px 0;color:#4b5563;line-height:1.5}
      .btn{display:block;margin-top:24px;padding:14px 24px;border-radius:8px;background:#1a56db;color:#fff;text-decoration:none;font-weight:600}
      .meta{font-size:13px;color:#9ca3af;margin-top:24px}
    </style>
  </head>
  <body>
    <div class="card">
      <span class="badge">Tasko · Invitation</span>
      <h1>${this.escape(data.teamName)}</h1>
      <p>You've been invited as <strong>${this.escape(data.role)}</strong> to the address <strong>${this.escape(data.email)}</strong>.</p>
      ${pending ? `<a class="btn" href="${joinUrl}">Open in the Tasko app</a>` : `<p>This invitation is ${this.escape(data.status)}.</p>`}
      <p class="meta">Invitation expires ${this.escape(data.expiresAt.toUTCString())}</p>
    </div>
  </body>
</html>`;
  }

  renderError(status: number): string {
    const message =
      status === 404
        ? 'This invitation link is not valid or no longer exists.'
        : status === 409
          ? 'This invitation has already been used or has expired.'
          : 'Something went wrong. Please try again later.';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tasko · Invitation unavailable</title>
    <style>
      body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f4f6f8;color:#1c2430;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(20,40,80,.08);padding:40px;max-width:420px;width:100%;text-align:center}
      h1{font-size:20px;margin:0 0 8px}
      p{margin:0;color:#4b5563;line-height:1.5}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Invitation unavailable</h1>
      <p>${this.escape(message)}</p>
    </div>
  </body>
</html>`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
