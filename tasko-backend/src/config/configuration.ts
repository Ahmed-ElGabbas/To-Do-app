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
    // Postgres never auto-syncs (migrations only); sqlite tiers sync by default
    // so dev/test start with a working schema (ADR-0004). An explicit
    // DB_SYNCHRONIZE env var overrides the per-driver default.
    synchronize:
      process.env.DB_SYNCHRONIZE !== undefined
        ? process.env.DB_SYNCHRONIZE.toLowerCase() === 'true'
        : (process.env.DB_TYPE ?? 'postgres') === 'sqlite',
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
  deepLink: {
    /**
     * Public HTTPS base URL used to build invitation deep links and the
     * "Open Tasko" button on the browser landing page. PLACEHOLDER until a
     * real domain exists — App Links / Universal Links verify over HTTPS
     * only (Section 6). The host must match the Android intent-filter host
     * and the iOS `applinks:` entitlement, and this domain must serve the
     * /.well-known/ files.
     */
    baseUrl: process.env.DEEP_LINK_BASE_URL ?? 'https://tasko.example',
    /**
     * Apple Team ID used in the apple-app-site-association `appID`
     * (TEAMID.com.tasko.app). PLACEHOLDER — requires an Apple Developer
     * account.
     */
    appleTeamId: process.env.APPLE_TEAM_ID ?? 'TEAM_ID_PLACEHOLDER',
    /**
     * Comma-separated SHA-256 certificate fingerprints (colon-separated hex,
     * exactly as keytool prints them) for assetlinks.json. Defaults to the
     * debug keystore fingerprint; release builds currently sign with debug
     * keys. Add the release fingerprint here once a real release keystore
     * exists.
     */
    androidFingerprints:
      process.env.ANDROID_CERT_FINGERPRINTS ??
      '47:4E:76:0C:B2:94:C4:24:9A:7A:FC:7A:D5:BE:D6:83:70:98:95:9C:B8:C5:7C:7B:C1:33:B2:13:BE:47:8D:AD',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    /**
     * Path to the Firebase service-account JSON file. Either this or the
     * base64-encoded FIREBASE_SERVICE_ACCOUNT_JSON must be set for social
     * login. When both are empty the FirebaseAdminService stays uninitialized
     * (social login rejects requests) so dev/test boot without credentials.
     */
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
  },
});
