export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Outbound e-mail abstraction. The concrete vendor (SMTP in production, a
 * structured logger in local/test) is chosen in MailerModule, keeping callers
 * — such as the auth verification mail — vendor-agnostic.
 */
export abstract class MailerService {
  abstract sendMail(message: MailMessage): Promise<void>;
  abstract probe(): Promise<boolean>;
}
