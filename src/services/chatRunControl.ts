import {ttsStore} from '../store/TTSStore';

type ActiveRun = {
  token: symbol;
  abort: () => void;
  settled: Promise<void>;
  resolveSettled: () => void;
};

class ChatRunControl {
  private activeRun: ActiveRun | null = null;
  private voiceStop: (() => Promise<void>) | null = null;
  private switching = false;

  get isSwitchingSession(): boolean {
    return this.switching;
  }

  beginRun(abort: () => void): symbol {
    const token = Symbol('chat-run');
    let resolveSettled = () => {};
    const settled = new Promise<void>(resolve => {
      resolveSettled = resolve;
    });
    this.activeRun = {token, abort, settled, resolveSettled};
    return token;
  }

  endRun(token: symbol): void {
    if (this.activeRun?.token !== token) {
      return;
    }
    this.activeRun.resolveSettled();
    this.activeRun = null;
  }

  registerVoiceStop(stop: () => Promise<void>): () => void {
    this.voiceStop = stop;
    return () => {
      if (this.voiceStop === stop) {
        this.voiceStop = null;
      }
    };
  }

  async stopForSessionSwitch(): Promise<void> {
    this.switching = true;
    try {
      const voiceStopping = this.voiceStop?.();
      const run = this.activeRun;
      run?.abort();
      await voiceStopping;
      await ttsStore.stop();
      await run?.settled;
    } finally {
      this.switching = false;
    }
  }
}

export const chatRunControl = new ChatRunControl();
