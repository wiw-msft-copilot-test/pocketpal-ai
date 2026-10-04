jest.unmock('../../repositories/ChatSessionRepository');

import {chatSessionRepository} from '../../repositories/ChatSessionRepository';
import {ChatSearchAbortedError, LocalChatSearchProvider} from '../chatSearch';

describe('LocalChatSearchProvider', () => {
  beforeEach(() => {
    jest
      .spyOn(chatSessionRepository, 'getChatSearchSessions')
      .mockResolvedValue([
        {sessionId: 'one', title: 'Notes', sessionDate: '2020-01-01'},
      ]);
    jest
      .spyOn(chatSessionRepository, 'getChatSearchMessageUpperBound')
      .mockResolvedValue('z');
  });

  afterEach(() => jest.restoreAllMocks());

  it('decodes visible assistant steps and reports progress', async () => {
    jest
      .spyOn(chatSessionRepository, 'getChatSearchMessagePage')
      .mockResolvedValue([
        {
          id: 'a',
          sessionId: 'one',
          author: 'assistant',
          type: 'assistant_turn',
          metadata: JSON.stringify({
            steps: [
              {content: 'solar answer', reasoningContent: 'hidden solar'},
            ],
          }),
          createdAt: 42,
        },
      ]);
    const progress = jest.fn();
    const results = await new LocalChatSearchProvider().search({
      query: 'solar',
      signal: new AbortController().signal,
      onProgress: progress,
    });
    expect(results[0]).toMatchObject({
      sessionId: 'one',
      occurrenceCount: 1,
      latestActivityAt: 42,
    });
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({recordsVisited: 1, complete: false}),
    );
  });

  it('does not issue another page after cancellation', async () => {
    const controller = new AbortController();
    const page = jest
      .spyOn(chatSessionRepository, 'getChatSearchMessagePage')
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });
    await expect(
      new LocalChatSearchProvider().search({
        query: 'solar',
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ChatSearchAbortedError);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('propagates repository failures instead of returning empty success', async () => {
    jest
      .spyOn(chatSessionRepository, 'getChatSearchMessagePage')
      .mockRejectedValue(new Error('read failed'));
    await expect(
      new LocalChatSearchProvider().search({
        query: 'solar',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('read failed');
  });
});
