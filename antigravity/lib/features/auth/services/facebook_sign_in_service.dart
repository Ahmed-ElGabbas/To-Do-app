import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';

/// Thrown when the user dismisses the Facebook sign-in flow.
class FacebookSignInCancelledException implements Exception {
  const FacebookSignInCancelledException();
}

/// Drives the client-side Facebook -> Firebase sign-in flow and hands the
/// resulting Firebase ID token to the backend `socialLogin` API.
class FacebookSignInService {
  FacebookSignInService();

  firebase_auth.FirebaseAuth? _firebaseAuth;

  firebase_auth.FirebaseAuth get _auth =>
      _firebaseAuth ??= firebase_auth.FirebaseAuth.instance;

  /// Signs in with Facebook and returns the Firebase ID token for the account.
  ///
  /// Throws [FacebookSignInCancelledException] when the user dismisses the
  /// flow; other errors are propagated for the caller to surface.
  Future<String> getFirebaseIdToken() async {
    final loginResult = await FacebookAuth.instance.login(
      permissions: const ['email', 'public_profile'],
    );
    final accessToken = loginResult.accessToken;
    if (loginResult.status == LoginStatus.cancelled ||
        loginResult.status == LoginStatus.failed ||
        accessToken == null) {
      throw const FacebookSignInCancelledException();
    }
    final credential =
        firebase_auth.FacebookAuthProvider.credential(accessToken.tokenString);
    final userCredential = await _auth.signInWithCredential(credential);
    final firebaseUser = userCredential.user;
    if (firebaseUser == null) {
      throw StateError('Firebase sign-in returned no user');
    }
    return (await firebaseUser.getIdToken()) ??
        (throw StateError('Firebase user returned no ID token'));
  }
}
