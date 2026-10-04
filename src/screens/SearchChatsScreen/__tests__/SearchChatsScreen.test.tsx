import React from 'react';
import {Text} from 'react-native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {NavigationContainer} from '@react-navigation/native';

import {fireEvent, render, waitFor} from '../../../../jest/test-utils';
import {chatSessionStore} from '../../../store';
import {chatRunControl} from '../../../services/chatRunControl';
import {SearchChatsScreen} from '../SearchChatsScreen';
import {useChatSearch} from '../../../hooks';

jest.mock('../../../hooks', () => {
  const actual = jest.requireActual('../../../hooks');
  return {...actual, useChatSearch: jest.fn()};
});

jest.mock('../../../services/chatRunControl', () => ({
  chatRunControl: {
    stopForSessionSwitch: jest.fn().mockResolvedValue(undefined),
  },
}));

const result = {
  sessionId: 'session-1',
  title: 'Solar notes',
  occurrenceCount: 3,
  latestActivityAt: Date.parse('2026-10-01'),
  titleRanges: [{start: 0, end: 5}],
  excerpt: 'solar solar',
  excerptRanges: [
    {start: 0, end: 5},
    {start: 6, end: 11},
  ],
  excerptSource: 'match' as const,
};

const baseSearch = {
  query: 'solar',
  setQuery: jest.fn(),
  status: 'complete',
  results: [result],
  partialAvailable: false,
  recordsVisited: 2,
  error: null,
  revealPartial: jest.fn(),
  refresh: jest.fn(),
  cancel: jest.fn(),
};

const Drawer = createDrawerNavigator();
const Chat = () => <Text>Chat destination</Text>;

const renderScreen = () =>
  render(
    <NavigationContainer>
      <Drawer.Navigator initialRouteName="Search chats">
        <Drawer.Screen name="Search chats" component={SearchChatsScreen} />
        <Drawer.Screen name="Chat" component={Chat} />
      </Drawer.Navigator>
    </NavigationContainer>,
  );

describe('SearchChatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useChatSearch as jest.Mock).mockReturnValue({...baseSearch});
    (chatSessionStore.setActiveSession as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it('renders scores, highlighted content, and opens a result safely', async () => {
    const {getByText, getByTestId} = renderScreen();
    expect(getByText('1 matching chat')).toBeTruthy();
    expect(getByText('3 matches')).toBeTruthy();
    fireEvent.press(getByTestId('chat-search-result-session-1'));
    await waitFor(() => {
      expect(chatRunControl.stopForSessionSwitch).toHaveBeenCalledTimes(1);
      expect(chatSessionStore.setActiveSession).toHaveBeenCalledWith(
        'session-1',
      );
      expect(getByText('Chat destination')).toBeTruthy();
    });
    expect(baseSearch.cancel).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit action before showing partial results', () => {
    (useChatSearch as jest.Mock).mockReturnValue({
      ...baseSearch,
      status: 'searching',
      results: [],
      partialAvailable: true,
    });
    const {getByText, queryByTestId} = renderScreen();
    expect(getByText('Show results so far')).toBeTruthy();
    expect(queryByTestId('chat-search-results')).toBeNull();
  });

  it('labels revealed results as incomplete', () => {
    (useChatSearch as jest.Mock).mockReturnValue({
      ...baseSearch,
      status: 'partial',
    });
    const {getByText, getByTestId} = renderScreen();
    expect(
      getByText(
        'Search in progress — results may change. Opening a chat stops the remaining search.',
      ),
    ).toBeTruthy();
    expect(getByTestId('chat-search-results')).toBeTruthy();
  });
});
