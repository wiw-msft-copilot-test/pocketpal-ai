import {
  CompactionError,
  compactionReplacement,
  compactionRequest,
  compactionTurns,
} from '../compaction';
import {assistant, convertToChatMessages, user} from '../../utils/chat';
import type {MessageType} from '../../utils/types';
import type {CompletionResult} from '../../utils/completionTypes';

const question = (id: string, images?: string[]): MessageType.Text => ({
  id,
  author: user,
  type: 'text',
  text: `Question ${id}`,
  imageUris: images,
});
const answer = (id: string): MessageType.AssistantTurn => ({
  id,
  author: assistant,
  type: 'assistant_turn',
  steps: [
    {
      content: `Answer ${id}`,
      toolCalls: [{id: 'call', function: {name: 'calculate', arguments: '{}'}}],
      toolOutcomes: [
        {
          callId: 'call',
          toolName: 'calculate',
          result: {type: 'text', summary: '42'},
          responseContent: '42',
        },
      ],
    },
  ],
});
const result = (keepTurnIds: string[] = []): CompletionResult => ({
  text: '',
  content: JSON.stringify({summary: 'Remember the key facts.', keepTurnIds}),
});

describe('chat compaction contracts', () => {
  const source = [answer('a2'), question('u2'), answer('a1'), question('u1')];

  it('summarizes everything by default without executing or replaying tools', () => {
    const turns = compactionTurns(source);
    const request = compactionRequest(turns, '', false);
    expect(
      JSON.parse(request[1].content as string).transcript[0],
    ).toMatchObject({
      turnId: 'u1',
      messages: [
        {role: 'user', content: 'Question u1'},
        {role: 'assistant', tool_calls: [{id: 'call'}]},
        {role: 'tool', content: '42'},
      ],
    });
    const replacement = compactionReplacement(turns, result(), 'Summary');
    expect(replacement).toHaveLength(1);
    expect(convertToChatMessages(replacement, false)).toEqual([
      {role: 'user', content: 'Summary\n\nRemember the key facts.'},
    ]);
  });

  it('copies selected complete turns and every image turn unchanged', () => {
    const imageQuestion = question('image', ['file:///image.png']);
    const imageAnswer = answer('image-answer');
    const original = [
      ...source.slice(0, 2),
      imageAnswer,
      imageQuestion,
      ...source.slice(2),
    ];
    const turns = compactionTurns(original);
    const replacement = compactionReplacement(turns, result(['u2']), 'Summary');
    expect(replacement.slice(0, -1)).toEqual(original.slice(0, 4));
    expect(replacement[2]).toBe(imageAnswer);
    expect(replacement[3]).toBe(imageQuestion);
    const request = compactionRequest(turns, 'Keep my recent turn', true);
    expect(request[1].content).toContainEqual({
      type: 'image_url',
      image_url: {url: 'file:///image.png'},
    });
    const textOnly = compactionRequest(turns, '', false);
    expect(textOnly[1].content).not.toContain('file:///image.png');
  });

  it.each([
    {content: 'not JSON'},
    {content: '{"summary":"","keepTurnIds":[]}'},
    {content: '{"summary":"ok","keepTurnIds":["missing"]}'},
    {content: '{"summary":"ok","keepTurnIds":["u1","u1"]}'},
    {interrupted: true},
    {truncated: true},
    {terminal_status: 'incomplete' as const},
    {refusal: 'Refused'},
    {stopped_limit: 1},
  ])('rejects incomplete or invalid output: %j', override => {
    expect(() =>
      compactionReplacement(
        compactionTurns(source),
        {...result(), ...override},
        'Summary',
      ),
    ).toThrow(CompactionError);
  });

  it('rejects retention of all history rather than claiming reduction', () => {
    expect(() =>
      compactionReplacement(
        compactionTurns(source),
        result(['u1', 'u2']),
        'Summary',
      ),
    ).toThrow('noReduction');
  });
});
