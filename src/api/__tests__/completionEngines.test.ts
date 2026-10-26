import {LlamaContext} from 'llama.rn';

import {
  LocalCompletionEngine,
  OpenAICompletionEngine,
} from '../completionEngines';
import * as openaiModule from '../openai';
import * as responsesModule from '../responses';
import type {RemoteEndpoint} from '../servers';
import {
  RemoteHttpError,
  RemoteModelRequestWithdrawnError,
} from '../../utils/errors';
import {routerWireJson} from '../../../jest/fixtures/routerWire';

jest.mock('../openai', () => ({
  streamChatCompletion: jest.fn(),
}));
jest.mock('../responses', () => ({
  streamResponses: jest.fn(),
}));

const mockedStreamChat = openaiModule.streamChatCompletion as jest.Mock;
const mockedStreamResponses = responsesModule.streamResponses as jest.Mock;

describe('LocalCompletionEngine', () => {
  let mockContext: LlamaContext;
  let engine: LocalCompletionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = new LlamaContext({contextId: 1} as any);
    engine = new LocalCompletionEngine(mockContext);
  });

  it('delegates completion call to LlamaContext', async () => {
    const mockResult = {
      text: 'Hello world',
      content: 'Hello world',
      reasoning_content: undefined,
      timings: {predicted_per_second: 50},
      tokens_predicted: 2,
      tokens_evaluated: 5,
      truncated: false,
      stopped_eos: true,
      stopped_limit: 0,
      stopped_word: '',
      stopping_word: '',
      context_full: false,
      interrupted: false,
    };

    (mockContext.completion as jest.Mock).mockResolvedValueOnce(mockResult);

    const params = {
      messages: [{role: 'user', content: 'Hello'}],
      temperature: 0.7,
    } as any;

    const result = await engine.completion(params);

    expect(mockContext.completion).toHaveBeenCalledWith(params, undefined);
    expect(result.text).toBe('Hello world');
    expect(result.content).toBe('Hello world');
    expect(result.stopped_eos).toBe(true);
    expect(result.tokens_predicted).toBe(2);
    expect(result.timings).toEqual({predicted_per_second: 50});
  });

  it('drops native timings fields that are not finite numbers', async () => {
    (mockContext.completion as jest.Mock).mockResolvedValueOnce({
      text: 'hi',
      content: 'hi',
      timings: {
        prompt_n: 1,
        predicted_per_second: NaN,
        predicted_ms: 35.222,
        cache_n: '15',
      },
      tokens_predicted: 2,
      tokens_evaluated: 5,
    });

    const result = await engine.completion({messages: []} as any);

    expect(result.timings).toEqual({prompt_n: 1, predicted_ms: 35.222});
  });

  it('carries speculative draft_tokens counters from the native result', async () => {
    const mockResult = {
      text: 'spec',
      content: 'spec',
      timings: {predicted_per_second: 80},
      tokens_predicted: 10,
      tokens_evaluated: 4,
      draft_tokens: 12,
      draft_tokens_accepted: 9,
      truncated: false,
      stopped_eos: true,
    };

    (mockContext.completion as jest.Mock).mockResolvedValueOnce(mockResult);

    const result = await engine.completion({} as any);

    expect(result.draft_tokens).toBe(12);
    expect(result.draft_tokens_accepted).toBe(9);
  });

  it('leaves draft_tokens undefined when the native result omits them', async () => {
    const mockResult = {
      text: 'no-spec',
      content: 'no-spec',
      tokens_predicted: 3,
    };

    (mockContext.completion as jest.Mock).mockResolvedValueOnce(mockResult);

    const result = await engine.completion({} as any);

    expect(result.draft_tokens).toBeUndefined();
    expect(result.draft_tokens_accepted).toBeUndefined();
  });

  it('passes callback to LlamaContext and maps token data', async () => {
    const mockResult = {
      text: 'result',
      content: 'result',
    };

    (mockContext.completion as jest.Mock).mockImplementationOnce(
      async (params: any, cb: any) => {
        // Simulate LlamaContext calling the callback with TokenData shape
        cb({token: 'tok', content: 'tok', reasoning_content: 'think'});
        return mockResult;
      },
    );

    const onToken = jest.fn();
    await engine.completion({} as any, onToken);

    expect(onToken).toHaveBeenCalledWith({
      token: 'tok',
      content: 'tok',
      reasoning_content: 'think',
    });
  });

  it('does not pass callback when none provided', async () => {
    (mockContext.completion as jest.Mock).mockResolvedValueOnce({
      text: '',
      content: '',
    });

    await engine.completion({} as any);

    expect(mockContext.completion).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it('delegates stopCompletion to LlamaContext', async () => {
    await engine.stopCompletion();
    expect(mockContext.stopCompletion).toHaveBeenCalled();
  });

  it('removes omitted native arguments while preserving valid Send sentinels', async () => {
    (mockContext.completion as jest.Mock).mockResolvedValueOnce({
      text: '',
      content: '',
    });

    await engine.completion({
      temperature: 0.7,
      top_p: 0,
      seed: -1,
      jinja: false,
      generationParameterModes: {
        temperature: 'omit',
        top_p: 'send',
        seed: 'send',
        jinja: 'send',
      },
    });

    const nativeParams = (mockContext.completion as jest.Mock).mock.calls[0][0];
    expect(
      Object.prototype.hasOwnProperty.call(nativeParams, 'temperature'),
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(nativeParams, 'top_p')).toBe(
      true,
    );
    expect(Object.prototype.hasOwnProperty.call(nativeParams, 'seed')).toBe(
      true,
    );
    expect(Object.prototype.hasOwnProperty.call(nativeParams, 'jinja')).toBe(
      true,
    );
    expect(nativeParams).toMatchObject({top_p: 0, seed: -1, jinja: false});
    expect(nativeParams).not.toHaveProperty('generationParameterModes');
  });
});

