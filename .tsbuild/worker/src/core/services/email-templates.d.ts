/**
 * Email template functions.
 * Each returns { subject, html } — consumed by IEmailProvider.send().
 * Keeps subject lines and HTML out of route handlers / business logic.
 */
export declare function inviteEmail(inviterName: string | undefined, workspaceName: string | undefined, inviteUrl: string): {
    subject: string;
    html: string;
    text: string;
};
