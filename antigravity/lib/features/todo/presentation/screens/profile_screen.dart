import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/screens/settings_screen.dart';
import 'package:tasko/features/auth/presentation/screens/login_screen.dart';
import 'package:tasko/features/todo/presentation/screens/edit_profile_screen.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

class ProfileScreen extends StatelessWidget {
  final GlobalKey<ScaffoldState>? scaffoldKey;
  const ProfileScreen({super.key, this.scaffoldKey});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => scaffoldKey?.currentState?.openDrawer(),
        ),
        title: Text(l10n.get('profile'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              color: theme.colorScheme.surface,
              padding: const EdgeInsets.all(AppSizes.xl),
              child: Column(
                children: [
                  _TappableAvatar(auth: auth, l10n: l10n),
                  const SizedBox(height: AppSizes.md),
                  Text(
                    auth.name.isNotEmpty ? auth.name : l10n.get('hello_user'),
                    style: AppTextStyles.heading2.copyWith(color: theme.colorScheme.onSurface),
                  ),
                  const SizedBox(height: AppSizes.xs),
                  Text(
                    auth.email.isNotEmpty ? auth.email : '',
                    style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                  ),
                  const SizedBox(height: AppSizes.lg),
                  SizedBox(
                    width: 200,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: theme.primaryColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusFull)),
                      ),
                      child: Text(l10n.get('edit_profile'), style: AppTextStyles.labelLarge.copyWith(color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.md),
            Container(
              color: theme.colorScheme.surface,
              child: Column(
                children: [
                  if (auth.phone.isNotEmpty) _buildInfoTile(context, Icons.phone_outlined, l10n.get('phone'), auth.phone),
                  if (auth.country.isNotEmpty) _buildInfoTile(context, Icons.public_rounded, l10n.get('country'), auth.country),
                  if (auth.bio.isNotEmpty) _buildInfoTile(context, Icons.info_outline_rounded, l10n.get('bio'), auth.bio),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.md),
            Container(
              color: theme.colorScheme.surface,
              child: Column(
                children: [
                  _buildActionTile(
                    context,
                    icon: Icons.settings_outlined,
                    label: l10n.get('settings'),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  ),
                  Divider(height: 1, indent: AppSizes.xl + AppSizes.md, color: theme.dividerColor),
                  _buildActionTile(
                    context,
                    icon: Icons.logout_rounded,
                    label: l10n.get('logout'),
                    color: Colors.redAccent,
                    onTap: () => _confirmLogout(context, auth, l10n),
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

  Widget _buildInfoTile(BuildContext context, IconData icon, String label, String value) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: theme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
            child: Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
          ),
          const SizedBox(width: AppSizes.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
              Text(value, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(BuildContext context, {required IconData icon, required String label, required VoidCallback onTap, Color? color}) {
    final theme = Theme.of(context);
    return ListTile(
      leading: Icon(icon, color: color ?? theme.colorScheme.onSurface),
      title: Text(label, style: AppTextStyles.bodyMedium.copyWith(color: color ?? theme.colorScheme.onSurface, fontWeight: FontWeight.w500)),
      trailing: Icon(Icons.chevron_right_rounded, color: color ?? theme.colorScheme.onSurface.withValues(alpha: 0.5)),
      onTap: onTap,
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth, AppLocalizations l10n) {
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(l10n.get('logout'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        content: Text(l10n.get('logout'), style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l10n.get('cancel'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)))),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await auth.logout();
              if (context.mounted) {
                await context.read<TaskProvider>().loadTasks();
              }
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
              }
            },
            child: Text(l10n.get('logout'), style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _TappableAvatar extends StatelessWidget {
  final AuthProvider auth;
  final AppLocalizations l10n;
  const _TappableAvatar({required this.auth, required this.l10n});

  Future<void> _pickImage(BuildContext context, ImageSource source) async {
    Navigator.of(context).pop();
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: source, imageQuality: 80);
      if (picked == null) return;
      final maxMb = RemoteConfigService.avatarMaxSizeMbClientHint;
      final file = File(picked.path);
      final sizeMb = await file.length() / (1024 * 1024);
      if (sizeMb > maxMb) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                l10n.get('avatar_too_large').replaceFirst('{size}', '$maxMb'),
              ),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
        return;
      }
      if (context.mounted) {
        await context.read<AuthProvider>().uploadAvatar(file);
      }
    } catch (_) {}
  }

  void _showPickerSheet(BuildContext context) {
    final theme = Theme.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: theme.dividerColor, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: AppSizes.md),
              Text(l10n.get('profile_picture'), style: AppTextStyles.heading3.copyWith(color: theme.primaryColor)),
              const SizedBox(height: AppSizes.sm),
              Divider(color: theme.dividerColor),
              ListTile(
                leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: theme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)), child: Icon(Icons.camera_alt_rounded, color: theme.primaryColor)),
                title: Text('Camera', style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
                onTap: () => _pickImage(context, ImageSource.camera),
              ),
              ListTile(
                leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: theme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)), child: Icon(Icons.photo_library_rounded, color: theme.primaryColor)),
                title: Text('Gallery', style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
                onTap: () => _pickImage(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasImage = auth.profileImagePath.isNotEmpty;
    final initials = auth.name.isNotEmpty ? auth.name[0].toUpperCase() : '?';

    return GestureDetector(
      onTap: () => _showPickerSheet(context),
      child: Stack(
        children: [
          Container(
            width: 120, height: 120,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: theme.primaryColor, width: 3), color: theme.primaryColor.withValues(alpha: 0.1)),
            child: ClipOval(
              child: hasImage
                  ? Image.file(File(auth.profileImagePath), fit: BoxFit.cover, errorBuilder: (_, err, st) => _buildInitials(context, initials))
                  : _buildInitials(context, initials),
            ),
          ),
          Positioned(bottom: 4, right: 4, child: Container(width: 32, height: 32, decoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle), child: const Icon(Icons.camera_alt_rounded, size: 16, color: Colors.white))),
        ],
      ),
    );
  }

  Widget _buildInitials(BuildContext context, String initials) {
    final theme = Theme.of(context);
    return Center(child: Text(initials, style: GoogleFonts.poppins(fontSize: 44, fontWeight: FontWeight.w700, color: theme.primaryColor)));
  }
}
