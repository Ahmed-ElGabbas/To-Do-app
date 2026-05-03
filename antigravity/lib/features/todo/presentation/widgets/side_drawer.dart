import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/features/auth/state/auth_provider.dart';
import 'package:antigravity/features/todo/presentation/state/task_provider.dart';
import 'package:antigravity/shared/services/email_service.dart';
import 'package:antigravity/features/todo/presentation/screens/settings_screen.dart';

class SideDrawer extends StatelessWidget {
  final void Function(int) onNavigate;

  const SideDrawer({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Drawer(
      backgroundColor: AppColors.drawerBg,
      width: MediaQuery.of(context).size.width * 0.78,
      child: SafeArea(
        child: Column(
          children: [
            _buildHeader(auth),
            const Divider(color: Color(0xFF2A2A3F), thickness: 1, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
                children: [
                  _buildSectionLabel(AppStrings.mainMenu),
                  _buildMenuItem(
                    context,
                    icon: Icons.home_rounded,
                    label: AppStrings.home,
                    onTap: () {
                      Navigator.of(context).pop();
                      onNavigate(0);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.checklist_rounded,
                    label: AppStrings.taskLists,
                    onTap: () {
                      Navigator.of(context).pop();
                      onNavigate(1);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.delete_sweep_rounded,
                    label: AppStrings.removeTasks,
                    onTap: () => _confirmDeleteAll(context),
                  ),
                  const SizedBox(height: AppSizes.md),
                  _buildSectionLabel(AppStrings.actions),
                  _buildMenuItem(
                    context,
                    icon: Icons.feedback_outlined,
                    label: AppStrings.sendFeedback,
                    onTap: () async {
                      Navigator.of(context).pop();
                      await EmailService.sendFeedback();
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.people_outline_rounded,
                    label: AppStrings.followUs,
                    onTap: () {
                      Navigator.of(context).pop();
                      _showFollowUsSheet(context);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.share_outlined,
                    label: AppStrings.inviteFriends,
                    onTap: () {
                      Navigator.of(context).pop();
                      Share.share(AppStrings.inviteMessage);
                    },
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.settings_outlined,
                    label: AppStrings.settings,
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

  Widget _buildHeader(AuthProvider auth) {
    return Padding(
      padding: const EdgeInsets.all(AppSizes.lg),
      child: Row(
        children: [
          // Profile picture
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.primary, width: 2),
              color: AppColors.primary.withValues(alpha: 0.2),
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
                        auth.name.isNotEmpty
                            ? auth.name[0].toUpperCase()
                            : 'U',
                        style: GoogleFonts.poppins(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
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
                    color: AppColors.drawerText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  auth.email.isNotEmpty ? auth.email : 'No email',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: AppColors.drawerSubtext,
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

  Widget _buildSectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.md,
        AppSizes.sm,
        AppSizes.md,
        AppSizes.xs,
      ),
      child: Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.drawerSubtext,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.white.withValues(alpha: 0.08),
        highlightColor: AppColors.white.withValues(alpha: 0.05),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSizes.md,
            vertical: AppSizes.sm + 2,
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppSizes.radiusSm),
                ),
                child: Icon(icon, color: AppColors.primary, size: AppSizes.iconMd),
              ),
              const SizedBox(width: AppSizes.md),
              Text(
                label,
                style: GoogleFonts.poppins(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: AppColors.drawerText,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeleteAll(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        ),
        title: Text(AppStrings.deleteAllTitle, style: AppTextStyles.heading3),
        content: Text(AppStrings.deleteAllMessage, style: AppTextStyles.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              AppStrings.cancel,
              style: AppTextStyles.labelLarge.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              final tasks =
                  ctx.read<TaskProvider>().tasks.map((t) => t.id).toList();
              for (final id in tasks) {
                ctx.read<TaskProvider>().deleteTask(id);
              }
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: Text(
              AppStrings.delete,
              style: AppTextStyles.labelLarge.copyWith(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }

  void _showFollowUsSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppSizes.radiusXl),
        ),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppSizes.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppStrings.followUs,
              style: AppTextStyles.heading3.copyWith(color: AppColors.primary),
            ),
            const SizedBox(height: AppSizes.sm),
            const Divider(color: AppColors.border),
            const SizedBox(height: AppSizes.sm),
            _buildSocialRow(
              ctx,
              icon: Icons.facebook_rounded,
              iconColor: const Color(0xFF1877F2),
              label: AppStrings.facebook,
              url: 'https://www.facebook.com/share/1BHmoqjc5b/',
            ),
            const Divider(color: AppColors.border),
            _buildSocialRow(
              ctx,
              icon: Icons.camera_alt_rounded,
              iconColor: const Color(0xFFE1306C),
              label: AppStrings.instagram,
              url: 'https://www.instagram.com/elg.abbas?igsh=NWlvYzliNjdsb3Nz',
            ),
            const Divider(color: AppColors.border),
            _buildSocialRow(
              ctx,
              icon: Icons.alternate_email_rounded,
              iconColor: AppColors.black,
              label: AppStrings.twitter,
              url: 'https://x.com/A7med_ElGabbas',
            ),
            const SizedBox(height: AppSizes.md),
          ],
        ),
      ),
    );
  }

  Widget _buildSocialRow(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String label,
    required String url,
  }) {
    return InkWell(
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 28),
            const SizedBox(width: AppSizes.md),
            Expanded(
              child: Text(
                label,
                style: AppTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
