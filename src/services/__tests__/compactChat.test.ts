import {compactChat} from '../compactChat';
import {chatSessionStore, modelStore} from '../../store';
import {assistant, user} from '../../utils/chat';
import type {GenerationLease} from '../../store/generationLease';
import type {CompletionResult} from '../../utils/completionTypes';

jest.mock('../../store', () => ({
  chatSessionStore: {
    sessions: [],
    activeSessionId: null,
    isGenerating: false,
    isStopping: false,
    setIsGenerating: jest.fn(),
    replaceCompactedHistory: jest.fn(),
    getCurrentCompletionSettings: jest.fn().mockResolvedValue({}),
  },
  modelStore: {
    context: undefined,
    activeModelId: undefined,
    tryAcquireGeneration: jest.fn(),
    get activeModelCaps() {
      return {vision: 'no', visionActive: false, effectiveContextLength: 16384};
    },
  },
}));

describe('compactChat lifecycle', () => {
  let controller: AbortController;
  let lease: GenerationLease;
  const completion = jest.fn<Promise<CompletionResult>, []>();
  const stopCompletion = jest.fn().mockResolvedValue(undefined);
  const source = [
    {
      id: 'answer',
      type: 'text' as const,
      author: assistant,
      text: 'An answer. '.repeat(80),
    },
    {
      id: 'question',
      type: 'text' as const,
      author: user,
      text: 'Some important facts. '.repeat(80),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AbortController();
    lease = {
      engine: {completion, stopCompletion},
      signal: controller.signal,
      abort: () => controller.abort(),
      end: jest.fn(),
    };
    chatSessionStore.sessions = [
      {
        id: 'chat',
        title: 'Chat',
        date: '',
        messages: [...source],
        completionSettings: {prompt: ''},
        settingsSource: 'custom',
      },
    ];
    chatSessionStore.activeSessionId = 'chat';
    chatSessionStore.isGenerating = false;
    chatSessionStore.isStopping = false;
    modelStore.context = undefined;
    modelStore.activeModelId = 'model';
    jest.spyOn(modelStore, 'tryAcquireGeneration').mockReturnValue(lease);
    jest.spyOn(modelStore, 'activeModelCaps', 'get').mockReturnValue({
      vision: 'no',
      visionActive: false,
      effectiveContextLength: 16384,
    });
    completion.mockResolvedValue({
      text: '',
      content: '{"summary":"Key facts.","keepTurnIds":[]}',
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses a dedicated tool-free request and commits only validated reduction', async () => {
    await compactChat('chat', '', 'Summary');
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        n_predict: 2048,
        enable_thinking: false,
      }),
    );
    expect(completion.mock.calls[0]).not.toHaveProperty('tools');
    expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalledWith(
      'chat',
      source,
      [expect.objectContaining({metadata: {compaction: true}})],
      expect.any(Function),
    );
    expect(lease.end).toHaveBeenCalled();
  });

  it.each([
    ['invalid', '{"summary":"bad","keepTurnIds":["unknown"]}'],
    [
      'noReduction',
      JSON.stringify({summary: 'Verbose '.repeat(1000), keepTurnIds: []}),
    ],
  ])('does not mutate history for %s output', async (code, content) => {
    completion.mockResolvedValue({text: '', content});
    await expect(compactChat('chat', '', 'Summary')).rejects.toThrow(code);
    expect(chatSessionStore.replaceCompactedHistory).not.toHaveBeenCalled();
    expect(chatSessionStore.sessions[0].messages).toEqual(source);
    expect(lease.end).toHaveBeenCalled();
  });

  it('rejects oversized input without calling the model', async () => {
    jest.spyOn(modelStore, 'activeModelCaps', 'get').mockReturnValue({
      vision: 'no',
      visionActive: false,
      effectiveContextLength: 2048,
    });
    await expect(compactChat('chat', '', 'Summary')).rejects.toThrow(
      'overflow',
    );
    expect(completion).not.toHaveBeenCalled();
    expect(chatSessionStore.replaceCompactedHistory).not.toHaveBeenCalled();
  });

  it('aborts and drains without saving a completed result after cancellation', async () => {
    completion.mockImplementationOnce(async () => {
      controller.abort();
      return {text: '', content: '{"summary":"Facts.","keepTurnIds":[]}'};
    });
    await expect(compactChat('chat', '', 'Summary')).rejects.toThrow('changed');
    expect(stopCompletion).toHaveBeenCalled();
    expect(chatSessionStore.replaceCompactedHistory).not.toHaveBeenCalled();
    expect(lease.end).toHaveBeenCalled();
  });

  it('rejects a changed chat before saving', async () => {
    completion.mockImplementationOnce(async () => {
      chatSessionStore.sessions[0].messages[0] = {
        ...source[0],
        text: 'Changed',
      };
      return {text: '', content: '{"summary":"Facts.","keepTurnIds":[]}'};
    });
    await expect(compactChat('chat', '', 'Summary')).rejects.toThrow('changed');
    expect(chatSessionStore.replaceCompactedHistory).not.toHaveBeenCalled();
  });
});
