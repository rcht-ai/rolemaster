// Auth middleware — runs before every /api/* request.
// - Lets public routes through (login, register, health).
// - For everything else, requires a valid JWT from the rm_token cookie.
//   Decoded payload is exposed at context.data.user.

import { CORS, json, readTokenCookie, verifyJWT } from './_helpers.js';

const PUBLIC = [
  { method: 'GET',  path: '/api/health' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/logout' }, // clears cookie regardless of auth
];

function isPublic(method, path) {
  return PUBLIC.some(r => r.method === method && r.path === path);
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const path = new URL(request.url).pathname;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (isPublic(method, path)) {
    return await context.next();
  }

  const token = readTokenCookie(request);
  if (!token) return json({ error: 'unauthorized' }, 401);

  let payload;
  try {
    payload = await verifyJWT(token, env.JWT_SECRET);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }
  context.data = context.data || {};
  context.data.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    supplier_id: payload.sup ?? null,
  };
  return await context.next();
}
