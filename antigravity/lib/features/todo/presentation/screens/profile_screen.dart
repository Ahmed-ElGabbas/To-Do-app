import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/features/auth/state/auth_provider.dart';
import 'package:antigravity/features/todo/presentation/screens/settings_screen.dart';
import 'package:antigravity/features/auth/presentation/screens/login_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(AppStrings.profile, style: AppTextStyles.heading3),
        centerTitle: false,
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header card
            Container(
              width: double.infinity,
              color: AppColors.background,
              padding: const EdgeInsets.all(AppSizes.xl),
              child: Column(
                children: [
                  // Avatar
                  _buildAvatar(auth),
                  const SizedBox(height: AppSizes.md),
                  // Name
                  Text(
                    auth.name.isNotEmpty ? auth.name : 'Guest',
                    style: AppTextStyles.heading2,
                  ),
                  const SizedBox(height: AppSizes.xs),
                  // Email
                  Text(
                    auth.email.isNotEmpty ? auth.email : 'No email set',
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSizes.lg),
                  // Edit Profile button
                  SizedBox(
                    width: 200,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                        ),
                      ),
                      child: Text(AppStrings.editProfile, style: AppTextStyles.labelLarge.copyWith(color: AppColors.white)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSizes.md),

            // Info cards
            Container(
              color: AppColors.background,
              child: Column(
                children: [
                  if (auth.phone.isNotEmpty)
                    _buildInfoTile(Icons.phone_outlined, 'Phone', auth.phone),
                  if (auth.country.isNotEmpty)
                    _buildInfoTile(Icons.public_rounded, 'Country', auth.country),
                  if (auth.bio.isNotEmpty)
                    _buildInfoTile(Icons.info_outline_rounded, 'Bio', auth.bio),
                ],
              ),
            ),

            const SizedBox(height: AppSizes.md),

            // Settings & Logout
            Container(
              color: AppColors.background,
              child: Column(
                children: [
                  _buildActionTile(
                    context,
                    icon: Icons.settings_outlined,
                    label: AppStrings.settings,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    ),
                  ),
                  const Divider(height: 1, indent: AppSizes.xl + AppSizes.md, color: AppColors.border),
                  _buildActionTile(
                    context,
                    icon: Icons.logout_rounded,
                    label: AppStrings.logout,
                    color: AppColors.error,
                    onTap: () => _confirmLogout(context, auth),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSizes.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar(AuthProvider auth) {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.primary, width: 3),
        color: AppColors.primary.withValues(alpha: 0.1),
      ),
      child: ClipOval(
        child: auth.name.isNotEmpty
            ? Center(
                child: Text(
                  auth.name[0].toUpperCase(),
                  style: GoogleFonts.poppins(
                    fontSize: 40,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              )
            : const Icon(Icons.person_rounded, size: 56, color: AppColors.textSecondary),
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSizes.radiusSm),
            ),
            child: Icon(icon, color: AppColors.primary, size: AppSizes.iconMd),
          ),
          const SizedBox(width: AppSizes.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTextStyles.caption),
              Text(value, style: AppTextStyles.bodyMedium),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return ListTile(
      leading: Icon(icon, color: color ?? AppColors.textPrimary),
      title: Text(
        label,
        style: AppTextStyles.bodyMedium.copyWith(
          color: color ?? AppColors.textPrimary,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: Icon(Icons.chevron_right_rounded, color: color ?? AppColors.textSecondary),
      onTap: onTap,
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(AppStrings.logoutConfirmTitle, style: AppTextStyles.heading3),
        content: Text(AppStrings.logoutConfirmMessage, style: AppTextStyles.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(AppStrings.cancel, style: AppTextStyles.labelLarge.copyWith(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await auth.logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (_) => false,
                );
              }
            },
            child: Text(AppStrings.logout, style: AppTextStyles.labelLarge.copyWith(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}
