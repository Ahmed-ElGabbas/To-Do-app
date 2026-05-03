import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/features/auth/state/auth_provider.dart';
import 'package:antigravity/features/todo/presentation/state/settings_provider.dart';
import 'package:antigravity/shared/services/email_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(AppStrings.settings, style: AppTextStyles.heading3),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        children: [
          // ── Account ──────────────────────────────────────────────────
          _sectionHeader(AppStrings.accountSettings),
          _tile(
            icon: Icons.email_outlined,
            label: AppStrings.changeEmail,
            onTap: () => _showChangeEmailSheet(context),
          ),
          const Divider(height: 1, indent: 72, color: AppColors.border),
          _tile(
            icon: Icons.lock_outline_rounded,
            label: AppStrings.changePassword,
            onTap: () => _showChangePasswordSheet(context),
          ),

          // ── Notifications ────────────────────────────────────────────
          _sectionHeader(AppStrings.notifications),
          _switchTile(
            icon: Icons.notifications_outlined,
            label: AppStrings.pushNotifications,
            value: settings.notificationsEnabled,
            onChanged: (_) => context.read<SettingsProvider>().toggleNotifications(),
          ),

          // ── Appearance ───────────────────────────────────────────────
          _sectionHeader(AppStrings.appearance),
          _switchTile(
            icon: Icons.dark_mode_outlined,
            label: AppStrings.darkMode,
            value: settings.isDarkMode,
            onChanged: (_) => context.read<SettingsProvider>().toggleDarkMode(),
          ),
          const Divider(height: 1, indent: 72, color: AppColors.border),
          _tile(
            icon: Icons.language_outlined,
            label: AppStrings.language,
            trailing: Text(
              _languageLabel(settings.language),
              style: AppTextStyles.bodySmall.copyWith(color: AppColors.primary),
            ),
            onTap: () => _showLanguageSheet(context, settings.language),
          ),

          // ── Contact ──────────────────────────────────────────────────
          _sectionHeader(AppStrings.contactUs),
          _tile(
            icon: Icons.mail_outline_rounded,
            label: AppStrings.contactUs,
            onTap: () async => EmailService.contactUs(),
          ),

          const SizedBox(height: AppSizes.xxl),
        ],
      ),
    );
  }

  String _languageLabel(String lang) {
    switch (lang) {
      case 'ar':
        return 'العربية';
      case 'fr':
        return 'Français';
      default:
        return 'English';
    }
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSizes.md, AppSizes.lg, AppSizes.md, AppSizes.xs),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return Container(
      color: AppColors.background,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          ),
          child: Icon(icon, color: AppColors.primary, size: AppSizes.iconMd),
        ),
        title: Text(label, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w500)),
        trailing: trailing ?? const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
        onTap: onTap,
      ),
    );
  }

  Widget _switchTile({
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      color: AppColors.background,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          ),
          child: Icon(icon, color: AppColors.primary, size: AppSizes.iconMd),
        ),
        title: Text(label, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w500)),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: AppColors.primary,
          activeTrackColor: AppColors.primary.withValues(alpha: 0.4),
        ),
      ),
    );
  }

  // ── Change Email Sheet ───────────────────────────────────────────────
  void _showChangeEmailSheet(BuildContext context) {
    final passCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
      ),
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
            Text(AppStrings.changeEmail, style: AppTextStyles.heading3),
            const SizedBox(height: AppSizes.lg),
            _sheetField(AppStrings.currentPassword, passCtrl, obscure: true, icon: Icons.lock_outline_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(AppStrings.newEmail, emailCtrl, icon: Icons.email_outlined, type: TextInputType.emailAddress),
            const SizedBox(height: AppSizes.lg),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: ElevatedButton(
                onPressed: () async {
                  final auth = context.read<AuthProvider>();
                  final ok = await auth.changeEmail(
                    currentPassword: passCtrl.text,
                    newEmail: emailCtrl.text.trim(),
                  );
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Email updated!' : 'Incorrect password.'),
                    backgroundColor: ok ? AppColors.success : AppColors.error,
                  ));
                },
                child: Text(AppStrings.save, style: AppTextStyles.button),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Change Password Sheet ────────────────────────────────────────────
  void _showChangePasswordSheet(BuildContext context) {
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
      ),
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
            Text(AppStrings.changePassword, style: AppTextStyles.heading3),
            const SizedBox(height: AppSizes.lg),
            _sheetField(AppStrings.oldPassword, oldCtrl, obscure: true, icon: Icons.lock_outline_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(AppStrings.newPassword, newCtrl, obscure: true, icon: Icons.lock_rounded),
            const SizedBox(height: AppSizes.md),
            _sheetField(AppStrings.confirmPassword, confirmCtrl, obscure: true, icon: Icons.lock_rounded),
            const SizedBox(height: AppSizes.lg),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: ElevatedButton(
                onPressed: () async {
                  if (newCtrl.text != confirmCtrl.text) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(AppStrings.passwordsDoNotMatch), backgroundColor: AppColors.error),
                    );
                    return;
                  }
                  final auth = context.read<AuthProvider>();
                  final ok = await auth.changePassword(oldPassword: oldCtrl.text, newPassword: newCtrl.text);
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Password updated!' : 'Incorrect old password.'),
                    backgroundColor: ok ? AppColors.success : AppColors.error,
                  ));
                },
                child: Text(AppStrings.save, style: AppTextStyles.button),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Language Sheet ───────────────────────────────────────────────────
  void _showLanguageSheet(BuildContext context, String current) {
    final langs = [
      {'code': 'en', 'label': '🇬🇧 English'},
      {'code': 'ar', 'label': '🇸🇦 العربية'},
      {'code': 'fr', 'label': '🇫🇷 Français'},
    ];
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppSizes.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(AppStrings.language, style: AppTextStyles.heading3),
            const SizedBox(height: AppSizes.md),
            ...langs.map((l) => ListTile(
                  title: Text(l['label']!, style: AppTextStyles.bodyLarge),
                  trailing: l['code'] == current
                      ? const Icon(Icons.check_rounded, color: AppColors.primary)
                      : null,
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

  Widget _sheetField(
    String label,
    TextEditingController ctrl, {
    bool obscure = false,
    TextInputType type = TextInputType.text,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.labelLarge),
        const SizedBox(height: AppSizes.sm),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: type,
          style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppColors.primary, size: AppSizes.iconMd),
            filled: true,
            fillColor: AppColors.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.md),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
          ),
        ),
      ],
    );
  }
}
