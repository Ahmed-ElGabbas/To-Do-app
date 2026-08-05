import 'package:dio/dio.dart';

import 'api_client.dart';
import 'services/activity_api.dart';
import 'services/admin_api.dart';
import 'services/analytics_api.dart';
import 'services/auth_api.dart';
import 'services/category_api.dart';
import 'services/comment_api.dart';
import 'services/file_api.dart';
import 'services/invitation_api.dart';
import 'services/member_api.dart';
import 'services/notification_api.dart';
import 'services/search_api.dart';
import 'services/settings_api.dart';
import 'services/tag_api.dart';
import 'services/task_api.dart';
import 'services/team_api.dart';
import 'services/user_api.dart';
import 'token_store.dart';

/// Central application service container.
///
/// A single instance is created at startup (see `main.dart`); providers and
/// screens reach the network layer through it. The [TokenStorage] is shared so
/// the auth interceptor, token store and refresh flow stay consistent.
class AppServices {
  AppServices({TokenStorage? tokenStore, Dio? dio})
      : tokenStore = tokenStore ?? SecureTokenStorage() {
    apiClient = ApiClient(tokenStore: this.tokenStore, dio: dio);
    authApi = AuthApi(apiClient);
    userApi = UserApi(apiClient);
    taskApi = TaskApi(apiClient);
    categoryApi = CategoryApi(apiClient);
    tagApi = TagApi(apiClient);
    teamApi = TeamApi(apiClient);
    memberApi = MemberApi(apiClient);
    invitationApi = InvitationApi(apiClient);
    commentApi = CommentApi(apiClient);
    settingsApi = SettingsApi(apiClient);
    notificationApi = NotificationApi(apiClient);
    searchApi = SearchApi(apiClient);
    analyticsApi = AnalyticsApi(apiClient);
    adminApi = AdminApi(apiClient);
    fileApi = FileApi(apiClient);
    activityApi = ActivityApi(apiClient);
  }

  static late AppServices instance;

  late final TokenStorage tokenStore;
  late final ApiClient apiClient;
  late final AuthApi authApi;
  late final UserApi userApi;
  late final TaskApi taskApi;
  late final CategoryApi categoryApi;
  late final TagApi tagApi;
  late final TeamApi teamApi;
  late final MemberApi memberApi;
  late final InvitationApi invitationApi;
  late final CommentApi commentApi;
  late final SettingsApi settingsApi;
  late final NotificationApi notificationApi;
  late final SearchApi searchApi;
  late final AnalyticsApi analyticsApi;
  late final AdminApi adminApi;
  late final FileApi fileApi;
  late final ActivityApi activityApi;
}
