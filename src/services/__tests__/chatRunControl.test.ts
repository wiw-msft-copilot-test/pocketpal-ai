jest.unmock('../chatRunControl');
jest.mock('../../store/TTSStore', () => ({
  ttsStore: {stop: jest.fn().mockResolvedValue(undefined)},
}));

import {ttsStore} from '../../store/TTSStore';
import {chatRunControl} from '../chatRunControl';

describe('chatRunControl', () => {
  beforeEach(() => {
    (ttsStore.stop as jest.Mock).mockClear();
  });

  it('stops voice, aborts, and waits for the active run to settle', async () => {
    const order: string[] = [];
    const unregister = chatRunControl.registerVoiceStop(async () => {
      order.push('voice');
    });
    const token = chatRunControl.beginRun(() => order.push('abort'));
    const stopping = chatRunControl
      .stopForSessionSwitch()
      .then(() => order.push('done'));
    await Promise.resolve();
    expect(order).toEqual(['voice', 'abort']);
    expect(chatRunControl.isSwitchingSession).toBe(true);
    chatRunControl.endRun(token);
    await stopping;
    expect(order).toEqual(['voice', 'abort', 'done']);
    expect(chatRunControl.isSwitchingSession).toBe(false);
    unregister();
  });

  it('does not let an old run clear a newer run', async () => {
    const first = chatRunControl.beginRun(jest.fn());
    const secondAbort = jest.fn();
    const second = chatRunControl.beginRun(secondAbort);
    chatRunControl.endRun(first);
    const stopping = chatRunControl.stopForSessionSwitch();
    chatRunControl.endRun(second);
    await stopping;
    expect(secondAbort).toHaveBeenCalledTimes(1);
  });
});
