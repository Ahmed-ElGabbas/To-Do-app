import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { RedisIoAdapter } from './infrastructure/realtime/redis-io.adapter';
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

  // Redis-backed Socket.IO adapter (cross-instance room broadcasts) only when
  // REDIS_URL is set; without it the gateway falls back to the default
  // in-process IoAdapter, which is correct for local dev and tests.
  const redisUrl = config.get<string>('redis.url', '');
  if (redisUrl) {
    app.useWebSocketAdapter(new RedisIoAdapter(app, redisUrl));
  }

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
  logger.info('application_started', {
    env: config.get('app.env'),
    port,
  });
}

void bootstrap();
