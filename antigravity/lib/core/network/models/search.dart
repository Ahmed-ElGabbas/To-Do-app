import 'search_simple.dart';
import 'search_task.dart';

class SearchGroup<T> {
  const SearchGroup({required this.total, required this.items});

  final int total;
  final List<T> items;

  factory SearchGroup.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFromJson,
  ) =>
      SearchGroup(
        total: json['total'] as int? ?? 0,
        items: (json['items'] as List<dynamic>? ?? const [])
            .map((e) => itemFromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class SearchResults {
  const SearchResults({
    required this.query,
    required this.scope,
    required this.page,
    required this.limit,
    required this.tasks,
    required this.teams,
    required this.categories,
    required this.tags,
  });

  final String query;
  final String scope;
  final int page;
  final int limit;
  final SearchGroup<TaskSummary> tasks;
  final SearchGroup<TeamSummary> teams;
  final SearchGroup<CategorySummary> categories;
  final SearchGroup<TagSummary> tags;

  int get total => tasks.total + teams.total + categories.total + tags.total;

  factory SearchResults.fromJson(Map<String, dynamic> json) => SearchResults(
        query: json['query'] as String? ?? '',
        scope: json['scope'] as String? ?? 'all',
        page: json['page'] as int? ?? 1,
        limit: json['limit'] as int? ?? 20,
        tasks: SearchGroup.fromJson(
          json['results']?['tasks'] as Map<String, dynamic>? ?? const {},
          TaskSummary.fromJson,
        ),
        teams: SearchGroup.fromJson(
          json['results']?['teams'] as Map<String, dynamic>? ?? const {},
          TeamSummary.fromJson,
        ),
        categories: SearchGroup.fromJson(
          json['results']?['categories'] as Map<String, dynamic>? ?? const {},
          CategorySummary.fromJson,
        ),
        tags: SearchGroup.fromJson(
          json['results']?['tags'] as Map<String, dynamic>? ?? const {},
          TagSummary.fromJson,
        ),
      );
}
