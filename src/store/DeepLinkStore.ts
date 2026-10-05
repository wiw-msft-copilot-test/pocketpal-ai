import {makeAutoObservable, runInAction} from 'mobx';

import type {HubRunRequest} from '../services/hubRunLink';

/**
 * DeepLinkStore
 *
 * Manages deep link state in a React-friendly way using MobX.
 * Replaces module-level state to avoid issues with Fast Refresh and module reloading.
 */
class DeepLinkStore {
  pendingMessage: string | null = null;
  pendingHubRun: HubRunRequest | null = null;
  pendingVoiceConversationRequestId: number | null = null;
  preparedVoiceConversationRequestId: number | null = null;
  private nextVoiceConversationRequestId = 1;

  constructor() {
    makeAutoObservable(this);
  }

  setPendingMessage(message: string | null) {
    runInAction(() => {
      this.pendingMessage = message;
    });
  }

  clearPendingMessage() {
    runInAction(() => {
      this.pendingMessage = null;
    });
  }

  setPendingHubRun(request: HubRunRequest | null) {
    runInAction(() => {
      this.pendingHubRun = request;
    });
  }

  clearPendingHubRun() {
    runInAction(() => {
      this.pendingHubRun = null;
    });
  }

  requestVoiceConversation() {
    runInAction(() => {
      this.pendingVoiceConversationRequestId = this
        .nextVoiceConversationRequestId++;
      this.preparedVoiceConversationRequestId = null;
    });
  }

  clearVoiceConversationRequest() {
    runInAction(() => {
      this.pendingVoiceConversationRequestId = null;
      this.preparedVoiceConversationRequestId = null;
    });
  }

  markVoiceConversationPrepared(requestId: number) {
    runInAction(() => {
      if (this.pendingVoiceConversationRequestId === requestId) {
        this.preparedVoiceConversationRequestId = requestId;
      }
    });
  }

  consumeVoiceConversationRequest(requestId: number) {
    runInAction(() => {
      if (this.pendingVoiceConversationRequestId === requestId) {
        this.pendingVoiceConversationRequestId = null;
        this.preparedVoiceConversationRequestId = null;
      }
    });
  }
}

export const deepLinkStore = new DeepLinkStore();
