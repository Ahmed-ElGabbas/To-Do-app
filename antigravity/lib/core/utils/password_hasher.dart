import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

String generateSalt() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  return base64.encode(bytes);
}

String hashPassword(String password, String salt) {
  final salted = salt + password;
  final bytes = utf8.encode(salted);
  return sha256.convert(bytes).toString();
}
