import {findLiteralRanges, rankChatSearchDocuments} from '../chatSearch';

describe('chat search ranking', () => {
  it('counts literal occurrences and sorts score, latest message, then id', () => {
    const results = rankChatSearchDocuments(
      [
        {
          sessionId: 'older-more',
          title: 'Solar solar',
          sessionDate: '2026-01-01',
          messages: [{id: '1', text: 'solar solar solar', createdAt: 100}],
        },
        {
          sessionId: 'newer-tie',
          title: 'Notes',
          sessionDate: '2020-01-01',
          messages: [{id: '2', text: 'solar solar', createdAt: 300}],
        },
        {
          sessionId: 'older-tie',
          title: 'Solar',
          sessionDate: '2030-01-01',
          messages: [{id: '3', text: 'solar', createdAt: 200}],
        },
      ],
      ' SOLAR ',
    );

    expect(results.map(result => result.sessionId)).toEqual([
      'older-more',
      'newer-tie',
      'older-tie',
    ]);
    expect(results.map(result => result.occurrenceCount)).toEqual([5, 2, 2]);
    expect(results[1].latestActivityAt).toBe(300);
  });

  it('treats punctuation and multiword queries literally', () => {
    const results = rankChatSearchDocuments(
      [
        {
          sessionId: 'literal',
          title: 'C++ plan',
          sessionDate: 'invalid',
          messages: [
            {id: '1', text: 'Use C++ plan; C+ is different.', createdAt: 10},
          ],
        },
      ],
      'C++ plan',
    );
    expect(results[0].occurrenceCount).toBe(2);
    expect(rankChatSearchDocuments([], '   ')).toEqual([]);
  });

  it('returns original UTF-16 ranges when lowercasing expands characters', () => {
    expect(findLiteralRanges('İstanbul', 'i̇')).toEqual([{start: 0, end: 1}]);
  });

  it('uses a newer nonmatching message for tie-break recency', () => {
    const [result] = rankChatSearchDocuments(
      [
        {
          sessionId: 'chat',
          title: 'Notes',
          sessionDate: '2020-01-01',
          messages: [
            {id: 'match', text: 'solar', createdAt: 10},
            {id: 'new', text: 'latest unrelated text', createdAt: 999},
          ],
        },
      ],
      'solar',
    );
    expect(result.latestActivityAt).toBe(999);
    expect(result.excerpt).toBe('solar');
  });
});
