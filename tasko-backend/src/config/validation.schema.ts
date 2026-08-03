import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  HTTP_TIMEOUT_MS: Joi.number().min(100).default(10000),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('900s'),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).default(30),

  DB_TYPE: Joi.string().valid('postgres', 'sqlite').default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('tasko'),
  DB_PASSWORD: Joi.string().default('tasko'),
  DB_DATABASE: Joi.string().default('tasko'),
  DB_FILE: Joi.string().default('tasko.sqlite'),
  // Defaults to true for sqlite tiers (dev/test) and false for Postgres (prod);
  // see ADR-0004. No Joi default here: @nestjs/config writes validated values
  // back into process.env, so a default(false) would pin DB_SYNCHRONIZE to
  // 'false' even when unset and override the per-driver default in
  // configuration.ts. Explicit DB_SYNCHRONIZE is converted truthy/falsy.
  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false'),

  REDIS_URL: Joi.string().allow('').default(''),

  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().email().default('no-reply@tasko.dev'),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  UPLOAD_DIR: Joi.string().default('./storage'),
  MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(50).default(5),

  FILE_SIGNING_SECRET: Joi.string().min(16).allow('').default(''),
  FILE_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).default(3600),

  S3_BUCKET: Joi.string().allow('').default(''),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  S3_ENDPOINT: Joi.string().allow('').default(''),
  S3_PRESIGN_TTL_SECONDS: Joi.number().integer().min(60).default(3600),
});
