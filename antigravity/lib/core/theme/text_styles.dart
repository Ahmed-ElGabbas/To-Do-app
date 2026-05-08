import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTextStyles {
  AppTextStyles._();

  // Headings
  static TextStyle heading1 = GoogleFonts.poppins(
    fontSize: 28,
    fontWeight: FontWeight.w800,
  );

  static TextStyle heading2 = GoogleFonts.poppins(
    fontSize: 22,
    fontWeight: FontWeight.w700,
  );

  static TextStyle heading3 = GoogleFonts.poppins(
    fontSize: 18,
    fontWeight: FontWeight.w600,
  );

  // Body
  static TextStyle bodyLarge = GoogleFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w400,
  );

  static TextStyle bodyMedium = GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w400,
  );

  static TextStyle bodySmall = GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w400,
  );

  // Labels
  static TextStyle labelLarge = GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );

  static TextStyle labelMedium = GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w500,
  );

  // Caption
  static TextStyle caption = GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w300,
  );

  // Button
  static TextStyle button = GoogleFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  // Section title (TODAY, TOMORROW)
  static TextStyle sectionTitle = GoogleFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
  );

  // Task title
  static TextStyle taskTitle = GoogleFonts.poppins(
    fontSize: 15,
    fontWeight: FontWeight.w500,
  );

  // Task title done (strikethrough)
  static TextStyle taskTitleDone = GoogleFonts.poppins(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: const Color(0xFFAAAAAA),
    decoration: TextDecoration.lineThrough,
    decorationColor: const Color(0xFFAAAAAA),
  );

  // Time text
  static TextStyle timeText = GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w400,
  );

  // Splash
  static TextStyle splashTitle = GoogleFonts.poppins(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    color: Colors.white,
  );

  static TextStyle splashSubtitle = GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: Colors.white,
  );
}
