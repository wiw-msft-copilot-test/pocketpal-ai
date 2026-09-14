import type {
  CompletionResult,
  CompletionResultSnapshot,
} from '../../utils/completionTypes';

export function completionResultSnapshot(
  result: CompletionResult,
  isRemote: boolean,
): CompletionResultSnapshot {
  const used = (result.tokens_evaluated ?? 0) + (result.tokens_predicted ?? 0);
  const finishReason =
    result.incomplete_reason === 'max_output_tokens'
      ? 'output-limit'
      : isRemote &&
          result.terminal_status === undefined &&
          result.stopped_limit === 1
        ? 'length'
        : undefined;

  return {
    content: result.content,
    reasoning_content: result.reasoning_content,
    used,
    contextFull:
      result.context_full === true ||
      result.truncated === true ||
      finishReason === 'length',
    tokensPredicted: result.tokens_predicted,
    finishReason,
    terminalStatus: result.terminal_status,
    incompleteReason: result.incomplete_reason,
    refusal: result.refusal,
    isRemote,
  };
}

export function responsesOutcomeMetadata(result: CompletionResult): {
  interrupted?: true;
  responseStatus?: string;
  incompleteReason?: CompletionResult['incomplete_reason'];
} {
  return {
    ...(result.interrupted ? {interrupted: true as const} : {}),
    ...(result.refusal
      ? {responseStatus: 'refused'}
      : result.terminal_status
        ? {responseStatus: result.terminal_status}
        : {}),
    ...(result.incomplete_reason
      ? {incompleteReason: result.incomplete_reason}
      : {}),
  };
}
