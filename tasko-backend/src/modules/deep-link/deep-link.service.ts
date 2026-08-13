import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: 'android_app';
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

export interface AppleAppSiteAssociation {
  applinks: {
    details: Array<{
      appIDs: string[];
      components: Array<{ '/': string }>;
    }>;
  };
}

/**
 * Builds the platform association files that tell Android (App Links) and iOS
 * (Universal Links) to route `https://<deep-link-host>/invitations/*` URLs back
 * into the Tasko app. Served by DeepLinkController at `/.well-known/`.
 *
 * Every value comes from configuration; the defaults are placeholders that must
 * be replaced with the real domain / Apple Team ID / signing fingerprint before
 * deep links can be verified (see docs/firebase-integration-plan.md, Round 4).
 */
@Injectable()
export class DeepLinkService {
  private readonly baseUrl: string;
  private readonly appleTeamId: string;
  private readonly fingerprints: string[];

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>(
      'deepLink.baseUrl',
      'https://tasko.example',
    );
    this.appleTeamId = config.get<string>(
      'deepLink.appleTeamId',
      'TEAM_ID_PLACEHOLDER',
    );
    this.fingerprints = config
      .get<string>('deepLink.androidFingerprints', '')
      .split(',')
      .map((fingerprint) => fingerprint.trim())
      .filter(Boolean);
  }

  /** Public HTTPS origin used to build invitation deep links. */
  get deepLinkBaseUrl(): string {
    return this.baseUrl;
  }

  assetLinks(): AssetLinkStatement[] {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.tasko.app',
          sha256_cert_fingerprints: this.fingerprints,
        },
      },
    ];
  }

  appleAppSiteAssociation(): AppleAppSiteAssociation {
    return {
      applinks: {
        details: [
          {
            appIDs: [`${this.appleTeamId}.com.tasko.app`],
            components: [{ '/': '/invitations/*' }],
          },
        ],
      },
    };
  }
}
