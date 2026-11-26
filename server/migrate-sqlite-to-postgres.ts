import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import { DATA_DIR } from './paths';
import {
  closePostgresPool,
  initializePostgresDatabase,
  isPostgresConfigured,
  pgQueryOne,
  pgWithTransaction,
  syncPostgresIdentitySequences,
} from './postgres';
import {
  RXORBIT_SCHEMA_CONTRACT,
  auditPostgresCompatibility,
  auditSqliteCompatibility,
  normalizeRowValuesForPostgres,
} from './schema-compat';
import {
  inferContentType,
  isSupabaseStorageConfigured,
  listLocalUploadFiles,
  uploadBufferToSupabase,
} from './storage';

dotenv.config();

// Strict foreign-key dependency order for migrating all 16 tables cleanly
export const TABLE_MIGRATION_ORDER = [
  'users',
  'admin_config',
  'curriculum_units',
  'curriculum_subjects',
  'study_materials',
  'events',
  'event_registrations',
  'gallery_albums',
  'gallery_photos',
  'team_members',
  'voices',
  'certificates',
  'announcements',
  'site_content',
  'notifications',
  'notification_reads',
] as const;

export interface TableMigrationSummary {
  table: string;
  sqliteRows: number;
  migratedRows: number;
  postgresRowsAfter: number;
}

export interface MigrationOptions {
  sqlitePath?: string;
  dryRun?: boolean;
  migrateUploads?: boolean;
}

export interface MigrationReport {
  dryRun: boolean;
  sqlitePath: string;
  postgresConfigured: boolean;
  storageMode: 'supabase' | 'local';
  tables: TableMigrationSummary[];
  uploadedFiles: number;
}

function getConflictClause(tableName: string): string {
  const contract = RXORBIT_SCHEMA_CONTRACT.find((t) => t.name === tableName);
  if (!contract) return 'ON CONFLICT DO NOTHING';
  if (contract.primaryKeyColumns.length === 1 && contract.primaryKeyColumns[0] === 'id') {
    return 'ON CONFLICT (id) DO NOTHING';
  }
  return `ON CONFLICT (${contract.primaryKeyColumns.join(', ')}) DO NOTHING`;
}

export async function runSqliteToPostgresMigration(
  options: MigrationOptions = {}
): Promise<MigrationReport> {
  const sqlitePath = path.resolve(
    options.sqlitePath || process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'rxorbit.sqlite')
  );
  const dryRun = Boolean(options.dryRun);
  const migrateUploads = Boolean(options.migrateUploads);

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found at '${sqlitePath}'.`);
  }

  const sqliteDb = new DatabaseSync(sqlitePath, { readOnly: true });
  const pgConfigured = isPostgresConfigured();

  try {
    const sqliteAudit = auditSqliteCompatibility(sqliteDb);
    if (!sqliteAudit.ok) {
      const firstErr = sqliteAudit.issues.map((i) => i.message).join('; ');
      throw new Error(`SQLite schema compatibility check failed: ${firstErr}`);
    }

    const tableSummaries: TableMigrationSummary[] = [];

    if (dryRun) {
      for (const table of TABLE_MIGRATION_ORDER) {
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Array<
          Record<string, unknown>
        >;
        for (const row of rows) {
          normalizeRowValuesForPostgres(table, row);
        }
        let pgCount = 0;
        if (pgConfigured) {
          const existingCount = await pgQueryOne<{ cnt: number }>(
            `SELECT COUNT(*)::int AS cnt FROM ${table}`
          ).catch(() => null);
          pgCount = Number(existingCount?.cnt ?? 0);
        }
        tableSummaries.push({
          table,
          sqliteRows: rows.length,
          migratedRows: 0,
          postgresRowsAfter: pgCount,
        });
      }

      const localFiles = await listLocalUploadFiles();
      return {
        dryRun: true,
        sqlitePath,
        postgresConfigured: pgConfigured,
        storageMode: isSupabaseStorageConfigured() ? 'supabase' : 'local',
        tables: tableSummaries,
        uploadedFiles: migrateUploads
          ? localFiles.materials.length + localFiles.media.length
          : 0,
      };
    }

    if (!pgConfigured) {
      throw new Error('DATABASE_URL must be configured to execute live PostgreSQL migration.');
    }

    await initializePostgresDatabase();
    const pgAudit = await auditPostgresCompatibility();
    if (!pgAudit.ok) {
      const details = pgAudit.issues.map((i) => i.message).join('; ');
      throw new Error(`PostgreSQL schema compatibility check failed: ${details}`);
    }

    await pgWithTransaction(async (client) => {
      for (const table of TABLE_MIGRATION_ORDER) {
        const contract = RXORBIT_SCHEMA_CONTRACT.find((t) => t.name === table)!;
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Array<
          Record<string, unknown>
        >;

        let insertedCount = 0;
        if (rows.length > 0) {
          const columns = contract.columns.map((c) => c.name);
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ${getConflictClause(table)}`;

          for (const rawRow of rows) {
            const normalized = normalizeRowValuesForPostgres(table, rawRow);
            const values = columns.map((col) => normalized[col]);
            const res = await client.query(sql, values);
            insertedCount += res.rowCount ?? 0;
          }
        }

        const countRes = await client.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM ${table}`
        );

        tableSummaries.push({
          table,
          sqliteRows: rows.length,
          migratedRows: insertedCount,
          postgresRowsAfter: Number(countRes.rows[0]?.cnt ?? 0),
        });
      }

      await syncPostgresIdentitySequences(client);
    });

    let uploadedFiles = 0;
    if (migrateUploads && isSupabaseStorageConfigured()) {
      const localFiles = await listLocalUploadFiles();
      for (const file of [...localFiles.materials, ...localFiles.media]) {
        const buffer = await fsp.readFile(file.fullPath);
        await uploadBufferToSupabase(file.key, buffer, inferContentType(file.filename));
        uploadedFiles += 1;
      }
    }

    return {
      dryRun: false,
      sqlitePath,
      postgresConfigured: true,
      storageMode: isSupabaseStorageConfigured() ? 'supabase' : 'local',
      tables: tableSummaries,
      uploadedFiles,
    };
  } finally {
    sqliteDb.close();
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const migrateUploads = args.includes('--migrate-uploads');
  const pathArg = args.find((a) => a.startsWith('--sqlite-path='));
  const sqlitePath = pathArg ? pathArg.slice('--sqlite-path='.length) : undefined;

  try {
    const report = await runSqliteToPostgresMigration({
      sqlitePath,
      dryRun,
      migrateUploads,
    });
    console.log(
      `[migration] Mode=${report.dryRun ? 'dry-run' : 'execute'} Storage=${report.storageMode} SQLite=${report.sqlitePath}`
    );
    for (const t of report.tables) {
      console.log(
        `  - ${t.table}: sqlite=${t.sqliteRows}, inserted=${t.migratedRows}, postgres=${t.postgresRowsAfter}`
      );
    }
    if (migrateUploads) {
      console.log(`[migration] Upload files processed: ${report.uploadedFiles}`);
    }
  } finally {
    await closePostgresPool();
  }
}

const isDirectExecution =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]).endsWith('migrate-sqlite-to-postgres.ts');

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error('[migration] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
