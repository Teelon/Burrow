/**
 * Provider-agnostic email adapter.
 * Implementations live in the platform layer (Worker, Node).
 * Swapping providers means writing a new implementation file and
 * changing one line in the infrastructure factory — nothing else.
 */
export interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export interface IEmailProvider {
    /** Send a single transactional email. Returns the provider's message ID. */
    send(params: SendEmailParams): Promise<{
        id: string;
    }>;
}
