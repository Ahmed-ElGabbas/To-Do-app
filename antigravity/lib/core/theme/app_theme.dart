import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: const Color(0xFFF5F5F5),
    primaryColor: const Color(0xFFFF9F00),
    colorScheme: ColorScheme.light(
      primary: const Color(0xFFFF9F00),
      surface: const Color(0xFFFFFFFF),
      onPrimary: Colors.white,
      onSurface: const Color(0xFF1A1A1A),
      secondary: const Color(0xFFFF9F00),
      onSurfaceVariant: const Color(0xFF888888),
      outline: const Color(0xFFEEEEEE),
      surfaceContainer: const Color(0xFFFFFFFF),
      error: Colors.redAccent,
    ),
    textTheme: GoogleFonts.poppinsTextTheme().copyWith(
      titleLarge: GoogleFonts.poppins(
        color: const Color(0xFF1A1A1A),
        fontWeight: FontWeight.bold,
      ),
      titleMedium: GoogleFonts.poppins(
        color: const Color(0xFF1A1A1A),
        fontWeight: FontWeight.bold,
      ),
      bodyLarge: GoogleFonts.poppins(color: const Color(0xFF1A1A1A)),
      bodyMedium: GoogleFonts.poppins(color: const Color(0xFF888888)),
      bodySmall: GoogleFonts.poppins(color: const Color(0xFF888888)),
      labelLarge: GoogleFonts.poppins(
        color: const Color(0xFF1A1A1A),
        fontWeight: FontWeight.bold,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFFFFFFFF),
      foregroundColor: Color(0xFF1A1A1A),
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: Color(0xFF1A1A1A),
        fontSize: 18,
        fontWeight: FontWeight.w600,
        fontFamily: 'Poppins',
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: Color(0xFFFF9F00),
      unselectedItemColor: Color(0xFFAAAAAA),
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFFFFFFFF),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFEEEEEE),
      thickness: 1,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? const Color(0xFFFF9F00)
              : null),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? const Color(0xFFFF9F00).withValues(alpha: 0.5)
              : null),
    ),
    iconTheme: const IconThemeData(
      color: Color(0xFFFF9F00),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFFFF9F00),
      foregroundColor: Colors.white,
    ),
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF1A1A1A),
    primaryColor: const Color(0xFFFF9F00),
    colorScheme: ColorScheme.dark(
      primary: const Color(0xFFFF9F00),
      surface: const Color(0xFF2A2A2A),
      onPrimary: Colors.white,
      onSurface: const Color(0xFFFFFFFF),
      error: Colors.redAccent,
    ),
    textTheme: GoogleFonts.poppinsTextTheme(ThemeData.dark().textTheme),
    appBarTheme: AppBarTheme(
      backgroundColor: const Color(0xFF1A1A1A),
      foregroundColor: const Color(0xFFFFFFFF),
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.poppins(
        color: const Color(0xFFFFFFFF),
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF1A1A1A),
      selectedItemColor: Color(0xFFFF9F00),
      unselectedItemColor: Color(0xFF888888),
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF2A2A2A),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFFFF9F00),
      foregroundColor: Colors.white,
    ),
  );

  // Maintain compatibility with existing calls if any
  static ThemeData get lightTheme => light;
  static ThemeData get darkTheme => dark;
}
