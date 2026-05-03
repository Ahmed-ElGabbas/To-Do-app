import 'package:flutter/material.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/features/todo/presentation/screens/home_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/tasks_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/calendar_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/profile_screen.dart';
import 'package:antigravity/features/todo/presentation/widgets/side_drawer.dart';

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
      case 0:
        return HomeScreen(scaffoldKey: _scaffoldKey);
      case 1:
        return const TasksScreen();
      case 2:
        return const CalendarScreen();
      case 3:
        return const ProfileScreen();
      default:
        return HomeScreen(scaffoldKey: _scaffoldKey);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      drawer: SideDrawer(onNavigate: _onNavigate),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppSizes.radiusXl),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppSizes.radiusXl),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onNavigate,
          backgroundColor: AppColors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textSecondary,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedLabelStyle: AppTextStyles.bodySmall.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
            fontSize: 11,
          ),
          unselectedLabelStyle: AppTextStyles.bodySmall.copyWith(
            color: AppColors.textSecondary,
            fontSize: 11,
          ),
          items: [
            _navItem(Icons.home_rounded, Icons.home_outlined, AppStrings.home, 0),
            _navItem(Icons.checklist_rounded, Icons.checklist_outlined, AppStrings.tasks, 1),
            _navItem(Icons.calendar_month_rounded, Icons.calendar_month_outlined, AppStrings.calendar, 2),
            _navItem(Icons.person_rounded, Icons.person_outline_rounded, AppStrings.profile, 3),
          ],
        ),
      ),
    );
  }

  BottomNavigationBarItem _navItem(
    IconData activeIcon,
    IconData inactiveIcon,
    String label,
    int index,
  ) {
    final isActive = _currentIndex == index;
    return BottomNavigationBarItem(
      icon: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isActive ? activeIcon : inactiveIcon,
            color: isActive ? AppColors.primary : AppColors.textSecondary,
          ),
          const SizedBox(height: 3),
          if (isActive)
            Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            )
          else
            const SizedBox(height: 5),
        ],
      ),
      label: label,
    );
  }
}
