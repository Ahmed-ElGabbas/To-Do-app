import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TeamMembershipGuard } from './common/guards/team-membership.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { LoggerService } from './common/logger/logger.service';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { CacheModule } from './infrastructure/cache/cache.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { TaskEventsModule } from './infrastructure/events/task-events.module';
import { MailerModule } from './infrastructure/mailer/mailer.module';
import { PushModule } from './infrastructure/push/push.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoryModule } from './modules/category/category.module';
import { CommentModule } from './modules/comment/comment.module';
import { FileModule } from './modules/file/file.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { MemberModule } from './modules/member/member.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SearchModule } from './modules/search/search.module';
import { TagModule } from './modules/tag/tag.module';
import { TaskModule } from './modules/task/task.module';
import { TeamModule } from './modules/team/team.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            limit: config.get<number>('throttle.limit', 100),
            ttl: config.get<number>('throttle.ttlMs', 60_000),
          },
        ],
      }),
    }),
    LoggerModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    TaskEventsModule.forRoot(),
    MailerModule,
    PushModule,
    HealthModule,
    UserModule,
    AuthModule,
    StorageModule,
    TagModule,
    CategoryModule,
    SettingsModule,
    TaskModule,
    ActivityLogModule,
    NotificationModule,
    FileModule,
    TeamModule,
    MemberModule,
    InvitationModule,
    CommentModule,
    SearchModule,
    AnalyticsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TeamMembershipGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_INTERCEPTOR,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const timeoutLogger = new LoggerService();
        timeoutLogger.setContext('Timeout');
        return new TimeoutInterceptor(
          config.get<number>('app.timeoutMs', 10_000),
          timeoutLogger,
        );
      },
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes('*');
  }
}
