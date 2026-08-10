/**
 * Jest-only stub for `firebase-admin/auth` (see firebase-admin-app.stub.ts).
 */
export const getAuth = jest.fn(() => ({
  verifyIdToken: jest.fn(),
}));
