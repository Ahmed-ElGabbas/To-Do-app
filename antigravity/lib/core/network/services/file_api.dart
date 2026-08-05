import 'dart:io';

import 'package:dio/dio.dart';

import '../api_client.dart';
import '../models/uploaded_file.dart';

class FileApi {
  FileApi(this._client);

  final ApiClient _client;

  Future<UploadedFile> uploadAvatar(File file) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.uri.pathSegments.last,
      ),
    });
    final response = await _client.post(
      '/files/avatar',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return UploadedFile.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<UploadedFile?> avatar() async {
    final response = await _client.get('/files/avatar');
    final data = _client.unwrap(response);
    if (data == null) return null;
    return UploadedFile.fromJson(data as Map<String, dynamic>);
  }

  Future<void> deleteAvatar() async {
    await _client.delete('/files/avatar');
  }
}
