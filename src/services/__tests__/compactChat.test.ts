import {compactChat} from '../compactChat';
import {chatSessionStore, modelStore} from '../../store';
import {assistant, user} from '../../utils/chat';
import {applyGenerationParameterModes} from '../../utils/generationParameterModes';
import {encodeResponsesRequest} from '../../api/responsesRequest';
import {compactionRequest, compactionTurns} from '../compaction';
import type {GenerationLease} from '../../store/generationLease';
import type {
  ApiCompletionParams,
  CompletionResult,
} from '../../utils/completionTypes';

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
  const completion = jest.fn<
    Promise<CompletionResult>,
    [ApiCompletionParams]
  >();
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
        n_predict: -1,
        enable_thinking: false,
      }),
    );
    const request = completion.mock.calls[0][0];
    expect(request).not.toHaveProperty('tools');
    expect(
      encodeResponsesRequest({
        model: 'remote-model',
        messages: request.messages ?? [],
        n_predict: request.n_predict,
        generationParameterModes: request.generationParameterModes,
      }),
    ).not.toHaveProperty('max_output_tokens');
    expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalledWith(
      'chat',
      source,
      [expect.objectContaining({metadata: {compaction: true}})],
      expect.any(Function),
    );
    expect(lease.end).toHaveBeenCalled();
  });

  it.each(['omit', undefined] as const)(
    'uses the remote provider temperature when its policy is %s',
    async temperature => {
      jest
        .spyOn(chatSessionStore, 'getCurrentCompletionSettings')
        .mockResolvedValueOnce({
          temperature: 0.7,
          n_predict: 9999,
          generationParameterModes: {temperature, n_predict: 'omit'},
          tools: [{type: 'function', function: {name: 'calculate'}}],
        });

      await compactChat('chat', '', 'Summary');

      const request = applyGenerationParameterModes(
        completion.mock.calls[0][0],
      );
      expect(request).not.toHaveProperty('temperature');
      expect(request).not.toHaveProperty('tools');
      expect(request.n_predict).toBe(-1);
      expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalledWith(
        'chat',
        source,
        [expect.objectContaining({metadata: {compaction: true}})],
        expect.any(Function),
      );
    },
  );

  it('does not impose a fallback output limit when the context size is unknown', async () => {
    jest.spyOn(modelStore, 'activeModelCaps', 'get').mockReturnValue({
      vision: 'no',
      visionActive: false,
    });

    await compactChat('chat', '', 'Summary');

    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({n_predict: -1}),
    );
    expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalled();
  });

  it('accepts a complete reducing summary beyond the former output limit', async () => {
    chatSessionStore.sessions[0].messages[0] = {
      ...source[0],
      text: 'Original detailed fact. '.repeat(3000),
    };
    jest.spyOn(modelStore, 'activeModelCaps', 'get').mockReturnValue({
      vision: 'no',
      visionActive: false,
      effectiveContextLength: 131072,
    });
    completion.mockResolvedValueOnce({
      text: '',
      content: JSON.stringify({
        summary: 'Retained fact. '.repeat(2200),
        keepTurnIds: [],
      }),
      tokens_predicted: 4096,
      terminal_status: 'completed',
    });

    await compactChat('chat', '', 'Summary');

    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({n_predict: -1}),
    );
    expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalled();
  });

  it.each([0, 1])(
    'checks input fit without reserving an arbitrary output budget (%i token headroom)',
    async headroom => {
      const request = compactionRequest(compactionTurns(source), '', false);
      const inputSize = request.reduce(
        (total, message) => total + JSON.stringify(message).length,
        0,
      );
      jest.spyOn(modelStore, 'activeModelCaps', 'get').mockReturnValue({
        vision: 'no',
        visionActive: false,
        effectiveContextLength: inputSize + headroom,
      });

      if (headroom === 0) {
        await expect(compactChat('chat', '', 'Summary')).rejects.toThrow(
          'overflow',
        );
        expect(completion).not.toHaveBeenCalled();
        expect(chatSessionStore.replaceCompactedHistory).not.toHaveBeenCalled();
      } else {
        await compactChat('chat', '', 'Summary');
        expect(completion).toHaveBeenCalled();
        expect(chatSessionStore.replaceCompactedHistory).toHaveBeenCalled();
      }
    },
  );

  it.each([0, 0.4])(
    'preserves an explicitly configured remote temperature of %s',
    async temperature => {
      jest
        .spyOn(chatSessionStore, 'getCurrentCompletionSettings')
        .mockResolvedValueOnce({
          temperature,
          generationParameterModes: {temperature: 'send'},
        });

      await compactChat('chat', '', 'Summary');

      expect(
        applyGenerationParameterModes(completion.mock.calls[0][0]).temperature,
      ).toBe(temperature);
    },
  );

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
