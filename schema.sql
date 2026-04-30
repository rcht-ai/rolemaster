-- RoleMaster — D1 schema. Same SQLite syntax as the prior local server.
-- Apply with: wrangler d1 execute rolemaster-db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,         -- PBKDF2 hex hash
  salt        TEXT NOT NULL,         -- PBKDF2 hex salt
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('supplier','curator','sales')),
  supplier_id TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT NOT NULL,
  hq          TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  founded     INTEGER,
  team        TEXT,
  clients     INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_subtitle_zh TEXT,
  product_subtitle_en TEXT,
  status      TEXT NOT NULL CHECK(status IN ('draft','new','review','revision','approved','published')) DEFAULT 'draft',
  prefill     INTEGER NOT NULL DEFAULT 0,
  materials   TEXT NOT NULL DEFAULT '[]',
  rolepack_id TEXT,
  submitted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submission_fields (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  field_id    TEXT NOT NULL,
  section     INTEGER NOT NULL,
  label_zh    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  value_zh    TEXT,
  value_en    TEXT,
  status      TEXT NOT NULL CHECK(status IN ('ai','filled','empty','weak')),
  hint_zh     TEXT,
  hint_en     TEXT,
  optional    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (submission_id, field_id)
);

CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  storage_key TEXT NOT NULL,         -- R2 object key (replaces filesystem path)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  who         TEXT NOT NULL,
  action_zh   TEXT NOT NULL,
  action_en   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rolepacks (
  id          TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  data        TEXT NOT NULL,         -- JSON
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  meta        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_supplier ON submissions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sub ON audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_chat_sub ON chat_messages(submission_id);
