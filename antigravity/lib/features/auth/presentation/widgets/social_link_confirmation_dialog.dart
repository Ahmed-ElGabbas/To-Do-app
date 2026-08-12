import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';

/// Drives the Decision 4 confirmation a user must complete before a Facebook
/// sign-in can be linked to an existing account.
///
/// Returns `true` when the flow finished with a fresh session (password path);
/// returns `false` when the user cancels or only an email confirmation was
/// requested (they must open the emailed link and tap "Continue with Facebook"
/// again to finish).
Future<bool> showSocialLinkConfirmation(BuildContext context) async {
  final auth = context.read<AuthProvider>();
  final pending = auth.pendingSocialLinkConfirmation;
  if (pending == null) return false;
  if (pending.hasPassword) {
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (_) => const _PasswordLinkDialog(),
        ) ??
        false;
  }
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const _EmailLinkDialog(),
  );
  return false;
}

/// Password path: proves ownership of the existing password account.
class _PasswordLinkDialog extends StatefulWidget {
  const _PasswordLinkDialog();

  @override
  State<_PasswordLinkDialog> createState() => _PasswordLinkDialogState();
}

class _PasswordLinkDialogState extends State<_PasswordLinkDialog> {
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    final success =
        await auth.confirmSocialLinkPassword(password: _passwordController.text);
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage =
            auth.errorMessage ?? l10n.get('facebook_sign_in_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final pending = context.watch<AuthProvider>().pendingSocialLinkConfirmation;

    return AlertDialog(
      backgroundColor: theme.colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      title: Text(
        l10n.get('link_account_title'),
        style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.get('link_account_password_message'),
              style: AppTextStyles.bodySmall.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
            if (pending != null && pending.email.isNotEmpty) ...[
              const SizedBox(height: AppSizes.sm),
              Text(
                pending.email,
                style: AppTextStyles.bodySmall.copyWith(
                  color: theme.primaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: AppSizes.md),
            TextField(
              controller: _passwordController,
              obscureText: true,
              enabled: !_isLoading,
              onSubmitted: (_) => _submit(),
              style: AppTextStyles.bodyMedium.copyWith(
                color: theme.colorScheme.onSurface,
              ),
              decoration: InputDecoration(
                hintText: l10n.get('password'),
                hintStyle: AppTextStyles.bodySmall.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
                filled: true,
                fillColor: theme.colorScheme.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                  borderSide: BorderSide(color: theme.dividerColor),
                ),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSizes.md),
              Text(
                _errorMessage!,
                style: AppTextStyles.bodySmall.copyWith(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isLoading
              ? null
              : () => Navigator.of(context).pop(false),
          child: Text(
            l10n.get('cancel'),
            style: AppTextStyles.labelLarge.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: theme.primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSizes.buttonRadius),
            ),
            elevation: 0,
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  l10n.get('link_account_confirm'),
                  style: AppTextStyles.labelLarge.copyWith(color: Colors.white),
                ),
        ),
      ],
    );
  }
}

/// Email path: sends a one-time confirmation link to the passwordless account
/// owner, then shows the "check your inbox" state.
class _EmailLinkDialog extends StatefulWidget {
  const _EmailLinkDialog();

  @override
  State<_EmailLinkDialog> createState() => _EmailLinkDialogState();
}

class _EmailLinkDialogState extends State<_EmailLinkDialog> {
  bool _isLoading = false;
  bool _sent = false;
  String? _errorMessage;

  Future<void> _sendConfirmation() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    final success = await auth.requestSocialLinkEmailConfirmation();
    if (!mounted) return;
    if (success) {
      setState(() {
        _sent = true;
        _isLoading = false;
      });
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage =
            auth.errorMessage ?? l10n.get('facebook_sign_in_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (_sent) {
      return AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        ),
        title: Text(
          l10n.get('check_inbox_title'),
          style: AppTextStyles.heading3.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
        content: Text(
          l10n.get('check_inbox_message'),
          style: AppTextStyles.bodySmall.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSizes.buttonRadius),
              ),
              elevation: 0,
            ),
            child: Text(
              l10n.get('ok'),
              style: AppTextStyles.labelLarge.copyWith(color: Colors.white),
            ),
          ),
        ],
      );
    }

    return AlertDialog(
      backgroundColor: theme.colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      title: Text(
        l10n.get('link_account_title'),
        style: AppTextStyles.heading3.copyWith(
          color: theme.colorScheme.onSurface,
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.get('link_account_email_message'),
            style: AppTextStyles.bodySmall.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSizes.md),
            Text(
              _errorMessage!,
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.redAccent,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed:
              _isLoading ? null : () => Navigator.of(context).pop(),
          child: Text(
            l10n.get('cancel'),
            style: AppTextStyles.labelLarge.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _sendConfirmation,
          style: ElevatedButton.styleFrom(
            backgroundColor: theme.primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSizes.buttonRadius),
            ),
            elevation: 0,
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  l10n.get('send_confirmation_email'),
                  style: AppTextStyles.labelLarge.copyWith(color: Colors.white),
                ),
        ),
      ],
    );
  }
}
