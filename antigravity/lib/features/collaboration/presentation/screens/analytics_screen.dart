import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/models/analytics.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/state/analytics_provider.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  bool _useTeam = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final provider = context.read<AnalyticsProvider>();
        final teamProvider = context.read<TeamProvider>();
        provider.load(teamId: _useTeam ? teamProvider.activeTeamId : null);
      }
    });
  }

  void _reload() {
    final provider = context.read<AnalyticsProvider>();
    final teamProvider = context.read<TeamProvider>();
    provider.load(teamId: _useTeam ? teamProvider.activeTeamId : null);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final teamProvider = context.watch<TeamProvider>();
    final hasTeam = teamProvider.activeTeam != null;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        title: Text(
          l10n.get('analytics'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            color: theme.colorScheme.onSurface,
            onPressed: _reload,
          ),
        ],
      ),
      body: Column(
        children: [
          if (hasTeam)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
              child: SegmentedButton<bool>(
                segments: [
                  ButtonSegment(value: false, label: Text(l10n.get('you'))),
                  ButtonSegment(
                    value: true,
                    label: Text(
                      teamProvider.activeTeam!.name,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                selected: {_useTeam},
                onSelectionChanged: (selection) {
                  setState(() => _useTeam = selection.first);
                  _reload();
                },
              ),
            ),
          Expanded(
            child: Consumer<AnalyticsProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading && provider.summary == null) {
                  return const Center(child: CircularProgressIndicator());
                }
                final summary = provider.summary;
                if (summary == null) {
                  return Center(
                    child: Text(
                      provider.errorMessage ?? '',
                      style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                    ),
                  );
                }
                return ListView(
                  padding: const EdgeInsets.all(AppSizes.md),
                  children: [
                    _StatGrid(summary: summary),
                    const SizedBox(height: AppSizes.md),
                    _buildRateCard(context, summary.completionRate),
                    const SizedBox(height: AppSizes.md),
                    _buildPriorityCard(context, summary.byPriority),
                    if (summary.byCategory.isNotEmpty) ...[
                      const SizedBox(height: AppSizes.md),
                      _buildCategoryCard(context, summary.byCategory),
                    ],
                    if (summary.completionTrend.isNotEmpty) ...[
                      const SizedBox(height: AppSizes.md),
                      _buildTrendCard(context, summary.completionTrend),
                    ],
                    const SizedBox(height: AppSizes.xxl),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRateCard(BuildContext context, double rate) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final percent = (rate * 100).round();
    return Container(
      padding: const EdgeInsets.all(AppSizes.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.get('completion_rate'),
                  style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                ),
                const SizedBox(height: AppSizes.xs),
                Text(
                  '$percent%',
                  style: AppTextStyles.heading2.copyWith(color: theme.primaryColor),
                ),
              ],
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppSizes.radiusFull),
              child: LinearProgressIndicator(
                value: rate.clamp(0.0, 1.0),
                minHeight: 10,
                backgroundColor: theme.colorScheme.onSurface.withValues(alpha: 0.1),
                valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityCard(BuildContext context, PriorityBreakdown breakdown) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSizes.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.get('by_priority'), style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface)),
          const SizedBox(height: AppSizes.md),
          _priorityRow(context, l10n.get('high'), breakdown.high, theme.colorScheme.error),
          const SizedBox(height: AppSizes.sm),
          _priorityRow(context, l10n.get('medium'), breakdown.medium, theme.primaryColor),
          const SizedBox(height: AppSizes.sm),
          _priorityRow(context, l10n.get('low'), breakdown.low, Colors.green),
        ],
      ),
    );
  }

  Widget _priorityRow(BuildContext context, String label, int count, Color color) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: AppSizes.sm),
        Expanded(child: Text(label, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface))),
        Text('$count', style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildCategoryCard(BuildContext context, List<CategoryBreakdown> categories) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final maxTotal = categories.fold<int>(1, (max, c) => c.total > max ? c.total : max);
    return Container(
      padding: const EdgeInsets.all(AppSizes.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.get('by_category'), style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface)),
          const SizedBox(height: AppSizes.md),
          ...categories.map((category) => Padding(
                padding: const EdgeInsets.only(bottom: AppSizes.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            category.name ?? l10n.get('all'),
                            style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface),
                          ),
                        ),
                        Text(
                          '${category.completed}/${category.total}',
                          style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                      child: LinearProgressIndicator(
                        value: maxTotal > 0 ? category.total / maxTotal : 0,
                        minHeight: 6,
                        backgroundColor: theme.colorScheme.onSurface.withValues(alpha: 0.1),
                        valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildTrendCard(BuildContext context, List<TrendPoint> trend) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final maxCount = trend.fold<int>(1, (max, p) => p.completed > max ? p.completed : max);
    return Container(
      padding: const EdgeInsets.all(AppSizes.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.get('completion_trend'), style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface)),
          const SizedBox(height: AppSizes.md),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: trend.map((point) {
                final height = maxCount > 0 ? (point.completed / maxCount) * 100 : 0.0;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          '${point.completed}',
                          style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5), fontSize: 9),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          height: height,
                          decoration: BoxDecoration(
                            color: theme.primaryColor,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          point.date.length >= 5 ? point.date.substring(5) : point.date,
                          style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.4), fontSize: 8),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.summary});

  final AnalyticsSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        _statCard(context, '${summary.total}', Icons.assignment_rounded, l10n.get('total_tasks')),
        const SizedBox(width: AppSizes.sm),
        _statCard(context, '${summary.completed}', Icons.task_alt_rounded, l10n.get('completed_tasks')),
        const SizedBox(width: AppSizes.sm),
        _statCard(context, '${summary.pending}', Icons.schedule_rounded, l10n.get('pending')),
        const SizedBox(width: AppSizes.sm),
        _statCard(context, '${summary.overdue}', Icons.warning_amber_rounded, l10n.get('overdue')),
      ],
    );
  }

  Widget _statCard(BuildContext context, String value, IconData icon, String label) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppSizes.radiusLg),
        ),
        child: Column(
          children: [
            Icon(icon, color: theme.primaryColor, size: 18),
            const SizedBox(height: AppSizes.xs),
            Text(value, style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
            const SizedBox(height: 2),
            Text(
              label,
              style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5), fontSize: 9),
            ),
          ],
        ),
      ),
    );
  }
}
