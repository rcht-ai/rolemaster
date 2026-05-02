// Anthropic SDK wrapper. All AI calls go through this.
// Adds retry on 429/529/network, deterministic timeout, and platform_logs telemetry.

import Anthropic from '@anthropic-ai/sdk';
import { logEvent } from './logging.js';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

const RETRIABLE_STATUSES = new Set([429, 529, 500, 502, 503, 504]);

export async function callClaude(env, {
  surface,
  submissionId = null,
  productId = null,
  system,
  messages,
  outputSchema = null,
  maxTokens = 4000,
  model = DEFAULT_MODEL,
  timeoutMs = 60_000,
}) {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: 'no_api_key' };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const t0 = Date.now();
  let attempt = 0;
  let lastError = null;

  while (attempt < 2) {
    attempt++;
    try {
      const params = {
        model,
        max_tokens: maxTokens,
        system: typeof system === 'string'
          ? [{ type: 'text', text: system }]
          : system,
        messages,
      };
      if (outputSchema) {
        params.output_config = {
          format: { type: 'json_schema', schema: outputSchema },
        };
      }

      const response = await Promise.race([
        client.messages.create(params),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);

      const text = response.content?.find(b => b.type === 'text')?.text || '';
      const duration = Date.now() - t0;
      await logEvent(env, 'info', `${surface}_ok`, {
        surface, submissionId, productId,
        attempt, model,
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        duration_ms: duration,
      });
      return {
        ok: true,
        text,
        usage: response.usage,
        durationMs: duration,
      };
    } catch (e) {
      lastError = e;
      const status = e?.status || e?.response?.status;
      const retriable = RETRIABLE_STATUSES.has(status) || /timeout|fetch|network|ECONN|other side closed/i.test(e?.message || '');
      if (attempt < 2 && retriable) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const duration = Date.now() - t0;
      await logEvent(env, 'error', `${surface}_failed`, {
        surface, submissionId, productId,
        attempt, model, status,
        message: String(e?.message || e).slice(0, 400),
        duration_ms: duration,
      });
      return { ok: false, reason: 'error', error: e.message, status };
    }
  }
  return { ok: false, reason: 'error', error: lastError?.message };
}
