import {chatSessionRepository} from '../ChatSessionRepository';
import {database} from '../../database';
import {user} from '../../utils/chat';
import type {MessageType} from '../../utils/types';

const mockFetch = jest.fn();
const mockPrepareCreate = jest.fn();
const mockBatch = jest.fn();

jest.mock('../../database', () => ({
  database: {
    write: (callback: () => Promise<unknown>) => callback(),
    batch: (...operations: unknown[]) => mockBatch(...operations),
    collections: {
      get: () => ({
        find: async () => ({id: 'chat'}),
        query: () => ({fetch: () => mockFetch()}),
        prepareCreate: (build: (record: unknown) => void) =>
          mockPrepareCreate(build),
      }),
    },
  },
}));
jest.unmock('../ChatSessionRepository');

describe('atomic compaction persistence', () => {
  const source: MessageType.Text[] = [
    {
      id: 'new',
      type: 'text',
      author: user,
      text: 'Retain',
      imageUris: ['image.png'],
    },
    {id: 'old', type: 'text', author: user, text: 'Summarize'},
  ];
  const summary: MessageType.Text = {
    id: '',
    type: 'text',
    author: user,
    text: 'Summary',
    metadata: {compaction: true},
  };
  const destroy = jest.fn();
  const update = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(
      source.map(message => ({
        id: message.id,
        toMessageObject: () => message,
        prepareDestroyPermanently: destroy,
        prepareUpdate: update,
      })),
    );
    mockPrepareCreate.mockImplementation(build => {
      const record = {id: 'summary'};
      build(record);
      return record;
    });
    mockBatch.mockResolvedValue(undefined);
  });

  it('batches the summary, retained ordering, and permanent removal together', async () => {
    const saved = await chatSessionRepository.replaceCompactedHistory(
      'chat',
      source,
      [source[0], summary],
      () => true,
    );
    expect(saved).toEqual([source[0], {...summary, id: 'summary'}]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch.mock.calls[0][0]).toMatchObject({
      position: 1,
      metadata: '{"compaction":true}',
    });
    expect(database).toBeDefined();
  });

  it('refuses changed or cancelled source before preparing destructive writes', async () => {
    await expect(
      chatSessionRepository.replaceCompactedHistory(
        'chat',
        source,
        [summary],
        () => false,
      ),
    ).rejects.toThrow('changed');
    expect(mockPrepareCreate).not.toHaveBeenCalled();
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it('propagates a failed transaction rather than reporting success', async () => {
    mockBatch.mockRejectedValueOnce(new Error('Disk full'));
    await expect(
      chatSessionRepository.replaceCompactedHistory(
        'chat',
        source,
        [summary],
        () => true,
      ),
    ).rejects.toThrow('Disk full');
  });
});
