import { InMemoryPresenceRegistry } from './presence-registry.service';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('InMemoryPresenceRegistry', () => {
  let registry: InMemoryPresenceRegistry;

  beforeEach(() => {
    registry = new InMemoryPresenceRegistry();
  });

  it('reports the first connection as the online transition', () => {
    expect(registry.register(ALICE, 'socket-a')).toBe(true);
    expect(registry.isUserOnline(ALICE)).toBe(true);
  });

  it('does not re-signal online for a second device', () => {
    registry.register(ALICE, 'socket-a');
    expect(registry.register(ALICE, 'socket-b')).toBe(false);
    expect(registry.isUserOnline(ALICE)).toBe(true);
  });

  it('reports only the last disconnect as the offline transition', () => {
    registry.register(ALICE, 'socket-a');
    registry.register(ALICE, 'socket-b');
    expect(registry.unregister(ALICE, 'socket-a')).toBe(false);
    expect(registry.isUserOnline(ALICE)).toBe(true);
    expect(registry.unregister(ALICE, 'socket-b')).toBe(true);
    expect(registry.isUserOnline(ALICE)).toBe(false);
  });

  it('returns false for an unknown user or socket', () => {
    expect(registry.unregister(ALICE, 'ghost')).toBe(false);
    expect(registry.isUserOnline(ALICE)).toBe(false);
    expect(registry.isUserOnline(BOB)).toBe(false);
  });
});
