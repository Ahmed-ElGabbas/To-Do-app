/**
 * Jest-only stub for `firebase-admin/messaging` (see firebase-admin-app.stub.ts).
 * Returns the same messaging object on every call so consumers and tests share
 * the same `sendEachForMulticast` jest.fn.
 */
export const messaging = {
  send: jest.fn(),
  sendMulticast: jest.fn(),
  sendEachForMulticast: jest.fn(),
};

export const getMessaging = jest.fn(() => messaging);
