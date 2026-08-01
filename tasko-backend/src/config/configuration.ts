export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS ?? '10000', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30', 10),
  },
  database: {
    type: process.env.DB_TYPE ?? 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'tasko',
    password: process.env.DB_PASSWORD ?? 'tasko',
    database: process.env.DB_DATABASE ?? 'tasko',
    file: process.env.DB_FILE ?? 'tasko.sqlite',
    synchronize:
      (process.env.DB_SYNCHRONIZE ?? 'true').toLowerCase() === 'true',
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  mailer: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'no-reply@tasko.dev',
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
  storage: {
    /** 'local' writes to disk (dev/test), 's3' uses object storage. */
    driver: process.env.STORAGE_DRIVER ?? 'local',
    dir: process.env.UPLOAD_DIR ?? './storage',
    maxFileSizeBytes:
      parseInt(process.env.MAX_FILE_SIZE_MB ?? '5', 10) * 1024 * 1024,
  },
  file: {
    /** HMAC secret for signed download URLs; empty falls back to JWT_SECRET. */
    signingSecret: process.env.FILE_SIGNING_SECRET ?? '',
    /** Seconds a signed download URL stays valid. */
    signedUrlTtlSeconds: parseInt(
      process.env.FILE_SIGNED_URL_TTL_SECONDS ?? '3600',
      10,
    ),
  },
  s3: {
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    endpoint: process.env.S3_ENDPOINT ?? '',
    presignTtlSeconds: parseInt(
      process.env.S3_PRESIGN_TTL_SECONDS ?? '3600',
      10,
    ),
  },
});
