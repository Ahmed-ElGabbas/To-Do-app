import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.service';

/**
 * Provides the StorageService implementation chosen from configuration
 * (`STORAGE_DRIVER=local` for dev/tests, `=s3` for production).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService =>
        config.get<string>('storage.driver') === 's3'
          ? new S3StorageService(config)
          : new LocalStorageService(config),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
