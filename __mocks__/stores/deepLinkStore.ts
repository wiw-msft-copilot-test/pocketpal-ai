/**
 * Mock DeepLinkStore for testing
 */

import type {HubRunRequest} from '../../src/services/hubRunLink';
import {makeAutoObservable} from 'mobx';

export class DeepLinkStore {
  pendingMessage: string | null = null;
  pendingHubRun: HubRunRequest | null = null;
  pendingVoiceConversationRequestId: number | null = null;
  preparedVoiceConversationRequestId: number | null = null;
  private nextVoiceConversationRequestId = 1;

  constructor() {
    makeAutoObservable(this, {
      setPendingMessage: false,
      clearPendingMessage: false,
      setPendingHubRun: false,
      clearPendingHubRun: false,
      requestVoiceConversation: false,
      clearVoiceConversationRequest: false,
      markVoiceConversationPrepared: false,
      consumeVoiceConversationRequest: false,
    });
  }

  setPendingMessage = jest.fn((message: string | null) => {
    this.pendingMessage = message;
  });

  clearPendingMessage = jest.fn(() => {
    this.pendingMessage = null;
  });

  setPendingHubRun = jest.fn((request: HubRunRequest | null) => {
    this.pendingHubRun = request;
  });

  clearPendingHubRun = jest.fn(() => {
    this.pendingHubRun = null;
  });

  requestVoiceConversation = jest.fn(() => {
    this.pendingVoiceConversationRequestId = this
      .nextVoiceConversationRequestId++;
    this.preparedVoiceConversationRequestId = null;
  });

  clearVoiceConversationRequest = jest.fn(() => {
    this.pendingVoiceConversationRequestId = null;
    this.preparedVoiceConversationRequestId = null;
  });

  markVoiceConversationPrepared = jest.fn((requestId: number) => {
    if (this.pendingVoiceConversationRequestId === requestId) {
      this.preparedVoiceConversationRequestId = requestId;
    }
  });

  consumeVoiceConversationRequest = jest.fn((requestId: number) => {
    if (this.pendingVoiceConversationRequestId === requestId) {
      this.pendingVoiceConversationRequestId = null;
      this.preparedVoiceConversationRequestId = null;
    }
  });
}

export const deepLinkStore = new DeepLinkStore();
