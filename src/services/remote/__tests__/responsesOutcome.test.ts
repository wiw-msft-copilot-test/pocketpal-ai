import {
  completionResultSnapshot,
  responsesOutcomeMetadata,
} from '../responsesOutcome';

describe('Responses outcome projection', () => {
  it('keeps output-token exhaustion separate from context exhaustion', () => {
    expect(
      completionResultSnapshot(
        {
          text: 'partial',
          content: 'partial',
          tokens_evaluated: 10,
          tokens_predicted: 20,
          stopped_limit: 1,
          terminal_status: 'incomplete',
          incomplete_reason: 'max_output_tokens',
          interrupted: true,
        },
        true,
      ),
    ).toMatchObject({
      used: 30,
      contextFull: false,
      finishReason: 'output-limit',
      terminalStatus: 'incomplete',
      incompleteReason: 'max_output_tokens',
      isRemote: true,
    });
  });

  it('retains the legacy Chat Completions length mapping', () => {
    expect(
      completionResultSnapshot(
        {text: 'partial', content: 'partial', stopped_limit: 1},
        true,
      ),
    ).toMatchObject({
      contextFull: true,
      finishReason: 'length',
    });
  });

  it('prefers refusal presentation over the provider terminal status', () => {
    expect(
      responsesOutcomeMetadata({
        text: 'No',
        content: 'No',
        refusal: 'No',
        terminal_status: 'incomplete',
        incomplete_reason: 'content_filter',
        interrupted: true,
      }),
    ).toEqual({
      interrupted: true,
      responseStatus: 'refused',
      incompleteReason: 'content_filter',
    });
  });
});
