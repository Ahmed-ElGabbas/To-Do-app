import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/presentation/screens/team_details_screen.dart';
import 'package:tasko/features/collaboration/state/search_provider.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _debounce?.cancel();
    final provider = Provider.of<SearchProvider>(context, listen: false);
    if (query.trim().isEmpty) {
      setState(() {});
      provider.search('');
      return;
    }
    setState(() {});
    _debounce = Timer(const Duration(milliseconds: 400), () {
      provider.search(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return ChangeNotifierProvider(
      create: (_) => SearchProvider(),
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: theme.appBarTheme.backgroundColor,
          title: Text(
            l10n.get('search_placeholder'),
            style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
          ),
          centerTitle: true,
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSizes.md, AppSizes.sm, AppSizes.md, AppSizes.sm),
              child: TextField(
                controller: _controller,
                autofocus: true,
                onChanged: _onQueryChanged,
                decoration: InputDecoration(
                  hintText: l10n.get('search_placeholder'),
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () {
                            _controller.clear();
                            _onQueryChanged('');
                          },
                        ),
                  filled: true,
                  fillColor: theme.colorScheme.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            Expanded(child: _buildBody(context)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final provider = context.watch<SearchProvider>();

    if (_controller.text.trim().isEmpty) {
      return _buildMessage(context, Icons.search_rounded, l10n.get('type_to_search'));
    }
    if (provider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final results = provider.results;
    if (results == null) {
      return _buildMessage(
        context,
        Icons.search_off_rounded,
        provider.errorMessage ?? l10n.get('no_results'),
      );
    }
    if (results.total == 0) {
      return _buildMessage(context, Icons.search_off_rounded, l10n.get('no_results'));
    }
    return ListView(
      padding: const EdgeInsets.all(AppSizes.md),
      children: [
        if (results.tasks.items.isNotEmpty) ...[
          _buildSectionHeader(context, 'Tasks', results.tasks.total),
          ...results.tasks.items.map(
            (task) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(task.isDone ? Icons.task_alt_rounded : Icons.radio_button_unchecked_rounded, color: theme.primaryColor),
              title: Text(task.title, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
              subtitle: Text('${task.date} · ${task.time}', style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => TaskDetailsScreen(task: task)),
              ),
            ),
          ),
        ],
        if (results.teams.items.isNotEmpty) ...[
          _buildSectionHeader(context, 'Teams', results.teams.total),
          ...results.teams.items.map(
            (team) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.groups_rounded, color: theme.primaryColor),
              title: Text(team.name, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => TeamDetailsScreen(teamId: team.id)),
              ),
            ),
          ),
        ],
        if (results.categories.items.isNotEmpty) ...[
          _buildSectionHeader(context, 'Categories', results.categories.total),
          ...results.categories.items.map(
            (category) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.folder_rounded, color: theme.colorScheme.secondary),
              title: Text(category.name, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
            ),
          ),
        ],
        if (results.tags.items.isNotEmpty) ...[
          _buildSectionHeader(context, 'Tags', results.tags.total),
          ...results.tags.items.map(
            (tag) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.label_rounded, color: theme.colorScheme.secondary),
              title: Text(tag.name, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, int total) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final label = switch (title) {
      'Tasks' => l10n.get('tasks'),
      'Teams' => l10n.get('teams'),
      'Categories' => l10n.get('categories'),
      _ => l10n.get('tags'),
    };
    return Padding(
      padding: const EdgeInsets.only(top: AppSizes.sm, bottom: AppSizes.xs),
      child: Text(
        '$label ($total)',
        style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface),
      ),
    );
  }

  Widget _buildMessage(BuildContext context, IconData icon, String message) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: theme.colorScheme.onSurface.withValues(alpha: 0.2)),
          const SizedBox(height: AppSizes.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.xl),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
            ),
          ),
        ],
      ),
    );
  }
}
