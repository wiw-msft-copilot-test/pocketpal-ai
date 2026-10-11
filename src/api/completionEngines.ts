import {LlamaContext} from 'llama.rn';

import {streamChatCompletion} from './openai';
import type {StreamChatParams} from './openai';
import {streamResponses} from './responses';
import {buildResponsesReplayInput} from '../utils/responsesReplay';
import type {RemoteEndpoint} from './servers';
import {profileFor} from './servers';
import {pickSamplers} from '../utils/samplerParams';
import {
  ApiCompletionParams,
  CompletionEngine,
  CompletionResult,
  CompletionStreamData,
  normaliseTimings,
} from '../utils/completionTypes';
import type {ChatMessage, RemoteSessionBinding} from '../utils/types';
import {applyGenerationParameterModes} from '../utils/generationParameterModes';
import {resolveResponsesSamplingCapabilities} from '../utils/remoteProtocol';
import {explicitRemoteGenerationParams} from '../services/remote/remoteCompletionPolicy';

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
      timings: normaliseTimings(result.timings),
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
    private endpoint: RemoteEndpoint,
    private binding?: RemoteSessionBinding,
  ) {}

  async completion(
    params: ApiCompletionParams,
    callback?: (data: CompletionStreamData) => void,
  ): Promise<CompletionResult> {
    this.abortController = new AbortController();

    const messages = (params.messages ?? []) as ChatMessage[];
    const samplers = pickSamplers(params);
    const effectiveParams = applyGenerationParameterModes(params);
    const requestParams = {
      ...explicitRemoteGenerationParams(effectiveParams),
      messages,
      model: this.endpoint.remoteModelId,
      temperature: effectiveParams.temperature,
      top_p: effectiveParams.top_p,
      max_tokens: effectiveParams.n_predict,
      stop: effectiveParams.stop,
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
        profileFor(this.endpoint.serverType).supportsEncryptedReasoning ===
        true;

      return streamResponses(
        requestParams,
        this.endpoint.url,
        this.endpoint.apiKey,
        this.abortController.signal,
        callback,
        this.endpoint.timeoutMs,
        this.endpoint.serverType,
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
              serverType: this.endpoint.serverType,
              modelId: this.endpoint.remoteModelId,
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
        messages: stripResponsesState(messages),
        model: this.endpoint.remoteModelId,
        samplers,
        stop: effectiveParams.stop,
        stream: true,
        // llama.rn's `tools` typedef is structurally compatible with OpenAI's
        // function-tool shape but lives under a different name.
        tools: params.tools as StreamChatParams['tools'],
        tool_choice: params.tool_choice as StreamChatParams['tool_choice'],
        response_format:
          params.response_format as StreamChatParams['response_format'],
        // Reasoning intent carried on the params; the server profile owns the wire shape.
        reasoning: params.reasoning,
        generationParameterModes: params.generationParameterModes,
      },
      this.endpoint,
      this.abortController.signal,
      callback,
    );
  }

  async stopCompletion(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}
