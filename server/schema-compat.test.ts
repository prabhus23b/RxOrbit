import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  POSTGRES_SCHEMA_STATEMENTS,
  toIsoTimestamp,
  toPgBoolean,
  toPgInt,
} from './postgres';
import {
  RXORBIT_SCHEMA_CONTRACT,
  auditSqliteCompatibility,
  normalizeRowValuesForPostgres,
} from './schema-compat';
import { hashPassword, verifyPassword } from './security';
import { SQLITE_SCHEMA_SQL } from './sqlite';

test('SQLite database schema matches the full 16-table RxOrbit schema contract', () => {
  const liveSqlitePath = path.resolve(process.cwd(), 'data', 'rxorbit.sqlite');
  const hasLiveDb = fs.existsSync(liveSqlitePath);
  const targetPath = hasLiveDb
    ? liveSqlitePath
    : path.join(os.tmpdir(), `rxorbit-schema-test-${Date.now()}.sqlite`);

  if (!hasLiveDb) {
    const initDb = new DatabaseSync(targetPath);
    initDb.exec(SQLITE_SCHEMA_SQL);
    initDb.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
    initDb.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
    initDb.exec("ALTER TABLE users ADD COLUMN preferred_program TEXT NOT NULL DEFAULT 'All'");
    initDb.exec("ALTER TABLE users ADD COLUMN preferred_subjects TEXT NOT NULL DEFAULT '[]'");
    initDb.close();
  }

  const sqliteDb = new DatabaseSync(targetPath, { readOnly: true });
  try {
    const report = auditSqliteCompatibility(sqliteDb);
    assert.equal(report.checkedTables, 16);
    assert.deepEqual(report.issues, []);
    assert.equal(report.ok, true);
  } finally {
    sqliteDb.close();
    if (!hasLiveDb && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
});

test('POSTGRES_SCHEMA_STATEMENTS defines every contracted table and index', () => {
  const joined = POSTGRES_SCHEMA_STATEMENTS.join('\n');
  for (const table of RXORBIT_SCHEMA_CONTRACT) {
    assert.match(
      joined,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table.name}\\s*\\(`),
      `Missing CREATE TABLE for ${table.name}`
    );
    for (const col of table.columns) {
      assert.match(
        joined,
        new RegExp(`\\b${col.name}\\b`),
        `Missing column ${table.name}.${col.name}`
      );
    }
    for (const idxName of table.expectedIndexes) {
      assert.match(
        joined,
        new RegExp(`CREATE INDEX IF NOT EXISTS ${idxName}\\b`),
        `Missing index ${idxName}`
      );
    }
  }
});

test('SQLite-to-PostgreSQL compatibility coercions preserve hashes, booleans, ints, and timestamps', () => {
  const existingHash = hashPassword('PharmVerify#2026');
  const normalizedUser = normalizeRowValuesForPostgres('users', {
    id: 7,
    full_name: 'Student Tester',
    email: 'tester@example.edu',
    password_hash: existingHash,
    institution: 'Pharmacy College',
    course: 'B.Pharm',
    semester_or_year: 'Semester 5',
    role: 'student',
    status: 'active',
    created_at: '2026-05-01T10:00:00.000Z',
    avatar_url: '',
    bio: '',
    preferred_program: 'B.Pharm',
    preferred_subjects: '["Pharmacology"]',
  });

  assert.equal(verifyPassword('PharmVerify#2026', String(normalizedUser.password_hash)), true);
  assert.equal(normalizedUser.id, 7);

  const normalizedVoice = normalizeRowValuesForPostgres('voices', {
    id: 1,
    user_id: null,
    author_name: 'Student',
    institution: 'Institute',
    course_details: 'B.Pharm',
    experience_type: 'Event',
    quote: 'Concise quote here.',
    story: 'Detailed experience text for verification.',
    photo_url: '',
    allow_photo: 1,
    status: 'pending',
    created_at: new Date('2026-05-01T12:00:00.000Z'),
  });
  assert.equal(normalizedVoice.allow_photo, true);
  assert.equal(normalizedVoice.user_id, null);
  assert.equal(normalizedVoice.created_at, '2026-05-01T12:00:00.000Z');

  assert.equal(toPgBoolean(0), false);
  assert.equal(toPgBoolean(1), true);
  assert.equal(toPgInt('42'), 42);
  assert.equal(toIsoTimestamp(new Date('2026-05-01T12:00:00.000Z')).slice(0, 10), '2026-05-01');
});
