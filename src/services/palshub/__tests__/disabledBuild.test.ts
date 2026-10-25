const mockCreateClient = jest.fn();

jest.mock('../../../store/ModelStore', () => ({
  modelStore: require('../../../store').modelStore,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

jest.mock('@react-native-firebase/app', () => {
  throw new Error('Firebase app must not load in a disabled build');
});

jest.mock('@react-native-firebase/app-check', () => {
  throw new Error('Firebase App Check must not load in a disabled build');
});

jest.mock('@react-native-google-signin/google-signin', () => {
  throw new Error('Google Sign-In must not load in a disabled build');
});

jest.mock('@invertase/react-native-apple-authentication', () => {
  throw new Error('Apple Sign-In must not load in a disabled build');
});

jest.mock('react-native-iap', () => {
  throw new Error('Native purchases must not load in a disabled build');
});

const describeDisabledBuild = __ENABLE_PALSHUB__ ? describe.skip : describe;

describeDisabledBuild('disabled centralized integrations build', () => {
  it('does not initialize centralized authentication dependencies', () => {
    expect(() => require('../AuthService')).not.toThrow();
    expect(() => require('../supabase')).not.toThrow();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('does not initialize the native purchase dependency', () => {
    expect(() => require('../../../store/PurchaseStore')).not.toThrow();
  });

  it('does not offer Plus or unlock voice through persisted or E2E overrides', () => {
    const {VoiceModeStore} = require('../../../store/VoiceModeStore');
    const {purchaseStore} = require('../../../store');
    const {
      openPlus,
      isPlusAvailable,
      isPlusUnlocked,
      plusGate,
    } = require('../../plus/gate');
    const {
      shippedPlusFeatures,
      plusFeatureRows,
    } = require('../../plus/shipped');
    const voice = new VoiceModeStore();
    voice.setUserVoiceModeOverride(true);
    voice.setUnlockOverride(true);
    expect(voice.supported).toBe(false);
    expect(voice.isUnlocked).toBe(false);
    expect(shippedPlusFeatures()).toEqual([]);
    expect(plusFeatureRows()).toEqual([]);
    expect(isPlusAvailable()).toBe(false);
    expect(isPlusUnlocked()).toBe(false);
    openPlus({onUnlocked: jest.fn()});
    expect(plusGate.request).toBeNull();
    expect(purchaseStore.retryPlusProducts).not.toHaveBeenCalled();
    expect(purchaseStore.start).not.toHaveBeenCalled();
  });

  it('rejects Firebase App Check without loading its native modules', async () => {
    const {initializeAppCheck, getAppCheckToken} = require('../../../utils/fb');

    await expect(initializeAppCheck()).rejects.toThrow(
      'Firebase App Check is disabled in this build.',
    );
    await expect(getAppCheckToken()).rejects.toThrow(
      'Firebase App Check is disabled in this build.',
    );
  });

  it('rejects PalsHub API calls before making a request', async () => {
    const {palsHubApiService} = require('../PalsHubApiService');

    await expect(palsHubApiService.getPals()).rejects.toThrow(
      'PalsHub API not configured',
    );
  });
});
