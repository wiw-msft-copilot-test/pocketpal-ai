import React from 'react';
import {render, fireEvent, waitFor} from '../../../../jest/test-utils';
import {CompactionDialog} from '../CompactionDialog';
import {compactChat} from '../../../services/compactChat';
import {CompactionError} from '../../../services/compaction';
import {l10n} from '../../../locales';

jest.mock('../../../services/compactChat', () => ({compactChat: jest.fn()}));

describe('CompactionDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows blank guidance and closes only after successful replacement', async () => {
    const close = jest.fn();
    const view = render(
      <CompactionDialog visible sessionId="chat" onClose={close} />,
    );
    fireEvent.press(view.getByTestId('compaction-confirm'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(compactChat).toHaveBeenCalledWith(
      'chat',
      '',
      l10n.en.components.compaction.summary,
    );
  });

  it('passes optional guidance and leaves the dialog open on failure', async () => {
    jest
      .mocked(compactChat)
      .mockRejectedValueOnce(new CompactionError('overflow'));
    const close = jest.fn();
    const view = render(
      <CompactionDialog visible sessionId="chat" onClose={close} />,
    );
    fireEvent.changeText(
      view.getByTestId('compaction-guidance'),
      'Keep the last turn',
    );
    fireEvent.press(view.getByTestId('compaction-confirm'));
    await waitFor(() =>
      expect(view.getByTestId('compaction-error')).toBeTruthy(),
    );
    expect(close).not.toHaveBeenCalled();
    expect(compactChat).toHaveBeenCalledWith(
      'chat',
      'Keep the last turn',
      expect.any(String),
    );
  });

  it('cancels without submitting a request', () => {
    const close = jest.fn();
    const view = render(
      <CompactionDialog visible sessionId="chat" onClose={close} />,
    );
    fireEvent.press(view.getByTestId('compaction-cancel'));
    expect(close).toHaveBeenCalled();
    expect(compactChat).not.toHaveBeenCalled();
  });
});
