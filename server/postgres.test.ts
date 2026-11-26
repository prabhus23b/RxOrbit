import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPoolConfig,
  closePostgresPool,
  getPostgresPool,
  inspectDatabaseUrlSafety,
  normalizeDatabaseUrl,
  redactConnectionSecrets,
} from './postgres';

test('normalizeDatabaseUrl cleans accidental key prefix, psql prefix, and quotes', () => {
  assert.equal(
    normalizeDatabaseUrl('  DATABASE_URL="postgresql://postgres.proj:secret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"  '),
    'postgresql://postgres.proj:secret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
  );
  assert.equal(
    normalizeDatabaseUrl("psql 'postgresql://postgres.proj:secret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'"),
    'postgresql://postgres.proj:secret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
  );
});

test('buildPoolConfig configures Supabase Session Pooler with explicit fields and SSL enabled', () => {
  const cfg = buildPoolConfig(
    'postgresql://postgres.gasdltynmhuepvnykjph:p@ss#word/1@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require'
  );

  assert.equal(cfg.connectionString, undefined);
  assert.equal(cfg.host, 'aws-1-ap-south-1.pooler.supabase.com');
  assert.equal(cfg.port, 5432);
  assert.equal(cfg.user, 'postgres.gasdltynmhuepvnykjph');
  assert.equal(cfg.password, 'p@ss#word/1');
  assert.equal(cfg.database, 'postgres');
  assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
  assert.equal(cfg.connectionTimeoutMillis, 15_000);
  assert.equal(cfg.keepAlive, true);
});

test('inspectDatabaseUrlSafety reports Supabase Session Pooler metadata without leaking secrets', () => {
  const secretValue = 'sUp3r$ecretP@ss';
  const diag = inspectDatabaseUrlSafety(
    `postgresql://postgres.gasdltynmhuepvnykjph:${secretValue}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`
  );

  const serialized = JSON.stringify(diag);
  assert.equal(serialized.includes(secretValue), false);
  assert.equal(diag.configured, true);
  assert.equal(diag.protocolValid, true);
  assert.equal(diag.urlParseable, true);
  assert.equal(diag.host, 'aws-1-ap-south-1.pooler.supabase.com');
  assert.equal(diag.port, 5432);
  assert.equal(diag.isSupabasePoolerHost, true);
  assert.equal(diag.poolerMode, 'session');
  assert.equal(diag.usernameFormatValidForPooler, true);
  assert.equal(diag.passwordPresent, true);
  assert.equal(diag.passwordContainsUnencodedSpecialChars, true);
  assert.equal(diag.sslEnabled, true);
  assert.equal(diag.sslRejectUnauthorized, false);
});

test('getPostgresPool rejects non-URI DATABASE_URL instead of falling back to ENOTFOUND base', async () => {
  const prev = process.env.DATABASE_URL;
  await closePostgresPool();
  process.env.DATABASE_URL = 'not-a-valid-postgres-uri-37-chars-long';

  try {
    assert.throws(
      () => getPostgresPool(),
      (err: Error & { code?: string }) => err.code === 'INVALID_DATABASE_URL'
    );
  } finally {
    if (prev === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prev;
    }
    await closePostgresPool();
  }
});

test('redactConnectionSecrets strips credentials from connection URIs', () => {
  const redacted = redactConnectionSecrets(
    'Failed connecting to postgresql://postgres.abc:MySecret123@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
  );
  assert.equal(redacted.includes('MySecret123'), false);
  assert.ok(redacted.includes('postgresql://[REDACTED]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'));
});
