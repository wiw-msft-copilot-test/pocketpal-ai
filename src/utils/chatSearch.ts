export interface TextRange {
  start: number;
  end: number;
}

export interface ChatSearchDocument {
  sessionId: string;
  title: string;
  sessionDate: string;
  messages: Array<{
    id: string;
    text: string;
    createdAt: number;
  }>;
}

export interface ChatSearchResult {
  sessionId: string;
  title: string;
  occurrenceCount: number;
  latestActivityAt: number;
  titleRanges: TextRange[];
  excerpt: string;
  excerptRanges: TextRange[];
  excerptSource: 'match' | 'latest';
}

export interface ChatSearchSessionInput {
  sessionId: string;
  title: string;
  sessionDate: string;
}

export interface ChatSearchMessageInput {
  sessionId: string;
  id: string;
  text: string;
  createdAt: number;
}

const normalizeWithMap = (text: string) => {
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;

  for (const character of text) {
    const lowered = character.toLowerCase();
    const end = offset + character.length;
    normalized += lowered;
    for (let index = 0; index < lowered.length; index += 1) {
      starts.push(offset);
      ends.push(end);
    }
    offset = end;
  }

  return {normalized, starts, ends};
};

export const findLiteralRanges = (
  text: string,
  normalizedQuery: string,
): TextRange[] => {
  if (!normalizedQuery) {
    return [];
  }
  const {normalized, starts, ends} = normalizeWithMap(text);
  const ranges: TextRange[] = [];
  let from = 0;

  while (from <= normalized.length - normalizedQuery.length) {
    const index = normalized.indexOf(normalizedQuery, from);
    if (index < 0) {
      break;
    }
    ranges.push({
      start: starts[index],
      end: ends[index + normalizedQuery.length - 1],
    });
    from = index + normalizedQuery.length;
  }
  return ranges;
};

const validTimestamp = (value: number | string): number => {
  const timestamp =
    typeof value === 'number' ? value : Date.parse(value as string);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0;
};

const excerptFor = (
  text: string,
  ranges: TextRange[],
): {text: string; ranges: TextRange[]} => {
  const maxLength = 160;
  if (text.length <= maxLength) {
    return {text, ranges};
  }
  const anchor = ranges[0]?.start ?? text.length;
  const start = Math.max(0, Math.min(anchor - 55, text.length - maxLength));
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return {
    text: `${prefix}${text.slice(start, end).trim()}${suffix}`,
    ranges: ranges
      .filter(range => range.end > start && range.start < end)
      .map(range => ({
        start: prefix.length + Math.max(0, range.start - start),
        end: prefix.length + Math.min(end - start, range.end - start),
      })),
  };
};

export const createChatSearchAccumulator = (
  sessions: ChatSearchSessionInput[],
  query: string,
): {
  addMessage: (message: ChatSearchMessageInput) => void;
  results: () => ChatSearchResult[];
} => {
  const normalizedQuery = query.trim().toLowerCase();
  const accumulators = new Map(
    sessions.map(session => [
      session.sessionId,
      {
        ...session,
        titleRanges: findLiteralRanges(session.title, normalizedQuery),
        occurrenceCount: findLiteralRanges(session.title, normalizedQuery)
          .length,
        latestActivityAt: validTimestamp(session.sessionDate),
        hasMessages: false,
        firstMatch: undefined as
          | {text: string; ranges: TextRange[]; createdAt: number}
          | undefined,
        latestVisible: undefined as
          | {text: string; ranges: TextRange[]; createdAt: number}
          | undefined,
      },
    ]),
  );

  const addMessage = (message: ChatSearchMessageInput) => {
    const accumulator = accumulators.get(message.sessionId);
    if (!accumulator) {
      return;
    }
    const createdAt = validTimestamp(message.createdAt);
    accumulator.latestActivityAt = accumulator.hasMessages
      ? Math.max(accumulator.latestActivityAt, createdAt)
      : createdAt;
    accumulator.hasMessages = true;
    if (
      message.text &&
      (!accumulator.latestVisible ||
        createdAt > accumulator.latestVisible.createdAt)
    ) {
      accumulator.latestVisible = {
        text: message.text,
        ranges: [],
        createdAt,
      };
    }
    const ranges = findLiteralRanges(message.text, normalizedQuery);
    accumulator.occurrenceCount += ranges.length;
    if (
      ranges.length > 0 &&
      (!accumulator.firstMatch || createdAt > accumulator.firstMatch.createdAt)
    ) {
      accumulator.firstMatch = {text: message.text, ranges, createdAt};
    }
  };

  const results = (): ChatSearchResult[] =>
    Array.from(accumulators.values())
      .filter(accumulator => accumulator.occurrenceCount > 0)
      .map(accumulator => {
        const source = accumulator.firstMatch ??
          accumulator.latestVisible ?? {
            text: '',
            ranges: [],
            createdAt: 0,
          };
        const excerpt = excerptFor(source.text, source.ranges);
        return {
          sessionId: accumulator.sessionId,
          title: accumulator.title,
          occurrenceCount: accumulator.occurrenceCount,
          latestActivityAt: accumulator.latestActivityAt,
          titleRanges: accumulator.titleRanges,
          excerpt: excerpt.text,
          excerptRanges: excerpt.ranges,
          excerptSource: accumulator.firstMatch
            ? ('match' as const)
            : ('latest' as const),
        };
      })
      .sort(
        (left, right) =>
          right.occurrenceCount - left.occurrenceCount ||
          right.latestActivityAt - left.latestActivityAt ||
          left.sessionId.localeCompare(right.sessionId),
      );

  return {addMessage, results};
};

export const rankChatSearchDocuments = (
  documents: ChatSearchDocument[],
  query: string,
): ChatSearchResult[] => {
  if (!query.trim()) {
    return [];
  }
  const accumulator = createChatSearchAccumulator(
    documents.map(document => ({
      sessionId: document.sessionId,
      title: document.title,
      sessionDate: document.sessionDate,
    })),
    query,
  );
  documents.forEach(document =>
    document.messages.forEach(message =>
      accumulator.addMessage({...message, sessionId: document.sessionId}),
    ),
  );
  return accumulator.results();
};
