import 'team.dart';
import 'category.dart';
import 'tag.dart';

class TeamSummary extends Team {
  const TeamSummary({
    required super.id,
    required super.name,
    required super.ownerId,
    required super.createdAt,
    required super.updatedAt,
    super.description,
  });

  factory TeamSummary.fromJson(Map<String, dynamic> json) => TeamSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        ownerId: json['ownerId'] as String,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}

class CategorySummary extends Category {
  const CategorySummary({
    required super.id,
    required super.name,
    required super.createdAt,
    required super.updatedAt,
    super.teamId,
  });

  factory CategorySummary.fromJson(Map<String, dynamic> json) =>
      CategorySummary(
        id: json['id'] as String,
        name: json['name'] as String,
        teamId: json['teamId'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}

class TagSummary extends Tag {
  const TagSummary({
    required super.id,
    required super.name,
    required super.createdAt,
    required super.updatedAt,
    super.teamId,
  });

  factory TagSummary.fromJson(Map<String, dynamic> json) => TagSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        teamId: json['teamId'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}
