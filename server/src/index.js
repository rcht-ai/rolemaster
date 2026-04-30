// RoleMaster server entry point.
// Hono on Node 22+ (--experimental-sqlite). Listens on $PORT.
// In production, also serves the built frontend (../app/dist) so a single
// process handles /api/* and the SPA on the same origin.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js';
import { authMiddleware } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { curatorRoutes } from './routes/curator.js';
import { catalogRoutes } from './routes/catalog.js';
import { copilotRoutes } from './routes/copilot.js';
import { fileRoutes } from './routes/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIST = path.resolve(__dirname, '..', '..', 'app', 'dist');
const HAS_SPA = fs.existsSync(path.join(APP_DIST, 'index.html'));

const app = new Hono();

app.use('*', logger());

// CORS — when serving the SPA from the same origin (production single-port deploy),
// no CORS needed. In dev, Vite proxies /api so the browser only sees same-origin.
// We still configure CORS for the dev case where you might point a separate frontend at us.
app.use('/api/*', cors({
  origin: process.env.CORS_ORIGIN || ((origin) => origin || '*'),
  credentials: true,
}));

app.use('/api/*', authMiddleware);

app.get('/api/health', (c) => c.json({
  ok: true,
  copilot: !!process.env.ANTHROPIC_API_KEY,
  serving_spa: HAS_SPA,
}));

app.route('/api/auth', authRoutes);
app.route('/api/submissions', submissionRoutes);
app.route('/api/curator', curatorRoutes);
app.route('/api/catalog', catalogRoutes);
app.route('/api', copilotRoutes); // /api/submissions/:id/copilot
app.route('/api', fileRoutes);    // /api/submissions/:id/files

// Serve the built SPA in production. Routes that don't match /api/* fall through
// to the static handler; missing files fall back to index.html for client routing.
if (HAS_SPA) {
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), APP_DIST) }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'not_found' }, 404);
    const html = fs.readFileSync(path.join(APP_DIST, 'index.html'), 'utf8');
    return c.html(html);
  });
} else {
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
}

app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

const port = Number(process.env.PORT || 3001);
serve({ fetch: app.fetch, port });
console.log(`✅ RoleMaster listening on :${port}`);
console.log(`   API:     /api/*`);
console.log(`   SPA:     ${HAS_SPA ? `serving ${APP_DIST}` : '(not built — run `npm run build` in app/ first, or hit the API directly)'}`);
console.log(`   Copilot: ${process.env.ANTHROPIC_API_KEY ? 'Claude (live)' : 'fallback (set ANTHROPIC_API_KEY for real AI)'}`);
