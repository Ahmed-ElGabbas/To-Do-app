import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { LoggerService } from '../../common/logger/logger.service';
import { MailerService, MailMessage } from './mailer.service';

/**
 * Real SMTP mailer used in staging/production. Config is injected so no
 * credentials ever reach the module graph as plain strings in code.
 */
@Injectable()
export class SmtpMailerService
  extends MailerService
  implements OnApplicationShutdown
{
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext('Mailer');
    const mailer = config.get('mailer');
    this.from = mailer.from as string;
    this.transporter = createTransport({
      host: mailer.host,
      port: mailer.port,
      auth: {
        user: mailer.user,
        pass: mailer.pass,
      },
    });
  }

  async sendMail(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    this.logger.info('mail_sent', {
      to: message.to,
      subject: message.subject,
    });
  }

  async probe(): Promise<boolean> {
    return this.transporter.verify();
  }

  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
