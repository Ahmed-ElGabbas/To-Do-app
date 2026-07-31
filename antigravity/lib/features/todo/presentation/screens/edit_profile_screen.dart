import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _countryController;
  late TextEditingController _bioController;
  String? _profileImagePath;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _nameController = TextEditingController(text: auth.name);
    _phoneController = TextEditingController(text: auth.phone);
    _countryController = TextEditingController(text: auth.country);
    _bioController = TextEditingController(text: auth.bio);
    _profileImagePath = auth.profileImagePath.isNotEmpty ? auth.profileImagePath : null;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked != null) setState(() => _profileImagePath = picked.path);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _isLoading = true);
    await context.read<AuthProvider>().updateProfile(
          name: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          country: _countryController.text.trim(),
          bio: _bioController.text.trim(),
          profileImagePath: _profileImagePath ?? '',
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.scaffoldBackgroundColor,
        elevation: 0,
        title: Text(AppStrings.editProfile, style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _save,
            child: Text(AppStrings.save, style: AppTextStyles.labelLarge.copyWith(color: theme.primaryColor)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const SizedBox(height: AppSizes.md),
              // Avatar picker
              GestureDetector(
                onTap: _pickImage,
                child: Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: theme.primaryColor, width: 3),
                        color: theme.colorScheme.surface,
                      ),
                      child: ClipOval(
                        child: _profileImagePath != null && File(_profileImagePath!).existsSync()
                            ? Image.file(File(_profileImagePath!), fit: BoxFit.cover)
                            : Center(
                                child: Text(
                                  _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'U',
                                  style: GoogleFonts.poppins(fontSize: 36, fontWeight: FontWeight.w700, color: theme.primaryColor),
                                ),
                              ),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
                      child: const Icon(Icons.camera_alt_rounded, size: 16, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSizes.xl),
              _buildField(theme, AppStrings.fullName, AppStrings.fullNameHint, _nameController, Icons.person_outline_rounded,
                  validator: (v) => (v == null || v.trim().isEmpty) ? AppStrings.fieldRequired : null),
              const SizedBox(height: AppSizes.md),
              _buildField(theme, AppStrings.phoneNumber, AppStrings.phoneHint, _phoneController, Icons.phone_outlined,
                  keyboardType: TextInputType.phone),
              const SizedBox(height: AppSizes.md),
              _buildField(theme, AppStrings.country, AppStrings.countryHint, _countryController, Icons.public_rounded),
              const SizedBox(height: AppSizes.md),
              _buildField(theme, AppStrings.bio, AppStrings.bioHint, _bioController, Icons.info_outline_rounded, maxLines: 3),
              const SizedBox(height: AppSizes.xxl),
              SizedBox(
                width: double.infinity,
                height: AppSizes.buttonHeight,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: theme.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.buttonRadius)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : Text(AppStrings.save, style: AppTextStyles.button),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(ThemeData theme, String label, String hint, TextEditingController controller, IconData icon,
      {String? Function(String?)? validator, TextInputType keyboardType = TextInputType.text, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
        const SizedBox(height: AppSizes.sm),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          maxLines: maxLines,
          style: GoogleFonts.poppins(fontSize: 14, color: theme.colorScheme.onSurface),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.poppins(color: theme.colorScheme.onSurface.withValues(alpha: 0.4), fontSize: 14),
            prefixIcon: Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
            filled: true,
            fillColor: theme.colorScheme.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.md),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.primaryColor, width: 2)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: Colors.redAccent)),
          ),
        ),
      ],
    );
  }
}
