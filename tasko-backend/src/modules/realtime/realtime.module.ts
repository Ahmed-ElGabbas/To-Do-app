import { Module } from '@nestjs/common';
import { LoggerModule } from '../../common/logger/logger.module';
import { TaskEventsModule } from '../../infrastructure/events/task-events.module';
import { FirebaseModule } from '../../infrastructure/firebase/firebase.module';
import { AuthModule } from '../auth/auth.module';
import { CommentModule } from '../comment/comment.module';
import { MemberModule } from '../member/member.module';
import { TaskModule } from '../task/task.module';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { PresenceRegistry } from './interfaces/presence-registry';
import { RealtimeRateLimiter } from './interfaces/realtime-rate-limiter';
import { RealtimeEventConsumer } from './services/realtime-event-consumer.service';
import { InMemoryPresenceRegistry } from './services/presence-registry.service';
import { InMemoryRealtimeRateLimiter } from './services/realtime-rate-limiter.service';

/**
 * Real-time (Socket.IO) layer. Additive by design: REST stays the write path,
 * JWT access tokens are the only auth, FCM keeps covering backgrounded users,
 * and all domain events reach this layer through the same TaskEventBus the
 * notification/activity consumers already use.
 *
 * Exports the gateway and the presence registry: the gateway so later rounds
 * can share the live Server instance with the realtime event consumer, and the
 * registry so NotificationService can suppress pushes for online users (the
 * Socket.IO ⇄ FCM handoff rule).
 */
@Module({
  imports: [
    LoggerModule,
    TaskEventsModule,
    FirebaseModule,
    AuthModule,
    MemberModule,
    TaskModule,
    CommentModule,
  ],
  providers: [
    RealtimeGateway,
    RealtimeEventConsumer,
    { provide: PresenceRegistry, useClass: InMemoryPresenceRegistry },
    { provide: RealtimeRateLimiter, useClass: InMemoryRealtimeRateLimiter },
  ],
  exports: [
    RealtimeGateway,
    RealtimeEventConsumer,
    PresenceRegistry,
    RealtimeRateLimiter,
  ],
})
export class RealtimeModule {}
