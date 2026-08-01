export interface PushMessage {
  deviceTokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push-notification abstraction. Phase 1 ships a no-op implementation; the
 * concrete vendor (e.g. FCM/APNs) is swapped in via PushModule when wired.
 */
export abstract class PushService {
  abstract send(message: PushMessage): Promise<void>;
}
