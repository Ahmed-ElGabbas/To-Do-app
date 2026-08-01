import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';
import { MailerService, MailMessage } from './mailer.service';

/**
 * Non-production mailer: never sends. Writes the message as structured JSON so
 * local/test/dev flows can be traced end-to-end without an SMTP server, and
 * keeps a bounded in-memory queue of sent messages (a mailcatcher) so tests
 * can assert deliveries and extract one-time tokens from the message body.
 */
@Injectable()
export class LogMailerService extends MailerService {
  private readonly sent: MailMessage[] = [];

  constructor(private readonly logger: LoggerService) {
    super();
    this.logger.setContext('Mailer');
  }

  get sentMessages(): readonly MailMessage[] {
    return this.sent;
  }

  clearSentMessages(): void {
    this.sent.length = 0;
  }

  async sendMail(message: MailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 100) {
      this.sent.shift();
    }
    this.logger.info('mail_sent', {
      to: message.to,
      subject: message.subject,
    });
  }

  async probe(): Promise<boolean> {
    return true;
  }
}
