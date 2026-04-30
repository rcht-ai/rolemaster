// Seed only the two preset role accounts — curator + sales.
// Suppliers self-register; submissions and RolePacks are created by users.
// Idempotent — wipes all data and re-creates the two accounts.

import { db } from './db.js';
import { hashPassword } from './auth.js';
import { nanoid } from 'nanoid';

console.log('Resetting RoleMaster database…');

db.exec(`
  DELETE FROM chat_messages;
  DELETE FROM audit_log;
  DELETE FROM files;
  DELETE FROM submission_fields;
  DELETE FROM submissions;
  DELETE FROM rolepacks;
  DELETE FROM sessions;
  DELETE FROM users;
  DELETE FROM suppliers;
`);

const pwd = await hashPassword('demo');
const insertUser = db.prepare(`
  INSERT INTO users (id, email, password, name, role, supplier_id) VALUES (?, ?, ?, ?, ?, ?)
`);

insertUser.run(nanoid(12), 'grace@rolemaster.io', pwd, 'Grace Ho',  'curator', null);
insertUser.run(nanoid(12), 'sales@rolemaster.io', pwd, 'Sales Rep', 'sales',   null);

console.log('✅ Database reset.');
console.log('   Preset accounts (password: demo):');
console.log('     curator   grace@rolemaster.io');
console.log('     sales     sales@rolemaster.io');
console.log('   Suppliers self-register at /supplier/register.');