describe('OpenAICompletionEngine', () => {
  const ENDPOINT: RemoteEndpoint = {
    url: 'http://localhost:1234',
    remoteModelId: 'test-model',
    apiKey: 'sk-key',
    serverType: 'unknown',
  };
  let engine: OpenAICompletionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new OpenAICompletionEngine(ENDPOINT);
  });

  it('calls streamChatCompletion with correct parameters', async () => {
    const mockResult = {
      text: 'Hello',
      content: 'Hello',
      tokens_predicted: 1,
    };
    mockedStreamChat.mockResolvedValueOnce(mockResult);

    const onToken = jest.fn();
    const params = {
      messages: [{role: 'user', content: 'Hi'}],
      temperature: 0.8,
      top_p: 0.95,
      n_predict: 200,
      stop: ['</s>'],
    } as any;

    const result = await engine.completion(params, onToken);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      {
        messages: [{role: 'user', content: 'Hi'}],
        model: 'test-model',
        samplers: {temperature: 0.8, top_p: 0.95, n_predict: 200},
        stop: ['</s>'],
        stream: true,
        reasoning: undefined,
      },
      ENDPOINT,
      expect.any(Object), // AbortSignal
      onToken,
    );

    expect(result).toEqual(mockResult);
  });

  // PACT support requires the engine to forward tools and tool_choice
  // down to streamChatCompletion. Without this, any Pal with talents
  // enabled silently degrades to text-only on remote engines (no tools
  // schemas → no tool_calls).
  it('forwards tools and tool_choice to streamChatCompletion', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    const calculateTool = {
      type: 'function' as const,
      function: {
        name: 'calculate',
        description: 'Evaluate a math expression',
        parameters: {
          type: 'object',
          properties: {expression: {type: 'string'}},
          required: ['expression'],
        },
      },
    };
    const params = {
      messages: [{role: 'user', content: 'What is 2+2?'}],
      tools: [calculateTool],
      tool_choice: 'auto',
    } as any;

    await engine.completion(params);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [calculateTool],
        tool_choice: 'auto',
      }),
      ENDPOINT,
      expect.any(Object),
      undefined,
    );
  });

  it('forwards every Scout function to Chat Completions unchanged', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});
    const scoutTools = [
      'web_search',
      'read_url',
      'calculate',
      'datetime',
      'render_html',
    ].map(name => ({
      type: 'function' as const,
      function: {
        name,
        description: `${name} description`,
        parameters: {type: 'object'},
      },
    }));

    await engine.completion({
      messages: [{role: 'user', content: 'Help me research something'}],
      tools: scoutTools,
      tool_choice: 'auto',
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: scoutTools,
        tool_choice: 'auto',
      }),
      ENDPOINT,
      expect.any(AbortSignal),
      undefined,
    );
  });

  // Structured-output (json_schema response_format) is provider-agnostic:
  // local goes through llama.rn natively, remote needs response_format
  // forwarded down to the OpenAI request body.
  it('forwards response_format to streamChatCompletion', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: '{}', content: '{}'});

    const responseFormat = {
      type: 'json_schema' as const,
      json_schema: {
        strict: true,
        schema: {type: 'object', properties: {name: {type: 'string'}}},
      },
    };
    const params = {
      messages: [{role: 'user', content: 'give me a name'}],
      response_format: responseFormat,
    } as any;

    await engine.completion(params);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({response_format: responseFormat}),
      ENDPOINT,
      expect.any(Object),
      undefined,
    );
  });

  it('forwards every sampler to streamChatCompletion unaltered', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    const samplers = {
      top_k: 11,
      min_p: 0.11,
      typical_p: 0.91,
      xtc_threshold: 0.31,
      xtc_probability: 0.21,
      penalty_last_n: 41,
      penalty_repeat: 1.11,
      penalty_freq: 0.41,
      penalty_present: 0.51,
      mirostat: 2,
      mirostat_tau: 4.1,
      mirostat_eta: 0.21,
      seed: 12345,
    };

    await engine.completion({
      messages: [{role: 'user', content: 'Hi'}],
      ...samplers,
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({samplers}),
      ENDPOINT,
      expect.any(Object),
      undefined,
    );
  });

  it('handles missing optional params gracefully', async () => {
    mockedStreamChat.mockResolvedValueOnce({
      text: '',
      content: '',
    });

    const params = {
      messages: [{role: 'user', content: 'Hi'}],
    } as any;

    await engine.completion(params);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{role: 'user', content: 'Hi'}],
        model: 'test-model',
        samplers: {},
        stop: undefined,
        stream: true,
      }),
      ENDPOINT,
      expect.any(Object),
      undefined,
    );
  });

  it('stopCompletion aborts the active request', async () => {
    // Start a completion that will be aborted
    let capturedSignal: AbortSignal | undefined;
    mockedStreamChat.mockImplementation(
      async (_p: any, _endpoint: any, signal: AbortSignal) => {
        capturedSignal = signal;
        return {text: '', content: ''};
      },
    );

    await engine.completion({messages: [{role: 'user', content: 'Hi'}]} as any);

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    await engine.stopCompletion();

    expect(capturedSignal!.aborted).toBe(true);
  });

  it('stopCompletion is safe to call when no active request', async () => {
    // Should not throw
    await engine.stopCompletion();
  });

  // The engine carries the timeoutMs it was constructed with and forwards it
  // raw (no normalization here) to streamChatCompletion. A rebuilt engine (on
  // the next setRemoteModel) therefore applies an edited value.
  it('forwards the constructed timeoutMs to streamChatCompletion', async () => {
    const timedEndpoint = {...ENDPOINT, timeoutMs: 600000};
    const timedEngine = new OpenAICompletionEngine(timedEndpoint);
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    await timedEngine.completion({
      messages: [{role: 'user', content: 'Hi'}],
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.any(Object),
      timedEndpoint, // raw timeoutMs forwarded, not normalized
      expect.any(Object), // AbortSignal
      undefined, // callback
    );
  });

  it('creates engine without api key', () => {
    const noKeyEndpoint: RemoteEndpoint = {
      url: 'http://localhost:1234',
      remoteModelId: 'model-id',
      serverType: 'unknown',
    };
    const noKeyEngine = new OpenAICompletionEngine(noKeyEndpoint);

    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    noKeyEngine.completion({messages: [{role: 'user', content: 'Hi'}]} as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.any(Object),
      noKeyEndpoint,
      expect.any(Object),
      undefined,
    );
  });

  it('forwards params.reasoning and the constructed serverType', async () => {
    const typedEndpoint: RemoteEndpoint = {...ENDPOINT, serverType: 'Ollama'};
    const typedEngine = new OpenAICompletionEngine(typedEndpoint);
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    await typedEngine.completion({
      messages: [{role: 'user', content: 'Hi'}],
      reasoning: {enabled: false},
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({reasoning: {enabled: false}}),
      typedEndpoint,
      expect.any(Object),
      undefined,
    );
  });

  it('forwards every explicitly enabled remote-only generation parameter', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: '', content: ''});

    await engine.completion({
      messages: [{role: 'user', content: 'Hi'}],
      top_k: 0,
      min_p: 0,
      xtc_threshold: 0,
      xtc_probability: 0,
      typical_p: 0,
      penalty_last_n: -1,
      penalty_repeat: 0,
      penalty_freq: 0,
      penalty_present: 0,
      mirostat: 0,
      mirostat_tau: 0,
      mirostat_eta: 0,
      seed: -1,
      n_probs: 0,
      jinja: false,
      enable_thinking: false,
      generationParameterModes: {
        top_k: 'send',
        min_p: 'send',
        xtc_threshold: 'send',
        xtc_probability: 'send',
        typical_p: 'send',
        penalty_last_n: 'send',
        penalty_repeat: 'send',
        penalty_freq: 'send',
        penalty_present: 'send',
        mirostat: 'send',
        mirostat_tau: 'send',
        mirostat_eta: 'send',
        seed: 'send',
        n_probs: 'send',
        jinja: 'send',
        enable_thinking: 'send',
      },
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        samplers: expect.objectContaining({
          top_k: 0,
          min_p: 0,
          xtc_threshold: 0,
          xtc_probability: 0,
          typical_p: 0,
          penalty_last_n: -1,
          penalty_repeat: 0,
          penalty_freq: 0,
          penalty_present: 0,
          mirostat: 0,
          mirostat_tau: 0,
          mirostat_eta: 0,
          seed: -1,
          n_probs: 0,
        }),
      }),
      expect.anything(),
      expect.any(AbortSignal),
      undefined,
    );
  });

  it('dispatches Responses with replay input and immutable binding', async () => {
    const responsesEngine = new OpenAICompletionEngine(
      {
        url: 'https://api.githubcopilot.com',
        remoteModelId: 'gpt-5.6-terra',
        apiKey: 'test-key',
        timeoutMs: 45000,
        serverType: 'GitHub Copilot',
      },
      {
        modelId: 'server-1/gpt-5.6-terra',
        serverId: 'server-1',
        remoteModelId: 'gpt-5.6-terra',
        url: 'https://api.githubcopilot.com',
        serverType: 'GitHub Copilot',
        wireApi: 'responses',
        credentialRevision: 3,
        protocolCapabilities: {
          advertisedEndpoints: ['responses'],
          reasoningEffortValues: ['low', 'high'],
        },
      },
    );
    mockedStreamResponses.mockResolvedValueOnce({
      text: 'done',
      content: 'done',
      terminal_status: 'completed',
    });

    const result = await responsesEngine.completion({
      messages: [{role: 'user', content: 'Synthetic request'}],
      tools: [],
      reasoning: {enabled: true, effort: 'high'},
    } as any);

    expect(mockedStreamChat).not.toHaveBeenCalled();
    expect(mockedStreamResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.6-terra',
        messages: [{role: 'user', content: 'Synthetic request'}],
        reasoning: {enabled: true, effort: 'high'},
      }),
      'https://api.githubcopilot.com',
      'test-key',
      expect.any(AbortSignal),
      undefined,
      45000,
      'GitHub Copilot',
      expect.objectContaining({
        wireApi: 'responses',
        serverId: 'server-1',
        modelId: 'gpt-5.6-terra',
        credentialRevision: 3,
      }),
      expect.objectContaining({
        input: [{role: 'user', content: 'Synthetic request'}],
        includeReasoningEncryptedContent: true,
        parameterPolicy: {
          sampling: {
            temperature: {
              supported: false,
              source: 'provider-verification',
              reasoningModes: ['absent'],
            },
          },
          reasoning: expect.objectContaining({
            supportsEffort: true,
            supportsEncryptedContent: true,
          }),
        },
      }),
    );
    expect(result.content).toBe('done');
  });

  it('does not apply provider evidence to Chat Completions', async () => {
    const chatEngine = new OpenAICompletionEngine({
      url: 'https://api.githubcopilot.com',
      remoteModelId: 'gpt-5.6-terra',
      apiKey: 'test-key',
      serverType: 'GitHub Copilot',
    });
    mockedStreamChat.mockResolvedValueOnce({text: 'ok', content: 'ok'});

    await chatEngine.completion({
      messages: [{role: 'user', content: 'test'}],
      temperature: 0.7,
      top_p: 0.9,
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        samplers: expect.objectContaining({temperature: 0.7, top_p: 0.9}),
      }),
      expect.anything(),
      expect.any(AbortSignal),
      undefined,
    );
    expect(mockedStreamResponses).not.toHaveBeenCalled();
  });

  it('strips Responses metadata before Chat Completions', async () => {
    mockedStreamChat.mockResolvedValueOnce({text: 'ok', content: 'ok'});
    await engine.completion({
      messages: [
        {
          role: 'assistant',
          content: 'prior',
          responsesState: {
            version: 1,
            binding: {
              wireApi: 'responses',
              serverUrl: 'https://other.test',
              modelId: 'other',
            },
            output: [],
            terminalStatus: 'completed',
          },
        },
      ],
    } as any);

    expect(mockedStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{role: 'assistant', content: 'prior'}],
      }),
      expect.anything(),
      expect.any(AbortSignal),
      undefined,
    );
  });
});

