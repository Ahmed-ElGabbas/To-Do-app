import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/todo/presentation/screens/home_screen.dart';
import 'package:tasko/features/todo/presentation/screens/tasks_screen.dart';
import 'package:tasko/features/todo/presentation/screens/calendar_screen.dart';
import 'package:tasko/features/todo/presentation/screens/profile_screen.dart';
import 'package:tasko/features/todo/presentation/widgets/side_drawer.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _currentIndex = 0;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  void _onNavigate(int index) {
    setState(() => _currentIndex = index);
  }

  Widget _buildBody() {
    switch (_currentIndex) {
      case 0: return HomeScreen(scaffoldKey: _scaffoldKey);
      case 1: return TasksScreen(scaffoldKey: _scaffoldKey);
      case 2: return CalendarScreen(scaffoldKey: _scaffoldKey);
      case 3: return ProfileScreen(scaffoldKey: _scaffoldKey);
      default: return HomeScreen(scaffoldKey: _scaffoldKey);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      key: _scaffoldKey,
      drawer: SideDrawer(onNavigate: _onNavigate),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: theme.brightness == Brightness.light ? 0.08 : 0.2),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onNavigate,
          backgroundColor: theme.colorScheme.surface,
          selectedItemColor: const Color(0xFFFF9F00),
          unselectedItemColor: theme.colorScheme.onSurface.withValues(alpha: 0.5),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedLabelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle: GoogleFonts.poppins(fontSize: 11),
          items: [
            _navItem(Icons.home_rounded, Icons.home_outlined, l10n.get('home'), 0),
            _navItem(Icons.checklist_rounded, Icons.checklist_outlined, l10n.get('tasks'), 1),
            _navItem(Icons.calendar_month_rounded, Icons.calendar_month_outlined, l10n.get('calendar'), 2),
            _navItem(Icons.person_rounded, Icons.person_outline_rounded, l10n.get('profile'), 3),
          ],
        ),
      ),
    );
  }

  BottomNavigationBarItem _navItem(IconData activeIcon, IconData inactiveIcon, String label, int index) {
    final isActive = _currentIndex == index;
    final theme = Theme.of(context);
    return BottomNavigationBarItem(
      icon: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isActive ? activeIcon : inactiveIcon,
            color: isActive ? const Color(0xFFFF9F00) : theme.colorScheme.onSurface.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 3),
          if (isActive)
            Container(width: 5, height: 5, decoration: const BoxDecoration(color: Color(0xFFFF9F00), shape: BoxShape.circle))
          else
            const SizedBox(height: 5),
        ],
      ),
      label: label,
    );
  }
}
