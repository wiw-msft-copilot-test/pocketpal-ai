const centralizedIntegrationsEnabled =
  process.env.ENABLE_PALSHUB_INTEGRATION === 'true';

const disabledNativeDependency = centralizedIntegrationsEnabled
  ? {}
  : {platforms: {android: null, ios: null}};
const appleAuthenticationDependency = centralizedIntegrationsEnabled
  ? {platforms: {android: null}}
  : disabledNativeDependency;

module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts'],
  dependencies: {
    '@invertase/react-native-apple-authentication':
      appleAuthenticationDependency,
    '@react-native-firebase/app': disabledNativeDependency,
    '@react-native-firebase/app-check': disabledNativeDependency,
    '@react-native-google-signin/google-signin': disabledNativeDependency,
    'react-native-iap': disabledNativeDependency,
    'react-native-nitro-modules': disabledNativeDependency,
  },
};
