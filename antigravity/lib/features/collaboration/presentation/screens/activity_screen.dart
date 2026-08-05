import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/state/activity_provider.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ActivityProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        title: Text(
          l10n.get('activity'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
      ),
      body: Consumer<ActivityProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.entries.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.entries.isEmpty) {
            return _buildEmpty(context, l10n.get('no_activity'));
          }
          return RefreshIndicator(
            onRefresh: provider.load,
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSizes.md),
              itemCount: provider.entries.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
              itemBuilder: (context, index) {
                final entry = provider.entries[index];
                return _ActivityTile(
                  summary: entry.summary,
                  type: entry.type,
                  time: entry.createdAt,
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmpty(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history_rounded, size: 56, color: theme.colorScheme.onSurface.withValues(alpha: 0.2)),
          const SizedBox(height: AppSizes.sm),
          Text(message, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({
    required this.summary,
    required this.type,
    required this.time,
  });

  final String summary;
  final String type;
  final DateTime time;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: theme.primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSizes.radiusSm),
            ),
            child: Icon(_iconFor(type), color: theme.primaryColor, size: 20),
          ),
          const SizedBox(width: AppSizes.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary,
                  style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface),
                ),
                const SizedBox(height: 2),
                Text(
                  _typeLabel(type),
                  style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSizes.sm),
          Text(
            _relativeTime(time),
            style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.35)),
          ),
        ],
      ),
    );
  }

  IconData _iconFor(String type) {
    if (type.startsWith('task')) return Icons.checklist_rounded;
    if (type.startsWith('team')) return Icons.groups_rounded;
    if (type.startsWith('comment')) return Icons.chat_bubble_outline_rounded;
    if (type.startsWith('user')) return Icons.person_outline_rounded;
    return Icons.history_rounded;
  }

  String _typeLabel(String type) => type.replaceAll('.', ' · ');

  String _relativeTime(DateTime time) {
    final difference = DateTime.now().difference(time);
    if (difference.inMinutes < 1) return 'now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m';
    if (difference.inHours < 24) return '${difference.inHours}h';
    return '${difference.inDays}d';
  }
}
