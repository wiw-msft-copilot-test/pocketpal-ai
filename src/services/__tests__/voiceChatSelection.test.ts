jest.unmock('../../store');

import {runInAction} from 'mobx';

import {prepareVoiceChatSelection} from '../voiceChatSelection';
import {chatSessionStore, modelStore, palStore, serverStore} from '../../store';
import {Model, ModelOrigin} from '../../utils/types';

const originalSelectModel = modelStore.selectModel;

const localModel = (id: string) =>
  ({
    id,
    name: id,
    origin: ModelOrigin.LOCAL,
    modelType: 'llm',
    isDownloaded: true,
  }) as any;

const pal = (
  id: string,
  options: {video?: boolean; defaultModelId?: string} = {},
) =>
  ({
    id,
    name: id,
    capabilities: options.video ? {video: true} : {},
    defaultModel: options.defaultModelId
      ? {id: options.defaultModelId}
      : undefined,
  }) as any;

describe('prepareVoiceChatSelection', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    runInAction(() => {
      chatSessionStore.activeSessionId = null;
      chatSessionStore.newChatPalId = undefined;
      modelStore.models = [];
      modelStore.engine = undefined;
      modelStore.activeModelId = undefined;
      palStore.pals = [];
      serverStore.servers = [];
      serverStore.userSelectedModels = [];
      serverStore.serverModels.clear();
    });
    modelStore.selectModel = originalSelectModel;
  });

  afterAll(async () => {
    modelStore.selectModel = originalSelectModel;
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('keeps a loaded model and replaces a video Pal', async () => {
    const videoPal = pal('video', {video: true});
    const voicePal = pal('voice');
    palStore.pals = [videoPal, voicePal];
    chatSessionStore.newChatPalId = videoPal.id;
    modelStore.engine = {} as any;
    const selectModel = jest.fn();
    modelStore.selectModel = selectModel;

    const result = await prepareVoiceChatSelection();

    expect(result).toEqual({
      ready: true,
      replacePal: true,
      palId: voicePal.id,
    });
    expect(selectModel).not.toHaveBeenCalled();
  });

  it('prefers the replacement Pal default model when loading is required', async () => {
    const firstModel = localModel('first-model');
    const defaultModel = localModel('default-model');
    const videoPal = pal('video', {video: true});
    const voicePal = pal('voice', {defaultModelId: defaultModel.id});
    modelStore.models = [firstModel, defaultModel];
    palStore.pals = [videoPal, voicePal];
    chatSessionStore.newChatPalId = videoPal.id;
    const selectModel = jest.fn(async (model: Model) => {
      runInAction(() => {
        modelStore.activeModelId = model.id;
        modelStore.engine = {} as any;
      });
    });
    modelStore.selectModel = selectModel;

    const result = await prepareVoiceChatSelection();

    expect(selectModel).toHaveBeenCalledTimes(1);
    expect(selectModel).toHaveBeenCalledWith(defaultModel);
    expect(result).toEqual({
      ready: true,
      replacePal: true,
      palId: voicePal.id,
    });
  });

  it('tries another available model after a candidate fails', async () => {
    const failedModel = localModel('failed-model');
    const workingModel = localModel('working-model');
    const voicePal = pal('voice', {defaultModelId: failedModel.id});
    modelStore.models = [failedModel, workingModel];
    palStore.pals = [voicePal];
    chatSessionStore.newChatPalId = voicePal.id;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const selectModel = jest.fn(async (model: Model) => {
      if (model.id === failedModel.id) {
        throw new Error('load failed');
      }
      runInAction(() => {
        modelStore.activeModelId = model.id;
        modelStore.engine = {} as any;
      });
    });
    modelStore.selectModel = selectModel;

    const result = await prepareVoiceChatSelection();

    expect(selectModel).toHaveBeenNthCalledWith(1, failedModel);
    expect(selectModel).toHaveBeenNthCalledWith(2, workingModel);
    expect(result).toEqual({ready: true, replacePal: false});
  });

  it('validates and loads an available configured remote model', async () => {
    palStore.pals = [pal('voice')];
    chatSessionStore.newChatPalId = 'voice';
    serverStore.servers = [
      {
        id: 'server-1',
        name: 'Server',
        url: 'https://example.test/v1',
        serverType: 'OpenAI',
        apiMode: 'chat-completions',
        credentialRevision: 2,
      },
    ];
    serverStore.userSelectedModels = [
      {serverId: 'server-1', remoteModelId: 'model-a'},
    ];
    const connection = jest
      .spyOn(serverStore, 'testServerConnection')
      .mockResolvedValue({ok: true, modelCount: 1});
    const selectModel = jest.fn(async (model: Model) => {
      runInAction(() => {
        modelStore.activeModelId = model.id;
        modelStore.engine = {} as any;
      });
    });
    modelStore.selectModel = selectModel;

    const result = await prepareVoiceChatSelection();

    expect(connection).toHaveBeenCalledWith('server-1');
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'server-1/model-a'}),
    );
    expect(result).toEqual({ready: true, replacePal: false});
  });

  it('fails when no non-video Pal is available', async () => {
    const videoPal = pal('video', {video: true});
    palStore.pals = [videoPal];
    chatSessionStore.newChatPalId = videoPal.id;
    modelStore.engine = {} as any;

    await expect(prepareVoiceChatSelection()).resolves.toEqual({
      ready: false,
      replacePal: false,
    });
  });

  it('fails when no model can be loaded', async () => {
    palStore.pals = [pal('voice')];
    chatSessionStore.newChatPalId = 'voice';

    await expect(prepareVoiceChatSelection()).resolves.toEqual({
      ready: false,
      replacePal: false,
    });
  });

  it('stops preparing when the launcher request is no longer active', async () => {
    const model = localModel('fallback-model');
    modelStore.models = [model];
    palStore.pals = [pal('voice')];
    chatSessionStore.newChatPalId = 'voice';
    const selectModel = jest.fn(async () => {
      runInAction(() => {
        modelStore.engine = {} as any;
      });
    });
    modelStore.selectModel = selectModel;
    const shouldContinue = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    const result = await prepareVoiceChatSelection({shouldContinue});

    expect(selectModel).toHaveBeenCalledWith(model);
    expect(result).toEqual({ready: false, replacePal: false});
  });
});
