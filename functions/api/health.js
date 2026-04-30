import { json } from './_helpers.js';

export async function onRequestGet(context) {
  return json({
    ok: true,
    copilot: !!context.env.ANTHROPIC_API_KEY,
    runtime: 'cloudflare-pages-functions',
  });
}
