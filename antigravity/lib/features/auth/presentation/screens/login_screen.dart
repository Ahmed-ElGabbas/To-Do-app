import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/colors.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/auth/presentation/screens/signup_screen.dart';
import 'package:tasko/features/todo/presentation/widgets/main_scaffold.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value, AppLocalizations l10n) {
    if (value == null || value.trim().isEmpty) return l10n.get('field_required');
    final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(value.trim())) return l10n.get('invalid_email');
    return null;
  }

  String? _validatePassword(String? value, AppLocalizations l10n) {
    if (value == null || value.isEmpty) return l10n.get('field_required');
    if (value.length < 6) return l10n.get('password_too_short');
    return null;
  }

  Future<void> _signIn() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    final success = await auth.login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainScaffold()),
        (route) => false,
      );
    } else {
      setState(() => _errorMessage = l10n.get('invalid_credentials'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.xl),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: AppSizes.xxl),
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: theme.primaryColor,
                    borderRadius: BorderRadius.circular(AppSizes.radiusXl),
                    boxShadow: [
                      BoxShadow(
                        color: theme.primaryColor.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.check_rounded, size: 44, color: Colors.white),
                ),
                const SizedBox(height: AppSizes.xl),
                Text(l10n.get('welcome_back'), style: AppTextStyles.heading1.copyWith(color: theme.colorScheme.onSurface)),
                const SizedBox(height: AppSizes.sm),
                Text(
                  l10n.get('sign_in_subtitle'),
                  style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                ),
                const SizedBox(height: AppSizes.xxl),
                _buildLabel(l10n.get('email'), theme),
                const SizedBox(height: AppSizes.sm),
                TextFormField(
                  controller: _emailController,
                  validator: (v) => _validateEmail(v, l10n),
                  keyboardType: TextInputType.emailAddress,
                  style: GoogleFonts.poppins(fontSize: 14, color: theme.colorScheme.onSurface),
                  decoration: _inputDecoration(theme: theme, hint: l10n.get('email_hint'), prefixIcon: Icons.email_outlined),
                ),
                const SizedBox(height: AppSizes.md),
                _buildLabel(l10n.get('password'), theme),
                const SizedBox(height: AppSizes.sm),
                TextFormField(
                  controller: _passwordController,
                  validator: (v) => _validatePassword(v, l10n),
                  obscureText: _obscurePassword,
                  style: GoogleFonts.poppins(fontSize: 14, color: theme.colorScheme.onSurface),
                  decoration: _inputDecoration(
                    theme: theme,
                    hint: l10n.get('password_hint'),
                    prefixIcon: Icons.lock_outline_rounded,
                    suffix: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: theme.primaryColor,
                        size: AppSizes.iconMd,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                ),
                const SizedBox(height: AppSizes.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    onTap: () {},
                    child: Text(
                      l10n.get('forgot_password'),
                      style: AppTextStyles.bodySmall.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: AppSizes.xl),
                if (_errorMessage != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSizes.md),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: AppTextStyles.bodySmall.copyWith(color: Colors.redAccent, fontWeight: FontWeight.w500),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: AppSizes.md),
                ],
                SizedBox(
                  width: double.infinity,
                  height: AppSizes.buttonHeight,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _signIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.buttonRadius)),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                        : Text(l10n.get('sign_in'), style: AppTextStyles.button),
                  ),
                ),
                const SizedBox(height: AppSizes.xl),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(l10n.get('no_account'), style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignupScreen())),
                      child: Text(
                        l10n.get('sign_up'),
                        style: AppTextStyles.bodySmall.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w700),
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

  Widget _buildLabel(String label, ThemeData theme) {
    return Align(alignment: Alignment.centerLeft, child: Text(label, style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)));
  }

  InputDecoration _inputDecoration({required ThemeData theme, required String hint, required IconData prefixIcon, Widget? suffix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.poppins(color: theme.colorScheme.onSurface.withValues(alpha: 0.4), fontSize: 14),
      filled: true,
      fillColor: theme.colorScheme.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.md),
      prefixIcon: Icon(prefixIcon, color: theme.primaryColor, size: AppSizes.iconMd),
      suffixIcon: suffix,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.primaryColor, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: Colors.redAccent)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: Colors.redAccent, width: 2)),
    );
  }
}
