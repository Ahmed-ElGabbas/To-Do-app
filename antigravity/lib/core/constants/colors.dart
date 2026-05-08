import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFFFF9F00);
  static const Color primaryLight = Color(0xFFFFBF40);
  static const Color primaryDark = Color(0xFFE68F00);

  // Light theme
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF7F7F7);
  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textSecondary = Color(0xFFAAAAAA);
  static const Color border = Color(0xFFEFEFEF);

  // Dark theme
  static const Color backgroundDark = Color(0xFF1A1A1A);
  static const Color surfaceDark = Color(0xFF2A2A2A);
  static const Color textPrimaryDark = Color(0xFFFFFFFF);

  // Legacy dark aliases (used by app_theme.dart)
  static const Color darkBackground = Color(0xFF1A1A1A);
  static const Color darkSurface = Color(0xFF2A2A2A);
  static const Color darkCard = Color(0xFF2A2A2A);

  // Status
  static const Color done = Color(0xFFCCCCCC);
  static const Color error = Color(0xFFE53935);
  static const Color success = Color(0xFF4CAF50);

  // Drawer
  static const Color drawerBg = Color(0xFF12121F);
  static const Color drawerText = Color(0xFFFFFFFF);
  static const Color drawerSubtext = Color(0xFF8888AA);

  // Utility
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);

  // Priority
  static const Color highPriority = Color(0xFFFF5722);
  static const Color mediumPriority = Color(0xFFFF9F00);
  static const Color lowPriority = Color(0xFFFFC107);
}
