import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/models/comment.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/collaboration/state/comment_provider.dart';

/// Comments on a single task (list + composer). Comment editing/deletion is
/// restricted to the author in the UI; the backend also allows team
/// editors/owners to modify any comment on a team task.
class CommentsScreen extends StatefulWidget {
  const CommentsScreen({super.key, required this.taskId});

  final String taskId;

  @override
  State<CommentsScreen> createState() => _CommentsScreenState();
}

class _CommentsScreenState extends State<CommentsScreen> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return ChangeNotifierProvider(
      create: (_) => CommentProvider()..load(widget.taskId),
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: theme.appBarTheme.backgroundColor,
          elevation: 0,
          leading: IconButton(
            icon: Icon(
              Icons.arrow_back_rounded,
              color: theme.colorScheme.onSurface,
            ),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(
            l10n.get('comments'),
            style: AppTextStyles.heading3.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: Consumer<CommentProvider>(
                builder: (context, provider, _) =>
                    _buildBody(context, provider),
              ),
            ),
            Consumer<CommentProvider>(
              builder: (context, provider, _) => _buildComposer(context, provider),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, CommentProvider provider) {
    final l10n = AppLocalizations.of(context);

    if (provider.isLoading && provider.comments.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (provider.errorMessage != null && provider.comments.isEmpty) {
      return _buildMessage(
        context,
        Icons.error_outline_rounded,
        provider.errorMessage!,
      );
    }
    if (provider.comments.isEmpty) {
      return _buildMessage(
        context,
        Icons.forum_outlined,
        l10n.get('no_comments'),
      );
    }
    return RefreshIndicator(
      onRefresh: () => provider.load(widget.taskId),
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSizes.md),
        itemCount: provider.comments.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
        itemBuilder: (context, index) =>
            _buildCommentCard(context, provider.comments[index]),
      ),
    );
  }

  Widget _buildCommentCard(BuildContext context, Comment comment) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final currentUserId = context.watch<AuthProvider>().userId;
    final isMine = currentUserId.isNotEmpty && comment.userId == currentUserId;

    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: theme.primaryColor.withValues(alpha: 0.1),
                child: Icon(
                  Icons.person_rounded,
                  size: AppSizes.iconSm,
                  color: theme.primaryColor,
                ),
              ),
              const SizedBox(width: AppSizes.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isMine)
                      Text(
                        l10n.get('you'),
                        style: AppTextStyles.labelMedium.copyWith(
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                    Text(
                      _formatTime(comment.createdAt),
                      style: AppTextStyles.caption.copyWith(
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              if (isMine)
                PopupMenuButton<String>(
                  color: theme.colorScheme.surface,
                  onSelected: (value) {
                    if (value == 'edit') {
                      _showEditDialog(context, comment);
                    } else if (value == 'delete') {
                      _showDeleteDialog(context, comment);
                    }
                  },
                  itemBuilder: (ctx) => [
                    PopupMenuItem(
                      value: 'edit',
                      child: Text(l10n.get('edit')),
                    ),
                    PopupMenuItem(
                      value: 'delete',
                      child: Text(
                        l10n.get('delete_comment'),
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: AppSizes.sm),
          Text(
            comment.body,
            style: AppTextStyles.bodyMedium.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildComposer(BuildContext context, CommentProvider provider) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.md,
        AppSizes.sm,
        AppSizes.md,
        AppSizes.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: theme.dividerColor)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              minLines: 1,
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: l10n.get('comment_hint'),
                filled: true,
                fillColor: theme.scaffoldBackgroundColor,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSizes.md,
                  vertical: AppSizes.sm,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSizes.sm),
          IconButton(
            onPressed: provider.isSubmitting ? null : _submit,
            icon: provider.isSubmitting
                ? SizedBox(
                    width: AppSizes.iconMd,
                    height: AppSizes.iconMd,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: theme.primaryColor,
                    ),
                  )
                : Icon(Icons.send_rounded, color: theme.primaryColor),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty) return;
    final provider = Provider.of<CommentProvider>(context, listen: false);
    final ok = await provider.addComment(taskId: widget.taskId, body: body);
    if (!mounted) return;
    if (ok) {
      _controller.clear();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            provider.errorMessage ??
                AppLocalizations.read(context).get('comment_add_failed'),
          ),
        ),
      );
    }
  }

  Future<void> _showEditDialog(BuildContext context, Comment comment) async {
    final provider = Provider.of<CommentProvider>(context, listen: false);
    final updated = await showDialog<String>(
      context: context,
      builder: (_) => _CommentEditDialog(initialBody: comment.body),
    );
    if (updated == null || updated.isEmpty || updated == comment.body) return;
    await provider.updateComment(id: comment.id, body: updated);
  }

  Future<void> _showDeleteDialog(BuildContext context, Comment comment) async {
    final l10n = AppLocalizations.read(context);
    final provider = Provider.of<CommentProvider>(context, listen: false);
    final theme = Theme.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        ),
        title: Text(
          l10n.get('delete_comment'),
          style: AppTextStyles.heading3.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
        content: Text(
          l10n.get('delete_comment_confirm'),
          style: AppTextStyles.bodyMedium.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              l10n.get('cancel'),
              style: AppTextStyles.labelLarge.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              l10n.get('confirm'),
              style: AppTextStyles.labelLarge.copyWith(
                color: Colors.redAccent,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await provider.deleteComment(comment.id);
  }

  Widget _buildMessage(BuildContext context, IconData icon, String message) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 56,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
          ),
          const SizedBox(height: AppSizes.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.xl),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} '
        '${two(local.hour)}:${two(local.minute)}';
  }
}

class _CommentEditDialog extends StatefulWidget {
  const _CommentEditDialog({required this.initialBody});

  final String initialBody;

  @override
  State<_CommentEditDialog> createState() => _CommentEditDialogState();
}

class _CommentEditDialogState extends State<_CommentEditDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialBody);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return AlertDialog(
      backgroundColor: theme.colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      title: Text(
        l10n.get('edit'),
        style: AppTextStyles.heading3.copyWith(
          color: theme.colorScheme.onSurface,
        ),
      ),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLines: 4,
        decoration: InputDecoration(hintText: l10n.get('comment_hint')),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            l10n.get('cancel'),
            style: AppTextStyles.labelLarge.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
          child: Text(
            l10n.get('save'),
            style: AppTextStyles.labelLarge.copyWith(
              color: theme.primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}
