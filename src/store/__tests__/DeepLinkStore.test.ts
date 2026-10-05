import {deepLinkStore} from '../DeepLinkStore';

describe('DeepLinkStore voice conversation requests', () => {
  beforeEach(() => {
    deepLinkStore.pendingVoiceConversationRequestId = null;
    deepLinkStore.preparedVoiceConversationRequestId = null;
  });

  it('uses distinct request IDs and consumes only the current request', () => {
    deepLinkStore.requestVoiceConversation();
    const first = deepLinkStore.pendingVoiceConversationRequestId;

    deepLinkStore.requestVoiceConversation();
    const second = deepLinkStore.pendingVoiceConversationRequestId;

    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(deepLinkStore.preparedVoiceConversationRequestId).toBeNull();

    deepLinkStore.consumeVoiceConversationRequest(first!);
    expect(deepLinkStore.pendingVoiceConversationRequestId).toBe(second);

    deepLinkStore.consumeVoiceConversationRequest(second!);
    expect(deepLinkStore.pendingVoiceConversationRequestId).toBeNull();
    expect(deepLinkStore.preparedVoiceConversationRequestId).toBeNull();
  });

  it('marks only the current request as prepared', () => {
    deepLinkStore.requestVoiceConversation();
    const first = deepLinkStore.pendingVoiceConversationRequestId!;
    deepLinkStore.requestVoiceConversation();
    const second = deepLinkStore.pendingVoiceConversationRequestId!;

    deepLinkStore.markVoiceConversationPrepared(first);
    expect(deepLinkStore.preparedVoiceConversationRequestId).toBeNull();

    deepLinkStore.markVoiceConversationPrepared(second);
    expect(deepLinkStore.preparedVoiceConversationRequestId).toBe(second);
  });

  it('clears the current request without requiring its ID', () => {
    deepLinkStore.requestVoiceConversation();
    deepLinkStore.markVoiceConversationPrepared(
      deepLinkStore.pendingVoiceConversationRequestId!,
    );

    deepLinkStore.clearVoiceConversationRequest();

    expect(deepLinkStore.pendingVoiceConversationRequestId).toBeNull();
    expect(deepLinkStore.preparedVoiceConversationRequestId).toBeNull();
  });
});
