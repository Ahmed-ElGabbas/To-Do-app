import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { setupSwagger } from './infrastructure/swagger/setup-swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = new LoggerService();
  logger.setContext('Bootstrap');
  app.useLogger(logger);
  app.use(correlationIdMiddleware);

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
