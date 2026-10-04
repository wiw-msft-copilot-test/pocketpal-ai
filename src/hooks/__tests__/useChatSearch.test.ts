import {act, renderHook, waitFor} from '@testing-library/react-native';
import {useIsFocused} from '@react-navigation/native';

import {ChatSearchProvider} from '../../services/chatSearch';
import {useChatSearch} from '../useChatSearch';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
}));

describe('useChatSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (useIsFocused as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides progress until reveal, then updates it through completion', async () => {
    let progress: ((value: any) => void) | undefined;
    let finish: ((value: any[]) => void) | undefined;
    const provider: ChatSearchProvider = {
      search: jest.fn(
        request =>
          new Promise(resolve => {
            progress = request.onProgress;
            finish = resolve;
          }),
      ),
    };
    const first = {
      sessionId: 'one',
      title: 'One',
      occurrenceCount: 1,
      latestActivityAt: 1,
      titleRanges: [],
      excerpt: 'match',
      excerptRanges: [],
      excerptSource: 'match' as const,
    };
    const second = {...first, sessionId: 'two', title: 'Two'};
    const {result} = renderHook(() => useChatSearch(provider));

    act(() => result.current.setQuery('match'));
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    act(() =>
      progress?.({results: [first], recordsVisited: 100, complete: false}),
    );
    expect(result.current.status).toBe('searching');
    expect(result.current.results).toEqual([]);
    expect(result.current.partialAvailable).toBe(true);

    act(() => result.current.revealPartial());
    expect(result.current.status).toBe('partial');
    expect(result.current.results).toEqual([first]);
    act(() =>
      progress?.({
        results: [first, second],
        recordsVisited: 200,
        complete: false,
      }),
    );
    expect(result.current.results).toEqual([first, second]);

    await act(async () => finish?.([second, first]));
    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(result.current.results).toEqual([second, first]);
  });

  it('aborts stale work when the query changes', async () => {
    const signals: AbortSignal[] = [];
    const provider: ChatSearchProvider = {
      search: jest.fn(request => {
        signals.push(request.signal);
        return new Promise(() => {});
      }),
    };
    const {result} = renderHook(() => useChatSearch(provider));
    act(() => result.current.setQuery('first'));
    act(() => jest.advanceTimersByTime(250));
    expect(signals[0].aborted).toBe(false);
    act(() => result.current.setQuery('second'));
    expect(signals[0].aborted).toBe(true);
  });
});
