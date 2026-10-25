import React from 'react';
import {act, renderHook} from '@testing-library/react-native';
import AudioRecord from '@fugood/react-native-audio-pcm-stream';

import {render} from '../../../../jest/test-utils';
import {useVoiceMode} from '../../../hooks/useVoiceMode';
import {purchaseStore, voiceEntitlement, voiceModeStore} from '../../../store';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    require('react').useEffect(effect, [effect]);
  },
}));

jest.mock('../AccountCard', () => {
  throw new Error('AccountCard must not load in a disabled build');
});

const describeDisabledBuild = __ENABLE_PALSHUB__ ? describe.skip : describe;

describeDisabledBuild('Settings and Plus voice in a disabled build', () => {
  it('hides account and Plus voice settings', () => {
    const {SettingsScreen} = require('../SettingsScreen');
    const view = render(<SettingsScreen />, {
      withBottomSheetProvider: true,
      withSafeArea: true,
      withNavigation: true,
    });

    expect(view.queryByTestId('voice-mode-availability-switch')).toBeNull();
    expect(view.queryByText('Account')).toBeNull();
  });

  it('cannot start Plus voice or a paywall through controller entry points', async () => {
    jest.clearAllMocks();
    voiceModeStore.setUserVoiceModeOverride(true);
    voiceModeStore.setUnlockOverride(true);
    const engine = {
      id: 'cascade' as const,
      prepare: jest.fn(),
      release: jest.fn(),
      runTurn: jest.fn(),
    };
    const {result} = renderHook(() =>
      useVoiceMode({port: {send: jest.fn(), stop: jest.fn()}, engine}),
    );

    await act(async () => {
      await result.current.requestEntry({
        openModelPicker: jest.fn(),
        focusInput: jest.fn(),
      });
      await result.current.setupDone();
      await result.current.continueAnyway();
      result.current.getPlus();
    });

    expect(result.current.sheet).toBeNull();
    expect(engine.prepare).not.toHaveBeenCalled();
    expect(AudioRecord.init).not.toHaveBeenCalled();
    expect(AudioRecord.start).not.toHaveBeenCalled();
    expect(voiceEntitlement.source.openPaywall).not.toHaveBeenCalled();
    expect(purchaseStore.start).not.toHaveBeenCalled();
    voiceModeStore.setUnlockOverride(null);
  });
});
