import {LlamaContext} from 'llama.rn';

import {streamChatCompletion} from './openai';
import type {StreamChatParams} from './openai';
import {streamResponses} from './responses';
import {buildResponsesReplayInput} from '../utils/responsesReplay';
import {
  ApiCompletionParams,
  CompletionEngine,
  CompletionResult,
  CompletionStreamData,
} from '../utils/completionTypes';
import type {ChatMessage, RemoteSessionBinding} from '../utils/types';
import {applyGenerationParameterModes} from '../utils/generationParameterModes';
import {resolveResponsesSamplingCapabilities} from '../utils/remoteProtocol';

function explicitRemoteGenerationParams(
  params: ApiCompletionParams,
): Partial<StreamChatParams> {
  const modes = params.generationParameterModes;
  return {
    ...(modes?.top_k === 'send' ? {top_k: params.top_k} : {}),
    ...(modes?.min_p === 'send' ? {min_p: params.min_p} : {}),
    ...(modes?.xtc_threshold === 'send'
      ? {xtc_threshold: params.xtc_threshold}
      : {}),
    ...(modes?.xtc_probability === 'send'
      ? {xtc_probability: params.xtc_probability}
      : {}),
    ...(modes?.typical_p === 'send' ? {typical_p: params.typical_p} : {}),
    ...(modes?.penalty_last_n === 'send'
      ? {penalty_last_n: params.penalty_last_n}
      : {}),
    ...(modes?.penalty_repeat === 'send'
      ? {penalty_repeat: params.penalty_repeat}
      : {}),
    ...(modes?.penalty_freq === 'send'
      ? {penalty_freq: params.penalty_freq}
      : {}),
    ...(modes?.penalty_present === 'send'
      ? {penalty_present: params.penalty_present}
      : {}),
    ...(modes?.mirostat === 'send' ? {mirostat: params.mirostat} : {}),
    ...(modes?.mirostat_tau === 'send'
      ? {mirostat_tau: params.mirostat_tau}
      : {}),
    ...(modes?.mirostat_eta === 'send'
      ? {mirostat_eta: params.mirostat_eta}
      : {}),
    ...(modes?.seed === 'send' ? {seed: params.seed} : {}),
    ...(modes?.n_probs === 'send' ? {n_probs: params.n_probs} : {}),
    ...(modes?.jinja === 'send' ? {jinja: params.jinja} : {}),
    ...(modes?.enable_thinking === 'send'
      ? {enable_thinking: params.enable_thinking}
      : {}),
  };
}

function stripResponsesState(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.map(
    ({responsesState: _responsesState, ...message}) => message,
  );
}

export class LocalCompletionEngine implements CompletionEngine {
  constructor(private context: LlamaContext) {}

  async completion(
    params: ApiCompletionParams,
    callback?: (data: CompletionStreamData) => void,
  ): Promise<CompletionResult> {
    const messages = stripResponsesState(
      (params.messages ?? []) as ChatMessage[],
    );
    const result = await this.context.completion(
      applyGenerationParameterModes({...params, messages}),
      callback
        ? data => {
            callback({
              token: data.token,
              content: data.content,
              reasoning_content: data.reasoning_content,
              tool_calls: data.tool_calls,
              accumulated_text: data.accumulated_text,
            });
          }
        : undefined,
    );
    return {
      text: result.text,
      content: result.content,
      reasoning_content: result.reasoning_content,
      tool_calls: result.tool_calls,
      timings: result.timings,
      tokens_predicted: result.tokens_predicted,
      tokens_evaluated: result.tokens_evaluated,
      draft_tokens: result.draft_tokens,
      draft_tokens_accepted: result.draft_tokens_accepted,
      truncated: result.truncated,
      stopped_eos: result.stopped_eos,
      stopped_limit: result.stopped_limit,
      stopped_word: result.stopped_word,
      stopping_word: result.stopping_word,
      context_full: result.context_full,
      interrupted: result.interrupted,
    };
  }

  async stopCompletion(): Promise<void> {
    await this.context.stopCompletion();
  }
}

export class OpenAICompletionEngine implements CompletionEngine {
  private abortController: AbortController | null = null;

  constructor(
    private serverUrl: string,
    private modelId: string,
    private apiKey?: string,
    private timeoutMs?: number,
    private serverType?: string,
    private binding?: RemoteSessionBinding,
  ) {}

  async completion(
    params: ApiCompletionParams,
    callback?: (data: CompletionStreamData) => void,
  ): Promise<CompletionResult> {
    this.abortController = new AbortController();

    const messages = (params.messages ?? []) as ChatMessage[];
    const requestParams = {
      ...explicitRemoteGenerationParams(params),
      messages,
      model: this.modelId,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.n_predict,
      stop: params.stop,
      stream: true as const,
      // llama.rn's tool types are wire-compatible with the remote adapters.
      tools: params.tools as StreamChatParams['tools'],
      tool_choice: params.tool_choice as StreamChatParams['tool_choice'],
      response_format:
        params.response_format as StreamChatParams['response_format'],
      reasoning: params.reasoning,
      generationParameterModes: params.generationParameterModes,
    };

    if (this.binding?.wireApi === 'responses') {
      const responsesBinding = {
        wireApi: 'responses' as const,
        serverId: this.binding.serverId,
        serverUrl: this.binding.url,
        serverType: this.binding.serverType,
        modelId: this.binding.remoteModelId,
        credentialRevision: this.binding.credentialRevision,
      };
      const capabilities = this.binding.protocolCapabilities;
      const effortValues = capabilities?.reasoningEffortValues ?? [];
      const supportsEncryptedContent =
        this.serverType === 'OpenAI' || this.serverType === 'GitHub Copilot';

      return streamResponses(
        requestParams,
        this.serverUrl,
        this.apiKey,
        this.abortController.signal,
        callback,
        this.timeoutMs,
        this.serverType,
        responsesBinding,
        {
          input: buildResponsesReplayInput(messages, {
            binding: responsesBinding,
            messageMetadata: messages.map(message => ({
              responsesState: message.responsesState,
            })),
          }),
          parameterPolicy: {
            sampling: resolveResponsesSamplingCapabilities({
              serverType: this.serverType,
              modelId: this.modelId,
              wireApi: this.binding.wireApi,
              catalogCapabilities: capabilities,
            }),
            reasoning: {
              supportsEffort: effortValues.length > 0,
              disabledEffort: effortValues.includes('none')
                ? 'none'
                : undefined,
              supportsEncryptedContent,
            },
          },
          includeReasoningEncryptedContent:
            supportsEncryptedContent && params.reasoning?.enabled === true,
        },
      );
    }

    return streamChatCompletion(
      {
        ...requestParams,
        messages: stripResponsesState(messages),
      },
      this.serverUrl,
      this.apiKey,
      this.abortController.signal,
      callback,
      this.timeoutMs,
      this.serverType,
    );
  }

  async stopCompletion(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}
