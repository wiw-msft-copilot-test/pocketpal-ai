import {AgentStep, MessageType, User} from '../../utils/types';
import {isResponsesReplayState} from '../../api/responsesTypes';

export interface StoredMessageFields {
  id: string;
  author: string;
  type: string;
  text?: string;
  createdAt: number;
  metadata?: string;
}

const parseMetadata = (metadata?: string): Record<string, any> => {
  try {
    const parsed = JSON.parse(metadata || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const readableSteps = (value: unknown, legacyText?: string): AgentStep[] => {
  const steps = Array.isArray(value)
    ? value.filter(
        (step): step is AgentStep =>
          !!step && typeof step === 'object' && !Array.isArray(step),
      )
    : [];
  const sanitized = steps.map(step => {
    if (
      step.responsesState !== undefined &&
      !isResponsesReplayState(step.responsesState)
    ) {
      const visibleStep = {...step};
      delete visibleStep.responsesState;
      return visibleStep;
    }
    return step;
  });
  return sanitized.length === 0 && legacyText
    ? [{content: legacyText}]
    : sanitized;
};

export const decodeStoredMessage = ({
  id,
  author: authorId,
  type,
  text,
  createdAt,
  metadata,
}: StoredMessageFields): MessageType.Any => {
  const rawMetadata = parseMetadata(metadata);
  const author: User = {
    id: authorId,
    ...(rawMetadata.authorData || {}),
  };

  if (type === 'text') {
    return {
      id,
      type: 'text',
      text: text || '',
      author,
      createdAt,
      metadata: rawMetadata,
      imageUris: rawMetadata.imageUris,
    } as MessageType.Text;
  }

  if (type === 'assistant_turn') {
    const {steps: liftedSteps, ...metadataWithoutSteps} = rawMetadata;
    return {
      id,
      type: 'assistant_turn',
      author,
      createdAt,
      steps: readableSteps(liftedSteps, text),
      metadata: metadataWithoutSteps,
    } as MessageType.AssistantTurn;
  }

  return {
    id,
    type: type as any,
    author,
    createdAt,
    metadata: rawMetadata,
  } as any;
};
