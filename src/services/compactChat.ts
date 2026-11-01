import {toJS} from 'mobx';
import {chatSessionStore, modelStore} from '../store';
import {convertToChatMessages} from '../utils/chat';
import type {ChatMessage} from '../utils/types';
import {chatRunControl} from './chatRunControl';
import {
  CompactionError,
  compactionFingerprint,
  compactionReplacement,
  compactionRequest,
  compactionTurns,
} from './compaction';

export async function compactChat(
  sessionId: string,
  guidance: string,
  summaryLabel: string,
): Promise<void> {
  if (
    chatSessionStore.activeSessionId !== sessionId ||
    chatSessionStore.isGenerating ||
    chatSessionStore.isStopping ||
    chatRunControl.isSwitchingSession ||
    modelStore.isContextLoading ||
    modelStore.hasPendingModelOperations
  ) {
    throw new CompactionError('unavailable');
  }
  const lease = modelStore.tryAcquireGeneration();
  if (!lease) {
    throw new CompactionError('unavailable');
  }
  const runToken = chatRunControl.beginRun(() => lease.abort());
  chatSessionStore.setIsGenerating(true);
  try {
    const session = chatSessionStore.sessions.find(
      item => item.id === sessionId,
    );
    if (!session || !session.messages.length) {
      throw new CompactionError('unavailable');
    }
    const source = toJS(session.messages);
    const fingerprint = compactionFingerprint(source);
    const modelId = modelStore.activeModelId;
    const context = modelStore.context;
    const caps = modelStore.activeModelCaps;
    const vision = context
      ? modelStore.isMultimodalActive
      : caps.vision === 'yes';
    const countTokens = async (messages: ChatMessage[]) => {
      if (context) {
        const formatted = await context.getFormattedChat(messages);
        const tokenized = await context.tokenize(formatted.prompt, {
          media_paths: formatted.media_paths,
        });
        return tokenized.tokens.length;
      }
      // Remote tokenizers are not exposed. Use a conservative text estimate;
      // the server remains authoritative for image costs and overflow.
      return messages.reduce(
        (total, message) => total + JSON.stringify(message).length,
        0,
      );
    };
    const turns = compactionTurns(source);
    const messages = compactionRequest(turns, guidance.trim(), vision);
    const window = caps.effectiveContextLength;
    const outputBudget = Math.min(2048, Math.floor((window ?? 8192) / 4));
    if (window && (await countTokens(messages)) + outputBudget >= window) {
      throw new CompactionError('overflow');
    }
    if (lease.signal.aborted) {
      throw new CompactionError('changed');
    }
    let stopPromise: Promise<void> | undefined;
    const abort = () => {
      stopPromise = lease.engine.stopCompletion();
      // The rejection is also awaited below; attach immediately to prevent
      // an unhandled rejection while the completion is draining.
      stopPromise.catch(() => undefined);
    };
    lease.signal.addEventListener('abort', abort);
    let result;
    try {
      result = await lease.engine.completion({
        messages,
        n_predict: outputBudget,
        temperature: 0.2,
        enable_thinking: false,
        reasoning: {enabled: false},
        reasoning_format: 'auto',
        jinja: true,
      });
    } finally {
      lease.signal.removeEventListener('abort', abort);
      await stopPromise;
    }
    const replacement = compactionReplacement(turns, result, summaryLabel);
    const settings = await chatSessionStore.getCurrentCompletionSettings(
      modelStore.activeModelCompletionSettings,
    );
    const system: ChatMessage[] = settings.prompt
      ? [{role: 'system', content: settings.prompt}]
      : [];
    const before = await countTokens([
      ...system,
      ...convertToChatMessages(source, vision),
    ]);
    const after = await countTokens([
      ...system,
      ...convertToChatMessages(replacement, vision),
    ]);
    if (after >= before || (window && after + outputBudget >= window)) {
      throw new CompactionError('noReduction');
    }
    if (
      lease.signal.aborted ||
      chatSessionStore.activeSessionId !== sessionId ||
      modelStore.activeModelId !== modelId ||
      compactionFingerprint(session.messages) !== fingerprint
    ) {
      throw new CompactionError('changed');
    }
    await chatSessionStore.replaceCompactedHistory(
      sessionId,
      source,
      replacement,
      () =>
        !lease.signal.aborted &&
        chatSessionStore.activeSessionId === sessionId &&
        modelStore.activeModelId === modelId &&
        compactionFingerprint(session.messages) === fingerprint,
    );
  } finally {
    chatSessionStore.setIsGenerating(false);
    chatRunControl.endRun(runToken);
    lease.end();
  }
}
