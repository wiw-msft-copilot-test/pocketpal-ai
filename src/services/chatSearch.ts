import {decodeStoredMessage} from '../database/models/messageDecoder';
import {
  chatSessionRepository,
  ChatSearchMessageRow,
} from '../repositories/ChatSessionRepository';
import {derivedText} from '../utils/chat';
import {
  ChatSearchResult,
  createChatSearchAccumulator,
} from '../utils/chatSearch';

export interface ChatSearchProgress {
  results: ChatSearchResult[];
  recordsVisited: number;
  complete: false;
}

export interface ChatSearchRequest {
  query: string;
  signal: AbortSignal;
  onProgress?: (progress: ChatSearchProgress) => void;
}

export interface ChatSearchProvider {
  search(request: ChatSearchRequest): Promise<ChatSearchResult[]>;
}

export class ChatSearchAbortedError extends Error {
  constructor() {
    super('Chat search aborted');
    this.name = 'ChatSearchAbortedError';
  }
}

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new ChatSearchAbortedError();
  }
};

const PAGE_SIZE = 100;

export class LocalChatSearchProvider implements ChatSearchProvider {
  async search({
    query,
    signal,
    onProgress,
  }: ChatSearchRequest): Promise<ChatSearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }
    throwIfAborted(signal);
    const [sessions, upperBound] = await Promise.all([
      chatSessionRepository.getChatSearchSessions(),
      chatSessionRepository.getChatSearchMessageUpperBound(),
    ]);
    throwIfAborted(signal);

    const accumulator = createChatSearchAccumulator(sessions, normalizedQuery);
    let cursor: string | null = null;
    let recordsVisited = 0;

    while (upperBound) {
      throwIfAborted(signal);
      const page = await chatSessionRepository.getChatSearchMessagePage(
        cursor,
        upperBound,
        PAGE_SIZE,
      );
      throwIfAborted(signal);
      if (page.length === 0) {
        break;
      }
      page.forEach((row: ChatSearchMessageRow) => {
        throwIfAborted(signal);
        const message = decodeStoredMessage(row);
        accumulator.addMessage({
          sessionId: row.sessionId,
          id: row.id,
          text: derivedText(message),
          createdAt: row.createdAt,
        });
      });
      recordsVisited += page.length;
      cursor = page[page.length - 1].id;
      onProgress?.({
        results: accumulator.results(),
        recordsVisited,
        complete: false,
      });
      if (page.length < PAGE_SIZE) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    throwIfAborted(signal);
    return accumulator.results();
  }
}

export const chatSearchProvider: ChatSearchProvider =
  new LocalChatSearchProvider();
