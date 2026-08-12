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
import 'package:tasko/features/auth/presentation/widgets/google_sign_in_button.dart';
import 'package:tasko/features/auth/presentation/widgets/facebook_sign_in_button.dart';
import 'package:tasko/features/auth/presentation/widgets/social_link_confirmation_dialog.dart';
import 'package:tasko/features/auth/services/google_sign_in_service.dart';
import 'package:tasko/features/auth/services/facebook_sign_in_service.dart';
import 'package:tasko/features/todo/presentation/widgets/main_scaffold.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _countryController = TextEditingController();
  final _bioController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _profileImagePath;
  String? _errorMessage;
  final _googleSignIn = GoogleSignInService();
  final _facebookSignIn = FacebookSignInService();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (picked != null) setState(() => _profileImagePath = picked.path);
  }

  String? _validateRequired(String? value, AppLocalizations l10n) {
    if (value == null || value.trim().isEmpty) {
      return l10n.get('field_required');
    }
    return null;
  }

  String? _validateEmail(String? value, AppLocalizations l10n) {
    if (value == null || value.trim().isEmpty) {
      return l10n.get('field_required');
    }
    final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(value.trim())) {
      return l10n.get('invalid_email');
    }
    return null;
  }

  String? _validatePassword(String? value, AppLocalizations l10n) {
    if (value == null || value.isEmpty) {
      return l10n.get('field_required');
    }
    if (value.length < 6) {
      return l10n.get('password_too_short');
    }
    return null;
  }

  Future<void> _createAccount() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) {
      return;
    }
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = context.read<AuthProvider>();
    final taskProvider = context.read<TaskProvider>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final l10n = AppLocalizations.of(context);
    final success = await auth.signUp(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
      phone: _phoneController.text.trim(),
      country: _countryController.text.trim(),
      bio: _bioController.text.trim(),
      profileImagePath: _profileImagePath ?? '',
    );

    if (!mounted) return;
    setState(() => _isLoading = false);
    if (!success) {
      setState(() => _errorMessage = auth.errorMessage ?? l10n.get('signup_failed'));
      return;
    }

    await taskProvider.loadTasks();
    if (!mounted) return;
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Account created successfully!'),
        backgroundColor: Colors.green,
      ),
    );
    navigator.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const MainScaffold()),
      (_) => false,
    );
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    try {
      final idToken = await _googleSignIn.getFirebaseIdToken();
      if (!mounted) return;
      final success = await auth.socialLogin(
        idToken: idToken,
        provider: 'google',
      );
      if (!mounted) return;
      setState(() => _isLoading = false);
      if (success) {
        await context.read<TaskProvider>().loadTasks();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainScaffold()),
          (_) => false,
        );
      } else {
        setState(
          () => _errorMessage = auth.errorMessage ?? l10n.get('google_sign_in_failed'),
        );
      }
    } on GoogleSignInCancelledException {
      if (!mounted) return;
      setState(() => _isLoading = false);
    } on Exception {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = l10n.get('google_sign_in_failed');
      });
    }
  }

  Future<void> _signInWithFacebook() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    try {
      final idToken = await _facebookSignIn.getFirebaseIdToken();
      if (!mounted) return;
      final success = await auth.socialLogin(
        idToken: idToken,
        provider: 'facebook',
      );
      if (!mounted) return;
      setState(() => _isLoading = false);
      if (success) {
        await context.read<TaskProvider>().loadTasks();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainScaffold()),
          (_) => false,
        );
        return;
      }
      if (auth.pendingSocialLinkConfirmation != null) {
        final linked = await showSocialLinkConfirmation(context);
        if (linked == true && mounted) {
          await context.read<TaskProvider>().loadTasks();
          if (!mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const MainScaffold()),
            (_) => false,
          );
        }
        return;
      }
      setState(
        () => _errorMessage = auth.errorMessage ?? l10n.get('facebook_sign_in_failed'),
      );
    } on FacebookSignInCancelledException {
      if (!mounted) return;
      setState(() => _isLoading = false);
    } on Exception {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = l10n.get('facebook_sign_in_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.scaffoldBackgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_rounded,
            color: theme.colorScheme.onSurface,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.xl),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: AppSizes.md),
                GestureDetector(
                  onTap: _pickImage,
                  child: Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      Container(
                        width: 110,
                        height: 110,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: theme.primaryColor,
                            width: 3,
                          ),
                          color: theme.colorScheme.surface,
                        ),
                        child: ClipOval(
                          child: _profileImagePath != null
                              ? Image.file(
                                  File(_profileImagePath!),
                                  fit: BoxFit.cover,
                                )
                              : Icon(
                                  Icons.person_rounded,
                                  size: 60,
                                  color: theme.colorScheme.onSurface.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                        ),
                      ),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: theme.primaryColor,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSizes.sm),
                Text(
                  l10n.get('tap_to_change'),
                  style: AppTextStyles.caption.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: AppSizes.xl),
                Text(
                  l10n.get('sign_up'),
                  style: AppTextStyles.heading2.copyWith(
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: AppSizes.xxl),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('full_name'),
                  hint: l10n.get('full_name'),
                  controller: _nameController,
                  icon: Icons.person_outline_rounded,
                  validator: (v) => _validateRequired(v, l10n),
                ),
                const SizedBox(height: AppSizes.md),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('email'),
                  hint: l10n.get('email_hint'),
                  controller: _emailController,
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => _validateEmail(v, l10n),
                ),
                const SizedBox(height: AppSizes.md),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('password'),
                  hint: l10n.get('password_hint'),
                  controller: _passwordController,
                  icon: Icons.lock_outline_rounded,
                  obscureText: _obscurePassword,
                  validator: (v) => _validatePassword(v, l10n),
                  suffix: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: theme.primaryColor,
                      size: AppSizes.iconMd,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
                const SizedBox(height: AppSizes.md),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('phone'),
                  hint: l10n.get('phone'),
                  controller: _phoneController,
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: AppSizes.md),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('country'),
                  hint: l10n.get('country'),
                  controller: _countryController,
                  icon: Icons.public_rounded,
                ),
                const SizedBox(height: AppSizes.md),
                _buildField(
                  theme: theme,
                  l10n: l10n,
                  label: l10n.get('bio'),
                  hint: l10n.get('bio'),
                  controller: _bioController,
                  icon: Icons.info_outline_rounded,
                  maxLines: 3,
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: AppSizes.md),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSizes.md),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: Colors.redAccent,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
                const SizedBox(height: AppSizes.xxl),
                SizedBox(
                  width: double.infinity,
                  height: AppSizes.buttonHeight,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _createAccount,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          AppSizes.buttonRadius,
                        ),
                      ),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            l10n.get('sign_up'),
                            style: AppTextStyles.button,
                          ),
                  ),
                ),
                const SizedBox(height: AppSizes.xl),
                Row(
                  children: [
                    Expanded(child: Divider(color: theme.dividerColor)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm),
                      child: Text(
                        l10n.get('or'),
                        style: AppTextStyles.bodySmall.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: theme.dividerColor)),
                  ],
                ),
                const SizedBox(height: AppSizes.xl),
                GoogleSignInButton(
                  onPressed: _signInWithGoogle,
                  isLoading: _isLoading,
                ),
                const SizedBox(height: AppSizes.md),
                FacebookSignInButton(
                  onPressed: _signInWithFacebook,
                  isLoading: _isLoading,
                ),
                const SizedBox(height: AppSizes.xl),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      l10n.get('have_account'),
                      style: AppTextStyles.bodySmall.copyWith(
                        color: theme.colorScheme.onSurface.withValues(
                          alpha: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Text(
                        l10n.get('login'),
                        style: AppTextStyles.bodySmall.copyWith(
                          color: theme.primaryColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSizes.xl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required ThemeData theme,
    required AppLocalizations l10n,
    required String label,
    required String hint,
    required TextEditingController controller,
    required IconData icon,
    String? Function(String?)? validator,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
    Widget? suffix,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.labelLarge.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          obscureText: obscureText,
          maxLines: maxLines,
          style: GoogleFonts.poppins(
            fontSize: 14,
            color: theme.colorScheme.onSurface,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.poppins(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
              fontSize: 14,
            ),
            filled: true,
            fillColor: theme.colorScheme.surface,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSizes.md,
              vertical: AppSizes.md,
            ),
            prefixIcon: Icon(
              icon,
              color: theme.primaryColor,
              size: AppSizes.iconMd,
            ),
            suffixIcon: suffix,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              borderSide: BorderSide(color: theme.dividerColor),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              borderSide: BorderSide(color: theme.dividerColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              borderSide: BorderSide(color: theme.primaryColor, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              borderSide: const BorderSide(color: Colors.redAccent),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              borderSide: const BorderSide(color: Colors.redAccent, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
