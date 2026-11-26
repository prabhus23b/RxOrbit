import dotenv from 'dotenv';
import {
  closePostgresPool,
  initializePostgresDatabase,
  isPostgresConfigured,
  pgHealthCheck,
} from './postgres';
import { auditPostgresCompatibility } from './schema-compat';
import { getStorageMode } from './storage';

dotenv.config();

async function main() {
  if (!isPostgresConfigured()) {
    console.error('[verify-postgres] DATABASE_URL is not configured in the server environment.');
    process.exitCode = 1;
    return;
  }

  const health = await pgHealthCheck();
  await initializePostgresDatabase();
  const report = await auditPostgresCompatibility();

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        latencyMs: health.latencyMs,
        storageMode: getStorageMode(),
        checkedTables: report.checkedTables,
        issues: report.issues,
      },
      null,
      2
    )
  );

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('[verify-postgres] Failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
