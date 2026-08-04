import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { setupSwagger } from './infrastructure/swagger/setup-swagger';

const PLACEHOLDER_JWT_SECRET =
  'change-me-to-a-random-secret-of-at-least-32-chars';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = new LoggerService();
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  if (
    config.get<string>('app.env') === 'production' &&
    config.get<string>('jwt.secret') === PLACEHOLDER_JWT_SECRET
  ) {
    logger.error('insecure_jwt_secret', {
      message:
        'NODE_ENV=production but JWT_SECRET is still the placeholder value. ' +
        'Tokens can be forged by anyone who knows it. Set a strong secret ' +
        '(e.g. `openssl rand -base64 48`) before deploying.',
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: config.get<string[]>('app.corsOrigin'),
  });

  setupSwagger(app);

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
  logger.info('application_started', {
    env: config.get('app.env'),
    port,
  });
}

void bootstrap();
