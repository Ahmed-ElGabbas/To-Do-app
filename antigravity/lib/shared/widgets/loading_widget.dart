import 'package:flutter/material.dart';
import 'package:tasko/core/constants/colors.dart';
import 'package:tasko/core/constants/sizes.dart';

class LoadingWidget extends StatelessWidget {
  final double size;
  final Color? color;

  const LoadingWidget({
    super.key,
    this.size = AppSizes.iconLg,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(
            color ?? AppColors.primary,
          ),
          strokeWidth: 3,
        ),
      ),
    );
  }
}
