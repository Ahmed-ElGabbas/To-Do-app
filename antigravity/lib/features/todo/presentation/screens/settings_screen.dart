import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/core/network/models/auth.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/shared/services/email_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        title: Text(l10n.get('settings'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        children: [
          _sectionHeader(context, l10n.get('account_settings')),
          _tile(
            context,
            icon: Icons.email_outlined,
            label: l10n.get('change_email'),
            onTap: () => _showChangeEmailSheet(context),
          ),
          Divider(height: 1, indent: 72, color: theme.dividerColor),
          _tile(
            context,
            icon: Icons.lock_outline_rounded,
            label: l10n.get('change_password'),
            onTap: () => _showChangePasswordSheet(context),
          ),
          Divider(height: 1, indent: 72, color: theme.dividerColor),
          _tile(
            context,
            icon: Icons.key_outlined,
            label: l10n.get('sign_in_method'),
            trailing: Text(
              _signInMethodLabel(context.watch<AuthProvider>().user, l10n),
              style: AppTextStyles.bodySmall.copyWith(color: theme.primaryColor),
            ),
            onTap: () {},
          ),

          _sectionHeader(context, l10n.get('notifications')),
          _switchTile(
            context,
            icon: Icons.notifications_outlined,
            label: l10n.get('push_notifications'),
            value: settings.notificationsEnabled,
            onChanged: (_) => context.read<SettingsProvider>().toggleNotifications(),
          ),

          _sectionHeader(context, l10n.get('appearance')),
          _switchTile(
            context,
            icon: Icons.dark_mode_outlined,
            label: l10n.get('dark_mode'),
            value: settings.isDarkMode,
            onChanged: (_) => context.read<SettingsProvider>().toggleDarkMode(),
          ),
          Divider(height: 1, indent: 72, color: theme.dividerColor),
          _tile(
            context,
            icon: Icons.language_outlined,
            label: l10n.get('language'),
            trailing: Text(
              _languageLabel(settings.language),
              style: AppTextStyles.bodySmall.copyWith(color: theme.primaryColor),
            ),
            onTap: () => _showLanguageSheet(context, settings.language),
          ),

          _sectionHeader(context, l10n.get('contact_us')),
          _tile(
            context,
            icon: Icons.mail_outline_rounded,
            label: l10n.get('contact_us'),
            onTap: () async => EmailService.contactUs(),
          ),

          const SizedBox(height: AppSizes.xxl),
        ],
      ),
    );
  }

  String _languageLabel(String lang) {
    switch (lang) {
      case 'ar': return 'العربية';
      case 'fr': return 'Français';
      default: return 'English';
    }
  }

  String _signInMethodLabel(AuthUser? user, AppLocalizations l10n) {
    switch (user?.authProvider) {
      case 'google':
        return l10n.get('sign_in_method_google');
      case 'facebook':
        return l10n.get('sign_in_method_facebook');
      case 'apple':
        return l10n.get('sign_in_method_apple');
      default:
        return l10n.get('sign_in_method_password');
    }
  }

  Widget _sectionHeader(BuildContext context, String title) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSizes.md, AppSizes.lg, AppSizes.md, AppSizes.xs),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _tile(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: theme.primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          ),
          child: Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
        ),
        title: Text(label, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w500)),
        trailing: trailing ?? Icon(Icons.chevron_right_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
        onTap: onTap,
      ),
    );
  }

  Widget _switchTile(
    BuildContext context, {
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: theme.primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          ),
          child: Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
        ),
        title: Text(label, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w500)),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeTrackColor: theme.primaryColor,
        ),
      ),
    );
  }

  void _showChangeEmailSheet(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final passCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: AppSizes.md,
          right: AppSizes.md,
          top: AppSizes.lg,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSizes.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.get('change_email'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
            const SizedBox(height: AppSizes.lg),
            _sheetField(context, AppStrings.currentPassword, passCtrl, obscure: true, icon: Icons.lock_outline_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(context, l10n.get('email'), emailCtrl, icon: Icons.email_outlined, type: TextInputType.emailAddress),
            const SizedBox(height: AppSizes.lg),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: ElevatedButton(
                onPressed: () async {
                  final auth = context.read<AuthProvider>();
                  final ok = await auth.changeEmail(currentPassword: passCtrl.text, newEmail: emailCtrl.text.trim());
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Email updated!' : 'Incorrect password.'),
                    backgroundColor: ok ? Colors.green : Colors.red,
                  ));
                  if (ok) {
                    context.read<TaskProvider>().loadTasks();
                  }
                },
                child: Text(l10n.get('save'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showChangePasswordSheet(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: AppSizes.md,
          right: AppSizes.md,
          top: AppSizes.lg,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSizes.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.get('change_password'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
            const SizedBox(height: AppSizes.lg),
            _sheetField(context, AppStrings.oldPassword, oldCtrl, obscure: true, icon: Icons.lock_outline_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(context, AppStrings.newPassword, newCtrl, obscure: true, icon: Icons.lock_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(context, AppStrings.confirmPassword, confirmCtrl, obscure: true, icon: Icons.lock_rounded),
            const SizedBox(height: AppSizes.lg),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: ElevatedButton(
                onPressed: () async {
                  if (newCtrl.text != confirmCtrl.text) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.get('passwords_do_not_match')), backgroundColor: Colors.red));
                    return;
                  }
                  final auth = context.read<AuthProvider>();
                  final ok = await auth.changePassword(oldPassword: oldCtrl.text, newPassword: newCtrl.text);
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Password updated!' : 'Incorrect old password.'),
                    backgroundColor: ok ? Colors.green : Colors.red,
                  ));
                },
                child: Text(l10n.get('save'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLanguageSheet(BuildContext context, String current) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final langs = [
      {'code': 'en', 'label': '🇬🇧 English'},
      {'code': 'ar', 'label': '🇸🇦 العربية'},
      {'code': 'fr', 'label': '🇫🇷 Français'},
    ];
    showModalBottomSheet(
      context: context,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppSizes.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.get('select_language'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
            const SizedBox(height: AppSizes.md),
            ...langs.map((l) => ListTile(
                  title: Text(l['label']!, style: AppTextStyles.bodyLarge.copyWith(color: theme.colorScheme.onSurface)),
                  trailing: l['code'] == current ? Icon(Icons.check_rounded, color: theme.primaryColor) : null,
                  onTap: () {
                    context.read<SettingsProvider>().setLanguage(l['code']!);
                    Navigator.pop(ctx);
                  },
                )),
          ],
        ),
      ),
    );
  }

  Widget _sheetField(BuildContext context, String label, TextEditingController ctrl, {bool obscure = false, TextInputType type = TextInputType.text, required IconData icon}) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
        const SizedBox(height: AppSizes.sm),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: type,
          style: GoogleFonts.poppins(fontSize: 14, color: theme.colorScheme.onSurface),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
            filled: true,
            fillColor: theme.colorScheme.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.primaryColor, width: 2)),
          ),
        ),
      ],
    );
  }
}
