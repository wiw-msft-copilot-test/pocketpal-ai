const loadConfig = enabled => {
  jest.resetModules();
  process.env.ENABLE_PALSHUB_INTEGRATION = enabled ? 'true' : 'false';
  return require('../../react-native.config');
};

describe('centralized native integration autolinking', () => {
  afterEach(() => {
    delete process.env.ENABLE_PALSHUB_INTEGRATION;
    jest.resetModules();
  });

  it.each([
    '@invertase/react-native-apple-authentication',
    '@react-native-firebase/app',
    '@react-native-firebase/app-check',
    '@react-native-google-signin/google-signin',
    'react-native-iap',
    'react-native-nitro-modules',
  ])('disables %s on both platforms in normal fork builds', dependency => {
    expect(loadConfig(false).dependencies[dependency]).toEqual({
      platforms: {android: null, ios: null},
    });
  });

  it('keeps Apple authentication iOS-only when centralized integrations are enabled', () => {
    expect(
      loadConfig(true).dependencies[
        '@invertase/react-native-apple-authentication'
      ],
    ).toEqual({platforms: {android: null}});
  });
});
