import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts the OpenAPI 3 document and Swagger UI at /docs. Disabled in
 * production where the schema ships from a CI build instead.
 */
export function setupSwagger(app: INestApplication): void {
  const config = app.get(ConfigService);
  if (config.get<string>('app.env') === 'production') {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setTitle('Tasko API')
    .setDescription(
      'Tasko REST API. Every route except auth, health, and magic-link ' +
        'invitation endpoints requires a Bearer access token.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
