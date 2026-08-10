/**
 * How a user account was originally created. `password` is the default and
 * covers every pre-social-login account; social values are set only at
 * creation time (an existing account keeps its original provider when it is
 * linked to later social logins). Support/analytics visibility only — the auth
 * flow itself never branches on this value.
 */
export enum AuthProvider {
  PASSWORD = 'password',
  GOOGLE = 'google',
  APPLE = 'apple',
  FACEBOOK = 'facebook',
}