describe('OpenAICompletionEngine readiness', () => {
  const ENDPOINT: RemoteEndpoint = {
    url: 'http://localhost:8080',
    remoteModelId: 'router-model',
    serverType: 'llama.cpp',
  };
  const params = {messages: [{role: 'user', content: 'Hi'}]} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockedStreamChat.mockResolvedValue({text: 'ok', content: 'ok'});
  });

  it('waits for readiness before the request, then sends it', async () => {
    const order: string[] = [];
    const ensureReady = jest.fn(async (_signal: AbortSignal) => {
      order.push('ready');
    });
    mockedStreamChat.mockImplementationOnce(async () => {
      order.push('request');
      return {text: 'ok', content: 'ok'};
    });
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await engine.completion(params);

    expect(order).toEqual(['ready', 'request']);
    expect(ensureReady.mock.calls[0][0]).toBe(
      mockedStreamChat.mock.calls[0][2],
    );
  });

  it('rejects as withdrawn with no request when stopped while waiting', async () => {
    let signal!: AbortSignal;
    const engine = new OpenAICompletionEngine(ENDPOINT, {
      ensureReady: s =>
        new Promise(resolve => {
          signal = s;
          s.addEventListener('abort', () => resolve());
        }),
    });

    const pending = engine.completion(params);
    await Promise.resolve();
    await engine.stopCompletion();

    await expect(pending).rejects.toBeInstanceOf(
      RemoteModelRequestWithdrawnError,
    );
    expect(signal.aborted).toBe(true);
    expect(mockedStreamChat).not.toHaveBeenCalled();
  });

  it('passes a readiness failure through', async () => {
    const failure = new Error('not ready');
    const engine = new OpenAICompletionEngine(ENDPOINT, {
      ensureReady: () => Promise.reject(failure),
    });

    await expect(engine.completion(params)).rejects.toBe(failure);
    expect(mockedStreamChat).not.toHaveBeenCalled();
  });

  it('puts no timeout of its own on readiness', async () => {
    jest.useFakeTimers();
    const engine = new OpenAICompletionEngine(ENDPOINT, {
      ensureReady: () => new Promise(() => {}),
    });
    let settled = false;
    engine.completion(params).then(
      () => (settled = true),
      () => (settled = true),
    );

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('sends exactly as before when no readiness is given', async () => {
    const engine = new OpenAICompletionEngine(ENDPOINT);

    await engine.completion(params);

    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
    expect(mockedStreamChat.mock.calls[0][1]).toBe(ENDPOINT);
  });
});

