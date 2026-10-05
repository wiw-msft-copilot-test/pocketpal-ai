import {
  chatSessionStore,
  createStartupModelSelection,
  modelStore,
  palStore,
  serverStore,
  type StartupModelSelection,
} from '../store';
import {loadValidatedModelSelection} from './startupSelection';
import {hasVideoCapability} from '../utils/pal-capabilities';
import {Model, ModelOrigin} from '../utils/types';

export interface VoiceChatSelectionResult {
  ready: boolean;
  replacePal: boolean;
  palId?: string;
}

interface VoiceChatSelectionOptions {
  shouldContinue?: () => boolean;
}

const selectionForModel = (model: Model): StartupModelSelection | null => {
  if (model.origin !== ModelOrigin.REMOTE) {
    return createStartupModelSelection(model);
  }
  const server = model.serverId
    ? serverStore.servers.find(candidate => candidate.id === model.serverId)
    : undefined;
  return server ? createStartupModelSelection(model, server) : null;
};

const modelCandidates = (preferredModelId?: string): Model[] => {
  const candidates = preferredModelId
    ? [
        modelStore.availableModels.find(model => model.id === preferredModelId),
        ...modelStore.availableModels,
      ]
    : modelStore.availableModels;
  const seen = new Set<string>();
  return candidates.filter((model): model is Model => {
    if (!model || seen.has(model.id)) {
      return false;
    }
    seen.add(model.id);
    return true;
  });
};

export const prepareVoiceChatSelection = async (
  options: VoiceChatSelectionOptions = {},
): Promise<VoiceChatSelectionResult> => {
  const shouldContinue = options.shouldContinue ?? (() => true);
  if (!shouldContinue()) {
    return {ready: false, replacePal: false};
  }

  const activePal = palStore.pals.find(
    pal => pal.id === chatSessionStore.activePalId,
  );
  const replacementPal =
    activePal && hasVideoCapability(activePal)
      ? palStore.pals.find(pal => !hasVideoCapability(pal))
      : undefined;

  if (activePal && hasVideoCapability(activePal) && !replacementPal) {
    return {ready: false, replacePal: false};
  }

  if (!modelStore.engine) {
    const preferredModelId = (replacementPal ?? activePal)?.defaultModel?.id;
    for (const model of modelCandidates(preferredModelId)) {
      if (!shouldContinue()) {
        return {ready: false, replacePal: false};
      }
      const selection = selectionForModel(model);
      if (!selection) {
        continue;
      }
      try {
        await loadValidatedModelSelection(selection, modelStore.selectModel);
        if (!shouldContinue()) {
          return {ready: false, replacePal: false};
        }
        if (modelStore.engine) {
          break;
        }
      } catch (error) {
        console.warn(
          `[VoiceChatLauncher] Failed fallback model "${model.id}":`,
          error,
        );
      }
    }
  }

  if (!modelStore.engine) {
    return {ready: false, replacePal: false};
  }

  return replacementPal
    ? {ready: true, replacePal: true, palId: replacementPal.id}
    : {ready: true, replacePal: false};
};
