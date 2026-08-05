class PriorityBreakdown {
  const PriorityBreakdown({
    required this.high,
    required this.medium,
    required this.low,
  });

  final int high;
  final int medium;
  final int low;

  factory PriorityBreakdown.fromJson(Map<String, dynamic> json) =>
      PriorityBreakdown(
        high: json['high'] as int? ?? 0,
        medium: json['medium'] as int? ?? 0,
        low: json['low'] as int? ?? 0,
      );
}

class CategoryBreakdown {
  const CategoryBreakdown({
    required this.categoryId,
    required this.name,
    required this.total,
    required this.completed,
  });

  final String? categoryId;
  final String? name;
  final int total;
  final int completed;

  factory CategoryBreakdown.fromJson(Map<String, dynamic> json) =>
      CategoryBreakdown(
        categoryId: json['categoryId'] as String?,
        name: json['name'] as String?,
        total: json['total'] as int? ?? 0,
        completed: json['completed'] as int? ?? 0,
      );
}

class TrendPoint {
  const TrendPoint({required this.date, required this.completed});

  /// Calendar date label `yyyy-MM-dd`.
  final String date;
  final int completed;

  factory TrendPoint.fromJson(Map<String, dynamic> json) => TrendPoint(
        date: json['date'] as String,
        completed: json['completed'] as int? ?? 0,
      );
}

class AnalyticsSummary {
  const AnalyticsSummary({
    required this.total,
    required this.completed,
    required this.pending,
    required this.completionRate,
    required this.overdue,
    required this.byPriority,
    required this.byCategory,
    required this.completionTrend,
  });

  final int total;
  final int completed;
  final int pending;
  final double completionRate;
  final int overdue;
  final PriorityBreakdown byPriority;
  final List<CategoryBreakdown> byCategory;
  final List<TrendPoint> completionTrend;

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) =>
      AnalyticsSummary(
        total: json['total'] as int? ?? 0,
        completed: json['completed'] as int? ?? 0,
        pending: json['pending'] as int? ?? 0,
        completionRate: (json['completionRate'] as num?)?.toDouble() ?? 0,
        overdue: json['overdue'] as int? ?? 0,
        byPriority: PriorityBreakdown.fromJson(
          json['byPriority'] as Map<String, dynamic>? ?? const {},
        ),
        byCategory: (json['byCategory'] as List<dynamic>? ?? const [])
            .map((e) => CategoryBreakdown.fromJson(e as Map<String, dynamic>))
            .toList(),
        completionTrend: (json['completionTrend'] as List<dynamic>? ?? const [])
            .map((e) => TrendPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
