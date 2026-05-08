import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/shared/services/email_service.dart';
import 'package:tasko/features/todo/presentation/screens/settings_screen.dart';

class SideDrawer extends StatelessWidget {
  final void Function(int) onNavigate;

  const SideDrawer({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<SettingsProvider>();
    final l10n = AppLocalizations.of(context);
    final isDark = settings.isDarkMode;

    final drawerColor = isDark ? const Color(0xFFFF9F00) : const Color(0xFF12121F);
    final contentColor = Colors.white;

    return Drawer(
      backgroundColor: drawerColor,
      width: MediaQuery.of(context).size.width * 0.78,
      child: SafeArea(
        child: Column(
          children: [
            _buildHeader(auth, contentColor),
            Divider(color: contentColor.withValues(alpha: 0.2), thickness: 1, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
                children: [
                  _buildSectionLabel(l10n.get('main_menu'), contentColor),
                  _buildMenuItem(
                    context,
                    icon: Icons.home_rounded,
                    label: l10n.get('home'),
                    color: contentColor,
                    onTap: () {
                      Navigator.of(context).pop();
                      onNavigate(0);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.checklist_rounded,
                    label: l10n.get('task_lists'),
                    color: contentColor,
                    onTap: () {
                      Navigator.of(context).pop();
                      onNavigate(1);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.delete_sweep_rounded,
                    label: l10n.get('remove_tasks'),
                    color: contentColor,
                    onTap: () => _confirmDeleteAll(context),
                  ),
                  const SizedBox(height: AppSizes.md),
                  _buildSectionLabel(l10n.get('actions'), contentColor),
                  _buildMenuItem(
                    context,
                    icon: Icons.feedback_outlined,
                    label: l10n.get('send_feedback'),
                    color: contentColor,
                    onTap: () async {
                      Navigator.of(context).pop();
                      await EmailService.sendFeedback();
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.people_outline_rounded,
                    label: l10n.get('follow_us'),
                    color: contentColor,
                    onTap: () {
                      Navigator.of(context).pop();
                      _showFollowUsSheet(context);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.share_outlined,
                    label: l10n.get('invite_friends'),
                    color: contentColor,
                    onTap: () {
                      Navigator.of(context).pop();
                      Share.share(AppStrings.inviteMessage);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.settings_outlined,
                    label: l10n.get('settings'),
                    color: contentColor,
                    onTap: () {
                      Navigator.of(context).pop();
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const SettingsScreen(),
                      ));
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(AuthProvider auth, Color color) {
    return Padding(
      padding: const EdgeInsets.all(AppSizes.lg),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 2),
              color: color.withValues(alpha: 0.1),
            ),
            child: ClipOval(
              child: auth.profileImagePath.isNotEmpty &&
                      File(auth.profileImagePath).existsSync()
                  ? Image.file(
                      File(auth.profileImagePath),
                      fit: BoxFit.cover,
                    )
                  : Center(
                      child: Text(
                        auth.name.isNotEmpty ? auth.name[0].toUpperCase() : 'U',
                        style: GoogleFonts.poppins(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: AppSizes.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  auth.name.isNotEmpty ? auth.name : 'Guest',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  auth.email.isNotEmpty ? auth.email : 'No email',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: color.withValues(alpha: 0.7),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label, Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSizes.md, AppSizes.sm, AppSizes.md, AppSizes.xs),
      child: Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color.withValues(alpha: 0.7),
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm + 2),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppSizes.radiusSm),
                ),
                child: Icon(icon, color: color, size: AppSizes.iconMd),
              ),
              const SizedBox(width: AppSizes.md),
              Text(
                label,
                style: GoogleFonts.poppins(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeleteAll(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(l10n.get('delete_all'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        content: Text(l10n.get('delete_all'), style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.get('cancel'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          TextButton(
            onPressed: () {
              ctx.read<TaskProvider>().clearAll();
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: Text(l10n.get('delete'), style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showFollowUsSheet(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
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
            Text(l10n.get('follow_us'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
            const Divider(),
            _buildSocialRow(ctx, icon: Icons.facebook_rounded, label: AppStrings.facebook, url: 'https://www.facebook.com/share/1BHmoqjc5b/'),
            _buildSocialRow(ctx, icon: Icons.camera_alt_rounded, label: AppStrings.instagram, url: 'https://www.instagram.com/elg.abbas?igsh=NWlvYzliNjdsb3Nz'),
            _buildSocialRow(ctx, icon: Icons.alternate_email_rounded, label: AppStrings.twitter, url: 'https://x.com/A7med_ElGabbas'),
          ],
        ),
      ),
    );
  }

  Widget _buildSocialRow(BuildContext context, {required IconData icon, required String label, required String url}) {
    final theme = Theme.of(context);
    return ListTile(
      leading: Icon(icon, color: theme.colorScheme.onSurface),
      title: Text(label, style: AppTextStyles.bodyLarge.copyWith(color: theme.colorScheme.onSurface)),
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
      },
    );
  }
}
