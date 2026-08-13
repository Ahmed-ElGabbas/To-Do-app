import { ConfigService } from '@nestjs/config';
import configuration from '../../config/configuration';
import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  const DEBUG_FINGERPRINT =
    '47:4E:76:0C:B2:94:C4:24:9A:7A:FC:7A:D5:BE:D6:83:70:98:95:9C:B8:C5:7C:7B:C1:33:B2:13:BE:47:8D:AD';

  function serviceWith(
    deepLink: Partial<{
      baseUrl: string;
      appleTeamId: string;
      androidFingerprints: string;
    }> = {},
  ): DeepLinkService {
    const base = configuration();
    const config = new ConfigService({
      ...base,
      deepLink: { ...base.deepLink, ...deepLink },
    });
    return new DeepLinkService(config);
  }

  it('emits a single assetlinks statement for the Tasko Android app', () => {
    expect(serviceWith().assetLinks()).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.tasko.app',
          sha256_cert_fingerprints: [DEBUG_FINGERPRINT],
        },
      },
    ]);
  });

  it('defaults the fingerprint list to the debug keystore fingerprint', () => {
    const links = serviceWith().assetLinks();
    expect(links[0].target.sha256_cert_fingerprints).toEqual([
      DEBUG_FINGERPRINT,
    ]);
  });

  it('splits a comma-separated fingerprint list', () => {
    const links = serviceWith({
      androidFingerprints: 'AA:BB:CC, DD:EE:FF',
    }).assetLinks();
    expect(links[0].target.sha256_cert_fingerprints).toEqual([
      'AA:BB:CC',
      'DD:EE:FF',
    ]);
  });

  it('builds an AASA scoped to the invitations path', () => {
    const aasa = serviceWith().appleAppSiteAssociation();
    expect(aasa.applinks.details).toEqual([
      {
        appIDs: ['TEAM_ID_PLACEHOLDER.com.tasko.app'],
        components: [{ '/': '/invitations/*' }],
      },
    ]);
  });

  it('exposes the configured deep-link base URL', () => {
    expect(
      serviceWith({ baseUrl: 'https://api.tasko.app' }).deepLinkBaseUrl,
    ).toBe('https://api.tasko.app');
  });
});
