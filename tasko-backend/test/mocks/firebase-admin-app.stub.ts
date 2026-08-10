/**
 * Jest-only stub for `firebase-admin/app`. The real package depends on the
 * ESM-only `jose` library, which the default CJS Jest transform cannot load.
 * All tests stub `FirebaseAdminService`, so the real SDK is never exercised —
 * only its module load must succeed.
 */
export const getApps = jest.fn(() => []);
export const getApp = jest.fn(() => ({ name: '[DEFAULT]' }));
export const initializeApp = jest.fn(() => ({ name: '[DEFAULT]' }));
export const cert = jest.fn(() => ({}));
