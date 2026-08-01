import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from '../../common/logger/logger.module';
import { LoggerService } from '../../common/logger/logger.service';
import { LogMailerService } from './log-mailer.service';
import { MailerService } from './mailer.service';
import { SmtpMailerService } from './smtp-mailer.service';

/**
 * Selects SMTP when an SMTP_HOST is configured, otherwise the logging mailer.
 * Consumers depend on MailerService.
 */
@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: MailerService,
      inject: [ConfigService, LoggerService],
      useFactory: (
        config: ConfigService,
        logger: LoggerService,
      ): MailerService => {
        const host = config.get<string>('mailer.host');
        return host
          ? new SmtpMailerService(config, logger)
          : new LogMailerService(logger);
      },
    },
  ],
  exports: [MailerService],
})
export class MailerModule {}
