export const CONNECTION_TIMEOUT_MS = 30000;
export const IDLE_TIMEOUT_MS = 60000;

/**
 * Single normalization site for a per-server timeout. An undefined, NaN,
 * non-finite, or non-positive value falls back to the supplied default.
 * Callers (stores, engine, sheets) forward raw values; only this layer
 * enforces the floor.
 */
export function resolveTimeout(
  timeoutMs: number | undefined,
  fallback: number,
): number {
  if (timeoutMs == null || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fallback;
  }
  return timeoutMs;
}

/**
 * Build headers for OpenAI-compatible API requests.
 */
const GITHUB_COPILOT_SERVER_TYPE = 'GitHub Copilot';

const GITHUB_COPILOT_HEADERS = {
  'Copilot-Integration-Id': 'copilot-developer-cli-test',
  'User-Agent': 'copilot/1.0.83 (linux v24.20.0) term/unknown-test',
  'Editor-Version': 'copilot/1.0.83-test',
} as const;

export function buildHeaders(
  apiKey?: string,
  serverType?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (serverType === GITHUB_COPILOT_SERVER_TYPE) {
    Object.assign(headers, GITHUB_COPILOT_HEADERS);
  }
  return headers;
}

/**
 * Normalize server URL: remove trailing slash.
 */
export function normalizeUrl(serverUrl: string): string {
  const parsed = new URL(serverUrl);
  const isLocal =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '::1' ||
    parsed.hostname.startsWith('127.') ||
    parsed.hostname.startsWith('10.') ||
    parsed.hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);
  if ((!isLocal && parsed.protocol !== 'https:') || !parsed.hostname) {
    throw new Error('Remote AI servers must use HTTPS.');
  }
  return serverUrl.replace(/\/+$/, '');
}

export function buildOpenAIUrl(
  serverUrl: string,
  endpoint: 'models' | 'chat/completions' | 'responses',
  serverType?: string,
): string {
  const prefix = serverType === GITHUB_COPILOT_SERVER_TYPE ? '' : '/v1';
  return `${normalizeUrl(serverUrl)}${prefix}/${endpoint}`;
}
