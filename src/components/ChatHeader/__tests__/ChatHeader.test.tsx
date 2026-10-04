import React from 'react';
import {fireEvent, render} from '../../../../jest/test-utils';
import {ChatHeader} from '../ChatHeader';
import {chatSessionStore} from '../../../store';

jest.mock('../../../store', () => ({
  __esModule: true,
  chatSessionStore: {
    shouldShowHeaderDivider: false,
    searchReturnAvailable: false,
  },
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

// Mock the child components
jest.mock('../../HeaderLeft', () => ({
  HeaderLeft: () => {
    const {View} = require('react-native');
    return <View testID="header-left" />;
  },
}));

jest.mock('../../HeaderRight', () => ({
  HeaderRight: () => {
    const {View} = require('react-native');
    return <View testID="header-right" />;
  },
}));

jest.mock('../../ChatHeaderTitle', () => ({
  ChatHeaderTitle: () => {
    const {View} = require('react-native');
    return <View testID="chat-header-title" />;
  },
}));

const mockChatSessionStore = chatSessionStore as typeof chatSessionStore & {
  shouldShowHeaderDivider: boolean;
  searchReturnAvailable: boolean;
};

describe('ChatHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock store value
    mockChatSessionStore.shouldShowHeaderDivider = false;
    mockChatSessionStore.searchReturnAvailable = false;
  });

  it('returns to search when chat was opened from a result', () => {
    mockChatSessionStore.searchReturnAvailable = true;
    const {getByTestId} = render(<ChatHeader />, {withSafeArea: true});
    fireEvent.press(getByTestId('back-to-chat-search'));
    expect(mockNavigate).toHaveBeenCalledWith('Search chats');
  });

  it('renders all child components', () => {
    const {getByTestId} = render(<ChatHeader />);

    expect(getByTestId('header-view')).toBeTruthy();
    expect(getByTestId('header-left')).toBeTruthy();
    expect(getByTestId('header-right')).toBeTruthy();
    expect(getByTestId('chat-header-title')).toBeTruthy();
  });

  it('applies correct styles when header divider should not be shown', () => {
    mockChatSessionStore.shouldShowHeaderDivider = false;
    const {getByTestId} = render(<ChatHeader />, {withSafeArea: true});

    const headerView = getByTestId('header-view');
    expect(headerView.props.style[1]).toMatchObject({
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
      backgroundColor: expect.any(String),
    });
  });

  it('applies correct styles when header divider should be shown', () => {
    mockChatSessionStore.shouldShowHeaderDivider = true;
    const {getByTestId} = render(<ChatHeader />, {withSafeArea: true});

    const headerView = getByTestId('header-view');
    expect(headerView.props.style[1]).toMatchObject({
      backgroundColor: expect.any(String),
    });
  });
});
