import React from 'react';
import {AppState} from 'react-native';
import {useIsFocused} from '@react-navigation/native';

import {
  ChatSearchAbortedError,
  ChatSearchProvider,
  chatSearchProvider,
} from '../services/chatSearch';
import {ChatSearchResult} from '../utils/chatSearch';

export type ChatSearchStatus =
  | 'blank'
  | 'searching'
  | 'partial'
  | 'complete'
  | 'error';

export const useChatSearch = (
  provider: ChatSearchProvider = chatSearchProvider,
) => {
  const isFocused = useIsFocused();
  const [query, setQueryState] = React.useState('');
  const [status, setStatus] = React.useState<ChatSearchStatus>('blank');
  const [results, setResults] = React.useState<ChatSearchResult[]>([]);
  const [partialAvailable, setPartialAvailable] = React.useState(false);
  const [recordsVisited, setRecordsVisited] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const controllerRef = React.useRef<AbortController | null>(null);
  const requestIdRef = React.useRef(0);
  const partialVisibleRef = React.useRef(false);
  const latestPartialRef = React.useRef<ChatSearchResult[]>([]);

  const cancel = React.useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const setQuery = React.useCallback(
    (next: string) => {
      cancel();
      partialVisibleRef.current = false;
      latestPartialRef.current = [];
      setPartialAvailable(false);
      setResults([]);
      setRecordsVisited(0);
      setError(null);
      setQueryState(next);
      setStatus(next.trim() ? 'searching' : 'blank');
    },
    [cancel],
  );

  const refresh = React.useCallback(() => {
    cancel();
    partialVisibleRef.current = false;
    latestPartialRef.current = [];
    setPartialAvailable(false);
    setResults([]);
    setRecordsVisited(0);
    setError(null);
    setStatus(query.trim() ? 'searching' : 'blank');
    setRefreshKey(key => key + 1);
  }, [cancel, query]);

  const revealPartial = React.useCallback(() => {
    partialVisibleRef.current = true;
    setResults(latestPartialRef.current);
    setStatus('partial');
  }, []);

  React.useEffect(() => {
    if (!isFocused || !query.trim()) {
      if (!query.trim()) {
        setStatus('blank');
      }
      return cancel;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('searching');
    setError(null);
    const timer = setTimeout(() => {
      provider
        .search({
          query,
          signal: controller.signal,
          onProgress: progress => {
            if (requestIdRef.current !== requestId) {
              return;
            }
            latestPartialRef.current = progress.results;
            setRecordsVisited(progress.recordsVisited);
            setPartialAvailable(progress.results.length > 0);
            if (partialVisibleRef.current) {
              setResults(progress.results);
              setStatus('partial');
            }
          },
        })
        .then(finalResults => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          latestPartialRef.current = finalResults;
          setResults(finalResults);
          setPartialAvailable(false);
          setStatus('complete');
          controllerRef.current = null;
        })
        .catch(searchError => {
          if (
            requestIdRef.current !== requestId ||
            searchError instanceof ChatSearchAbortedError
          ) {
            return;
          }
          setError(
            searchError instanceof Error
              ? searchError
              : new Error(String(searchError)),
          );
          setStatus('error');
          controllerRef.current = null;
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cancel, isFocused, provider, query, refreshKey]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && isFocused && query.trim()) {
        refresh();
      } else if (nextState !== 'active') {
        cancel();
      }
    });
    return () => subscription.remove();
  }, [cancel, isFocused, query, refresh]);

  return {
    query,
    setQuery,
    status,
    results,
    partialAvailable,
    recordsVisited,
    error,
    revealPartial,
    refresh,
    cancel,
  };
};
