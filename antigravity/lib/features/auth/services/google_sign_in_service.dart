import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:google_sign_in/google_sign_in.dart';

/// Thrown when the user dismisses the Google sign-in flow.
class GoogleSignInCancelledException implements Exception {
  const GoogleSignInCancelledException();
}

/// Drives the client-side Google -> Firebase sign-in flow and hands the
/// resulting Firebase ID token to the backend `socialLogin` API.
class GoogleSignInService {
  GoogleSignInService();

  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  firebase_auth.FirebaseAuth? _firebaseAuth;
  bool _initialized = false;

  firebase_auth.FirebaseAuth get _auth =>
      _firebaseAuth ??= firebase_auth.FirebaseAuth.instance;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await _googleSignIn.initialize();
    _initialized = true;
  }

  /// Signs in with Google and returns the Firebase ID token for the account.
  ///
  /// Throws [GoogleSignInCancelledException] when the user dismisses the
  /// flow; other errors are propagated for the caller to surface.
  Future<String> getFirebaseIdToken() async {
    await _ensureInitialized();
    final GoogleSignInAccount googleUser;
    try {
      googleUser = await _googleSignIn.authenticate();
    } on GoogleSignInException catch (e) {
      switch (e.code) {
        case GoogleSignInExceptionCode.canceled:
        case GoogleSignInExceptionCode.interrupted:
        case GoogleSignInExceptionCode.uiUnavailable:
          throw const GoogleSignInCancelledException();
        default:
          rethrow;
      }
    }
    final idToken = googleUser.authentication.idToken;
    if (idToken == null) {
      throw StateError('Google account returned no ID token');
    }
    final credential = firebase_auth.GoogleAuthProvider.credential(idToken: idToken);
    final userCredential = await _auth.signInWithCredential(credential);
    final firebaseUser = userCredential.user;
    if (firebaseUser == null) {
      throw StateError('Firebase sign-in returned no user');
    }
    return (await firebaseUser.getIdToken()) ??
        (throw StateError('Firebase user returned no ID token'));
  }
}
