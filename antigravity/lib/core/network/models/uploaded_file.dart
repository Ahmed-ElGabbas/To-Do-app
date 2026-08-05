class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.kind,
    required this.mimeType,
    required this.size,
    required this.originalName,
    required this.url,
    required this.createdAt,
  });

  final String id;
  final String kind; // 'avatar'
  final String mimeType;
  final int size;
  final String originalName;
  final String url;
  final DateTime createdAt;

  factory UploadedFile.fromJson(Map<String, dynamic> json) => UploadedFile(
        id: json['id'] as String,
        kind: json['kind'] as String? ?? 'avatar',
        mimeType: json['mimeType'] as String,
        size: json['size'] as int? ?? 0,
        originalName: json['originalName'] as String,
        url: json['url'] as String,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
      );
}
