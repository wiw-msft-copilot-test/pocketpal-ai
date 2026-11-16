import Speech, {TTSEngine} from '@pocketpalai/react-native-speech';

import {l10n} from '../../../../locales';
import {createEngineStreamingHandle} from '../../streamingHandle';
import type {Engine, StreamOptions, StreamingHandle, Voice} from '../../types';
import {getSystemVoices} from './voices';

export class SystemEngine implements Engine {
  readonly id = 'system' as const;

  async isInstalled(): Promise<boolean> {
    return true;
  }

  getVoices(): Promise<Voice[]> {
    return getSystemVoices(l10n.en.voiceAndSpeech);
  }

  async loadInto(): Promise<void> {
    await Speech.initialize({engine: TTSEngine.OS_NATIVE, ducking: true});
  }

  async play(text: string, voice: Voice): Promise<void> {
    const handle = this.playStreaming(voice);
    handle.appendText(text);
    await handle.finalize();
  }

  playStreaming(
    voice: Voice,
    waitFor?: Promise<void>,
    streamOpts?: StreamOptions,
  ): StreamingHandle {
    const delegate = createEngineStreamingHandle(
      this,
      voice.id,
      streamOpts,
      waitFor,
    );
    let failed = false;
    let cancelled = false;
    // Native OS streams drain on finish, stop AND error. An error must not
    // become a successful conversation turn merely because that drain settled.
    const errorSubscription = Speech.onError(() => {
      failed = true;
    });
    return {
      appendText: delegate.appendText,
      async finalize() {
        try {
          await delegate.finalize();
          if (failed && !cancelled) {
            throw new Error('System speech playback failed');
          }
        } finally {
          errorSubscription.remove();
        }
      },
      async cancel() {
        cancelled = true;
        try {
          await delegate.cancel();
        } finally {
          errorSubscription.remove();
        }
      },
    };
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }
}
