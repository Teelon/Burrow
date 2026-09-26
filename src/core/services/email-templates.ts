/**
 * Email template functions.
 * Each returns { subject, html } — consumed by IEmailProvider.send().
 * Keeps subject lines and HTML out of route handlers / business logic.
 */

export function inviteEmail(
  inviterName: string | undefined,
  workspaceName: string | undefined,
  inviteUrl: string,
) {
  const safeWorkspace = workspaceName?.trim();
  const safeInviter = inviterName?.trim();

  const subject = safeWorkspace
    ? `You've been invited to ${safeWorkspace}`
    : `You've been invited to collaborate on Burrow`;

  const headingText = safeWorkspace
    ? `Join ${escapeHtml(safeWorkspace)} on Burrow`
    : `Join the team on Burrow`;

  const inviterText = safeInviter
    ? `${escapeHtml(safeInviter)} has invited you to collaborate`
    : `You have been invited to collaborate`;

  const workspaceContext = safeWorkspace
    ? ` on <b>${escapeHtml(safeWorkspace)}</b>`
    : '';

  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">`,
    `  <h2 style="margin-top:0;font-size:20px;font-weight:600;">${headingText}</h2>`,
    `  <p style="font-size:15px;line-height:1.5;color:#3f3f46;">${inviterText}${workspaceContext}.</p>`,
    `  <div style="margin:28px 0;">`,
    `    <a href="${escapeHtml(inviteUrl)}" style="background-color:#18181b;color:#ffffff;padding:12px 24px;font-size:14px;font-weight:500;text-decoration:none;border-radius:6px;display:inline-block;">Accept Invitation</a>`,
    `  </div>`,
    `  <p style="font-size:13px;color:#71717a;margin-top:24px;border-top:1px solid #e4e4e7;padding-top:16px;">`,
    `    This invitation expires in 7 days.<br>`,
    `    If the button doesn't work, copy and paste this URL into your browser:<br>`,
    `    <a href="${escapeHtml(inviteUrl)}" style="color:#71717a;word-break:break-all;">${escapeHtml(inviteUrl)}</a>`,
    `  </p>`,
    `</div>`,
  ].join('\n');

  const text = [
    `${safeInviter || 'You have been invited'} to collaborate${safeWorkspace ? ` on ${safeWorkspace}` : ''} on Burrow.`,
    '',
    `Accept your invitation:`,
    inviteUrl,
    '',
    `This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.`,
  ].join('\n');

  return { subject, html, text };
}

/** Minimal HTML escaping for user-provided strings injected into templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
