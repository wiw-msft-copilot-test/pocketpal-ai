import {
  isRemoteApiMode,
  isRemoteWireApi,
  normalizePositiveInteger,
  REMOTE_WIRE_APIS,
} from '../remoteProtocol';

describe('remote protocol contracts', () => {
  it('accepts only supported wire APIs and modes', () => {
    expect(REMOTE_WIRE_APIS).toEqual(['chat-completions', 'responses']);
    expect(isRemoteWireApi('chat-completions')).toBe(true);
    expect(isRemoteWireApi('responses')).toBe(true);
    expect(isRemoteWireApi('/responses')).toBe(false);
    expect(isRemoteWireApi('messages')).toBe(false);
    expect(isRemoteApiMode('auto')).toBe(true);
    expect(isRemoteApiMode(undefined)).toBe(false);
  });

  it('normalizes only safe positive integer limits', () => {
    expect(normalizePositiveInteger(128000)).toBe(128000);
    expect(normalizePositiveInteger(0)).toBeUndefined();
    expect(normalizePositiveInteger(-1)).toBeUndefined();
    expect(normalizePositiveInteger(1.5)).toBeUndefined();
    expect(normalizePositiveInteger('128000')).toBeUndefined();
  });
});
