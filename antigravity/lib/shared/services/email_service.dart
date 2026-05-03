import 'package:url_launcher/url_launcher.dart';

class EmailService {
  EmailService._();

  static const String _devEmail = 'ahmed.mahmoud.elgabbas@gmail.com';

  static Future<void> sendFeedback() async {
    final uri = Uri.parse(
      'mailto:$_devEmail'
      '?subject=App%20Feedback'
      '&body=Hi%2C%20I%20want%20to%20share%20feedback%20about%20the%20app.',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> contactUs() async {
    final uri = Uri.parse(
      'mailto:$_devEmail?subject=Support%20Request',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
