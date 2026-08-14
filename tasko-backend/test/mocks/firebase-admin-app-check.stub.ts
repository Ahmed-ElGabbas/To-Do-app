/**
 * Jest-only stub for `firebase-admin/app-check` (see firebase-admin-app.stub.ts).
 */
export const getAppCheck = jest.fn(() => ({
  verifyToken: jest.fn(),
}));
