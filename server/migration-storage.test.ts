import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  TABLE_MIGRATION_ORDER,
  runSqliteToPostgresMigration,
} from './migrate-sqlite-to-postgres';
import { RXORBIT_SCHEMA_CONTRACT } from './schema-compat';
import { SQLITE_SCHEMA_SQL } from './sqlite';
import { getStorageMode, inferContentType, sanitizeStorageKey } from './storage';

test('TABLE_MIGRATION_ORDER includes all 16 contracted tables in FK dependency order', () => {
  const contractedNames = new Set(RXORBIT_SCHEMA_CONTRACT.map((t) => t.name));
  const migrationNames = new Set(TABLE_MIGRATION_ORDER);
  assert.equal(migrationNames.size, 16);
  assert.deepEqual(migrationNames, contractedNames);

  const indexOf = (name: string) =>
    TABLE_MIGRATION_ORDER.indexOf(name as (typeof TABLE_MIGRATION_ORDER)[number]);

  assert.ok(indexOf('users') < indexOf('event_registrations'));
  assert.ok(indexOf('events') < indexOf('event_registrations'));
  assert.ok(indexOf('gallery_albums') < indexOf('gallery_photos'));
  assert.ok(indexOf('curriculum_units') < indexOf('curriculum_subjects'));
  assert.ok(indexOf('notifications') < indexOf('notification_reads'));
  assert.ok(indexOf('users') < indexOf('notification_reads'));
});

test('runSqliteToPostgresMigration dry-run validates SQLite without creating fake rows', async () => {
  const liveSqlitePath = path.resolve(process.cwd(), 'data', 'rxorbit.sqlite');
  const hasLiveDb = fs.existsSync(liveSqlitePath);
  const targetPath = hasLiveDb
    ? liveSqlitePath
    : path.join(os.tmpdir(), `rxorbit-mig-test-${Date.now()}.sqlite`);

  if (!hasLiveDb) {
    const initDb = new DatabaseSync(targetPath);
    initDb.exec(SQLITE_SCHEMA_SQL);
    initDb.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
    initDb.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
    initDb.exec("ALTER TABLE users ADD COLUMN preferred_program TEXT NOT NULL DEFAULT 'All'");
    initDb.exec("ALTER TABLE users ADD COLUMN preferred_subjects TEXT NOT NULL DEFAULT '[]'");
    initDb.close();
  }

  try {
    const report = await runSqliteToPostgresMigration({ sqlitePath: targetPath, dryRun: true });
    assert.equal(report.dryRun, true);
    assert.equal(report.tables.length, 16);
    for (const table of report.tables) {
      assert.equal(table.migratedRows, 0);
    }
  } finally {
    if (!hasLiveDb && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
});

test('Storage key sanitization blocks traversal and content-type inference is accurate', () => {
  assert.equal(sanitizeStorageKey('materials/sample_1.pdf'), 'materials/sample_1.pdf');
  assert.equal(sanitizeStorageKey('/media/photo.png'), 'media/photo.png');
  assert.equal(sanitizeStorageKey('../secrets.txt'), null);
  assert.equal(sanitizeStorageKey('materials/../etc/passwd'), null);
  assert.equal(sanitizeStorageKey('materials/\0bad.pdf'), null);
  assert.equal(sanitizeStorageKey(''), null);

  assert.equal(inferContentType('notes.pdf'), 'application/pdf');
  assert.equal(inferContentType('avatar.JPG'), 'image/jpeg');
  assert.equal(inferContentType('poster.png'), 'image/png');
  assert.equal(inferContentType('cover.webp'), 'image/webp');
  assert.ok(['local', 'supabase'].includes(getStorageMode()));
});
