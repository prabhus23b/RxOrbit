import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TABLE_MIGRATION_ORDER,
  runSqliteToPostgresMigration,
} from './migrate-sqlite-to-postgres';
import { RXORBIT_SCHEMA_CONTRACT } from './schema-compat';
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

test('runSqliteToPostgresMigration dry-run validates live SQLite without creating fake rows', async () => {
  const report = await runSqliteToPostgresMigration({ dryRun: true });
  assert.equal(report.dryRun, true);
  assert.equal(report.tables.length, 16);
  for (const table of report.tables) {
    assert.equal(table.migratedRows, 0);
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