describe('OpenAICompletionEngine when the router has unloaded the model', () => {
  const ENDPOINT: RemoteEndpoint = {
    url: 'http://localhost:8080',
    remoteModelId: 'router-model',
    serverType: 'llama.cpp',
  };
  const params = {messages: [{role: 'user', content: 'Hi'}]} as any;
  const body = routerWireJson('completion-not-loaded-400.json');
  const notLoaded = () =>
    new RemoteHttpError(
      `Server error: 400 — ${body.error.message}`,
      body.error.code,
      body.error.message,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStreamChat.mockResolvedValue({text: 'ok', content: 'ok'});
  });

  it('waits for the model again and sends once more', async () => {
    const ensureReady = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    mockedStreamChat.mockRejectedValueOnce(notLoaded());
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await expect(engine.completion(params)).resolves.toEqual({
      text: 'ok',
      content: 'ok',
    });
    expect(mockedStreamChat).toHaveBeenCalledTimes(2);
    expect(ensureReady).toHaveBeenCalledTimes(2);
    expect(ensureReady.mock.calls[1][1]).toEqual({reread: true});
  });

  it('surfaces a second refusal without a third request', async () => {
    const ensureReady = jest.fn().mockResolvedValue(true);
    const second = notLoaded();
    mockedStreamChat
      .mockRejectedValueOnce(notLoaded())
      .mockRejectedValueOnce(second);
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await expect(engine.completion(params)).rejects.toBe(second);
    expect(mockedStreamChat).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a plain server', async () => {
    const refusal = notLoaded();
    mockedStreamChat.mockRejectedValueOnce(refusal);
    const engine = new OpenAICompletionEngine(ENDPOINT);

    await expect(engine.completion(params)).rejects.toBe(refusal);
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });

  it('does not retry when no router made the model ready', async () => {
    const ensureReady = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    const refusal = notLoaded();
    mockedStreamChat.mockRejectedValueOnce(refusal);
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await expect(engine.completion(params)).rejects.toBe(refusal);
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });

  it('does not retry once a token has streamed', async () => {
    const ensureReady = jest.fn().mockResolvedValue(true);
    const refusal = notLoaded();
    mockedStreamChat.mockImplementationOnce(async (_p, _e, _s, onData) => {
      onData({content: 'partial'});
      throw refusal;
    });
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await expect(engine.completion(params, jest.fn())).rejects.toBe(refusal);
    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('does not retry another refusal', async () => {
    const ensureReady = jest.fn().mockResolvedValue(true);
    const other = new RemoteHttpError(
      'Server error: 400 — bad request',
      400,
      'bad request',
    );
    mockedStreamChat.mockRejectedValueOnce(other);
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    await expect(engine.completion(params)).rejects.toBe(other);
    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('withdraws the turn when stopped during the second wait', async () => {
    const ensureReady = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        (signal: AbortSignal) =>
          new Promise(resolve =>
            signal.addEventListener('abort', () => resolve(false)),
          ),
      );
    mockedStreamChat.mockRejectedValueOnce(notLoaded());
    const engine = new OpenAICompletionEngine(ENDPOINT, {ensureReady});

    const pending = engine.completion(params);
    await new Promise(resolve => setImmediate(resolve));
    expect(ensureReady).toHaveBeenCalledTimes(2);
    await engine.stopCompletion();

    await expect(pending).rejects.toBeInstanceOf(
      RemoteModelRequestWithdrawnError,
    );
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });
});
