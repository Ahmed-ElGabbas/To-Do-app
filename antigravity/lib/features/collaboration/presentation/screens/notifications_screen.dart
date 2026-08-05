import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/models/notification.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/state/notification_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationProvider>().load();
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
          l10n.get('notifications'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.done_all_rounded, color: theme.primaryColor),
            tooltip: l10n.get('mark_all_read'),
            onPressed: () => context.read<NotificationProvider>().markAllRead(),
          ),
        ],
      ),
      body: Consumer<NotificationProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.notifications.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.notifications.isEmpty) {
            return _buildEmpty(context, l10n.get('no_notifications'));
          }
          return RefreshIndicator(
            onRefresh: provider.load,
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSizes.md),
              itemCount: provider.notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
              itemBuilder: (context, index) {
                final notification = provider.notifications[index];
                return _NotificationTile(
                  notification: notification,
                  onTap: () => provider.markRead(notification.id),
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
          Icon(Icons.notifications_off_rounded, size: 56, color: theme.colorScheme.onSurface.withValues(alpha: 0.2)),
          const SizedBox(height: AppSizes.sm),
          Text(message, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final isUnread = !notification.isRead;

    return Material(
      color: isUnread
          ? theme.primaryColor.withValues(alpha: 0.06)
          : theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.md),
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
                child: Icon(
                  isUnread ? Icons.notifications_active_rounded : Icons.notifications_rounded,
                  color: theme.primaryColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSizes.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: theme.colorScheme.onSurface,
                        fontWeight: isUnread ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notification.body,
                      style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _relativeTime(notification.createdAt, l10n),
                      style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.35)),
                    ),
                  ],
                ),
              ),
              if (isUnread)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _relativeTime(DateTime time, AppLocalizations l10n) {
    final difference = DateTime.now().difference(time);
    if (difference.inMinutes < 1) return 'now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m';
    if (difference.inHours < 24) return '${difference.inHours}h';
    return '${difference.inDays}d';
  }
}
