import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../../common/logger/logger.module';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseModule {}
