// RoleMaster server entry point.
// Hono on Node, listens on PORT (default 3001).

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import './db.js'; // ensures schema is initialized
import { authMiddleware } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { curatorRoutes } from './routes/curator.js';
import { catalogRoutes } from './routes/catalog.js';
import { copilotRoutes } from './routes/copilot.js';
import { fileRoutes } from './routes/files.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin, // reflect any origin in dev — tighten in prod
  credentials: true,
}));
app.use('*', authMiddleware);

app.get('/api/health', (c) => c.json({ ok: true, copilot: !!process.env.ANTHROPIC_API_KEY }));

app.route('/api/auth', authRoutes);
app.route('/api/submissions', submissionRoutes);
app.route('/api/curator', curatorRoutes);
app.route('/api/catalog', catalogRoutes);
app.route('/api', copilotRoutes); // /api/submissions/:id/copilot
app.route('/api', fileRoutes);    // /api/submissions/:id/files

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

const port = Number(process.env.PORT || 3001);
serve({ fetch: app.fetch, port });
console.log(`✅ RoleMaster API listening on http://localhost:${port}`);
console.log(`   Copilot: ${process.env.ANTHROPIC_API_KEY ? 'Claude (live)' : 'fallback (set ANTHROPIC_API_KEY for real AI)'}`);
