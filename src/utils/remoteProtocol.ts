export const REMOTE_WIRE_APIS = ['chat-completions', 'responses'] as const;

export type RemoteWireApi = (typeof REMOTE_WIRE_APIS)[number];
export type RemoteApiMode = 'auto' | RemoteWireApi;
export type RemoteProtocolSource =
  | 'model-override'
  | 'server-override'
  | 'catalog'
  | 'cached-catalog'
  | 'compatibility-default';

export interface RemoteProtocolCapabilities {
  advertisedEndpoints?: RemoteWireApi[];
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
  reasoningEffortValues?: string[];
}

export interface RemoteModelPreference {
  wireApi?: RemoteWireApi;
  vision?: 'auto' | 'on' | 'off';
}

export interface RemoteProtocolResolution {
  wireApi?: RemoteWireApi;
  source: RemoteProtocolSource;
  supported: boolean;
  warning?: 'unknown-support' | 'contradicts-catalog';
}

export function isRemoteWireApi(value: unknown): value is RemoteWireApi {
  return (
    typeof value === 'string' &&
    (REMOTE_WIRE_APIS as readonly string[]).includes(value)
  );
}

export function isRemoteApiMode(value: unknown): value is RemoteApiMode {
  return value === 'auto' || isRemoteWireApi(value);
}

export function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}
