import type { DatabaseSync } from 'node:sqlite';
import {
  isPostgresConfigured,
  pgQueryRows,
  toIsoTimestamp,
  toPgBoolean,
  toPgInt,
  type SqlParam,
} from './postgres';

export type PgExpectedType = 'integer' | 'text' | 'boolean' | 'timestamp with time zone';

export interface ColumnContract {
  name: string;
  pgType: PgExpectedType;
  sqliteType: 'INTEGER' | 'TEXT';
  notNull: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultPattern?: string;
}

export interface ForeignKeyContract {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface TableContract {
  name: string;
  hasIdentityPk: boolean;
  columns: readonly ColumnContract[];
  primaryKeyColumns: readonly string[];
  uniqueConstraints: readonly (readonly string[])[];
  foreignKeys: readonly ForeignKeyContract[];
  expectedIndexes: readonly string[];
}

export interface CompatibilityIssue {
  table: string;
  category: 'table' | 'column' | 'type' | 'nullability' | 'default' | 'primary_key' | 'unique' | 'foreign_key' | 'index';
  severity: 'error' | 'warning';
  message: string;
}

export interface CompatibilityReport {
  engine: 'sqlite' | 'postgres';
  ok: boolean;
  checkedTables: number;
  issues: CompatibilityIssue[];
}

export const RXORBIT_SCHEMA_CONTRACT: readonly TableContract[] = [
  {
    name: 'users',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [['email']],
    foreignKeys: [],
    expectedIndexes: ['idx_users_email_lower', 'idx_users_role_status'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'full_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'email', pgType: 'text', sqliteType: 'TEXT', notNull: true, unique: true },
      { name: 'password_hash', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'institution', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'course', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'semester_or_year', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'role', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'student'" },
      { name: 'status', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'active'" },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
      { name: 'avatar_url', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'bio', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'preferred_program', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'All'" },
      { name: 'preferred_subjects', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'[]'" },
    ],
  },
  {
    name: 'admin_config',
    hasIdentityPk: false,
    primaryKeyColumns: ['key'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: [],
    columns: [
      { name: 'key', pgType: 'text', sqliteType: 'TEXT', notNull: true, primaryKey: true },
      { name: 'value', pgType: 'text', sqliteType: 'TEXT', notNull: true },
    ],
  },
  {
    name: 'study_materials',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: ['idx_study_materials_program_sem'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'title', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'program', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'semester_or_spec', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'subject', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'material_type', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'description', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'file_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'file_path', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'file_size', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '0' },
      { name: 'uploaded_by', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'downloads', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '0' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'events',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: ['idx_events_status_date'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'title', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'description', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_type', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'status', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'upcoming'" },
      { name: 'event_date', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_time', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'venue_or_mode', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'poster_url', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'max_seats', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '150' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'event_registrations',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [['registration_code']],
    foreignKeys: [
      { column: 'event_id', referencesTable: 'events', referencesColumn: 'id', onDelete: 'CASCADE' },
      { column: 'user_id', referencesTable: 'users', referencesColumn: 'id', onDelete: 'SET NULL' },
    ],
    expectedIndexes: [
      'idx_event_registrations_event_id',
      'idx_event_registrations_user_id',
      'idx_event_registrations_event_email',
      'idx_event_registrations_email_lower',
    ],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'event_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true },
      { name: 'user_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: false },
      { name: 'full_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'email', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'institution', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'course', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'semester_or_year', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'attendance_status', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'registered'" },
      { name: 'registration_code', pgType: 'text', sqliteType: 'TEXT', notNull: true, unique: true },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'gallery_albums',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: [],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'title', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'category', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_date', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'description', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'cover_url', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'gallery_photos',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [
      { column: 'album_id', referencesTable: 'gallery_albums', referencesColumn: 'id', onDelete: 'CASCADE' },
    ],
    expectedIndexes: ['idx_gallery_photos_album_id'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'album_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true },
      { name: 'image_url', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'caption', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_date', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'category', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'team_members',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: ['idx_team_members_order'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'full_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'designation', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'section', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'bio', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'photo_url', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'linkedin_url', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'email', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'display_order', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '0' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'voices',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [
      { column: 'user_id', referencesTable: 'users', referencesColumn: 'id', onDelete: 'SET NULL' },
    ],
    expectedIndexes: ['idx_voices_status_created_at'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'user_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: false },
      { name: 'author_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'institution', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'course_details', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'experience_type', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'quote', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'story', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'photo_url', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'allow_photo', pgType: 'boolean', sqliteType: 'INTEGER', notNull: true, defaultPattern: 'false' },
      { name: 'status', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'pending'" },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'certificates',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [['certificate_code']],
    foreignKeys: [
      { column: 'event_id', referencesTable: 'events', referencesColumn: 'id', onDelete: 'SET NULL' },
    ],
    expectedIndexes: [
      'idx_certificates_event_id',
      'idx_certificates_code_upper',
      'idx_certificates_participant_email_lower',
    ],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'certificate_code', pgType: 'text', sqliteType: 'TEXT', notNull: true, unique: true },
      { name: 'participant_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'participant_email', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: false },
      { name: 'event_name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'event_date', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'organization_name', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'RxOrbit'" },
      { name: 'template_title', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'Certificate of Participation'" },
      { name: 'template_subtitle', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'This certificate is proudly awarded to'" },
      { name: 'signatory_name', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'signatory_role', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'accent_color', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'#0D9488'" },
      { name: 'issued_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'announcements',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: ['idx_announcements_is_active'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'title', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'message', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'category', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'Academic'" },
      { name: 'link_path', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'/events'" },
      { name: 'is_active', pgType: 'boolean', sqliteType: 'INTEGER', notNull: true, defaultPattern: 'true' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'site_content',
    hasIdentityPk: false,
    primaryKeyColumns: ['key'],
    uniqueConstraints: [],
    foreignKeys: [],
    expectedIndexes: [],
    columns: [
      { name: 'key', pgType: 'text', sqliteType: 'TEXT', notNull: true, primaryKey: true },
      { name: 'value', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'updated_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'notifications',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [],
    foreignKeys: [
      { column: 'user_id', referencesTable: 'users', referencesColumn: 'id', onDelete: 'CASCADE' },
    ],
    expectedIndexes: ['idx_notifications_user_created_at'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'user_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: false },
      { name: 'category', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'title', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'message', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'link_path', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'/'" },
      { name: 'target_program', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "'All'" },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'notification_reads',
    hasIdentityPk: false,
    primaryKeyColumns: ['user_id', 'notification_id'],
    uniqueConstraints: [],
    foreignKeys: [
      { column: 'user_id', referencesTable: 'users', referencesColumn: 'id', onDelete: 'CASCADE' },
      { column: 'notification_id', referencesTable: 'notifications', referencesColumn: 'id', onDelete: 'CASCADE' },
    ],
    expectedIndexes: ['idx_notification_reads_notification_id'],
    columns: [
      { name: 'user_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'notification_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'read_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'curriculum_units',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [['program', 'name']],
    foreignKeys: [],
    expectedIndexes: ['idx_curriculum_units_order'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'program', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'display_order', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '0' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
  {
    name: 'curriculum_subjects',
    hasIdentityPk: true,
    primaryKeyColumns: ['id'],
    uniqueConstraints: [['unit_id', 'name']],
    foreignKeys: [
      { column: 'unit_id', referencesTable: 'curriculum_units', referencesColumn: 'id', onDelete: 'CASCADE' },
    ],
    expectedIndexes: ['idx_curriculum_subjects_unit_id', 'idx_curriculum_subjects_unit_name_lower'],
    columns: [
      { name: 'id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, primaryKey: true },
      { name: 'unit_id', pgType: 'integer', sqliteType: 'INTEGER', notNull: true },
      { name: 'name', pgType: 'text', sqliteType: 'TEXT', notNull: true },
      { name: 'code', pgType: 'text', sqliteType: 'TEXT', notNull: true, defaultPattern: "''" },
      { name: 'display_order', pgType: 'integer', sqliteType: 'INTEGER', notNull: true, defaultPattern: '0' },
      { name: 'created_at', pgType: 'timestamp with time zone', sqliteType: 'TEXT', notNull: true, defaultPattern: 'now()' },
    ],
  },
];

export function auditSqliteCompatibility(sqliteDb: DatabaseSync): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];
  const existingTables = new Set(
    (
      sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    ).map((r) => r.name)
  );

  for (const contract of RXORBIT_SCHEMA_CONTRACT) {
    if (!existingTables.has(contract.name)) {
      issues.push({
        table: contract.name,
        category: 'table',
        severity: 'error',
        message: `Missing SQLite table '${contract.name}'.`,
      });
      continue;
    }

    const pragmaCols = sqliteDb.prepare(`PRAGMA table_info(${contract.name})`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
    const colMap = new Map(pragmaCols.map((c) => [c.name, c]));

    for (const expectedCol of contract.columns) {
      const actual = colMap.get(expectedCol.name);
      if (!actual) {
        issues.push({
          table: contract.name,
          category: 'column',
          severity: 'error',
          message: `Missing SQLite column '${contract.name}.${expectedCol.name}'.`,
        });
        continue;
      }

      if (actual.type.toUpperCase() !== expectedCol.sqliteType) {
        issues.push({
          table: contract.name,
          category: 'type',
          severity: 'error',
          message: `Column '${contract.name}.${expectedCol.name}' expected SQLite type ${expectedCol.sqliteType}, got ${actual.type}.`,
        });
      }

      // Note: SQLite PRAGMA table_info reports notnull=0 for PRIMARY KEY columns unless NOT NULL is explicitly written,
      // whereas PostgreSQL PRIMARY KEY always enforces NOT NULL.
      const sqliteRequiresNotNull = expectedCol.notNull && !expectedCol.primaryKey;
      if (sqliteRequiresNotNull && actual.notnull !== 1) {
        issues.push({
          table: contract.name,
          category: 'nullability',
          severity: 'error',
          message: `Column '${contract.name}.${expectedCol.name}' expected NOT NULL in SQLite.`,
        });
      }
    }

    const pragmaPks = pragmaCols
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);
    if (pragmaPks.join(',') !== contract.primaryKeyColumns.join(',')) {
      issues.push({
        table: contract.name,
        category: 'primary_key',
        severity: 'error',
        message: `Primary key mismatch on '${contract.name}': expected [${contract.primaryKeyColumns.join(', ')}], got [${pragmaPks.join(', ')}].`,
      });
    }

    const pragmaFks = sqliteDb.prepare(`PRAGMA foreign_key_list(${contract.name})`).all() as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    for (const expectedFk of contract.foreignKeys) {
      const match = pragmaFks.find(
        (fk) =>
          fk.from === expectedFk.column &&
          fk.table === expectedFk.referencesTable &&
          fk.to === expectedFk.referencesColumn &&
          fk.on_delete.toUpperCase() === expectedFk.onDelete
      );
      if (!match) {
        issues.push({
          table: contract.name,
          category: 'foreign_key',
          severity: 'error',
          message: `Missing or mismatched FK on '${contract.name}.${expectedFk.column}' -> ${expectedFk.referencesTable}(${expectedFk.referencesColumn}) ON DELETE ${expectedFk.onDelete}.`,
        });
      }
    }

    const pragmaIndexes = sqliteDb.prepare(`PRAGMA index_list(${contract.name})`).all() as Array<{
      name: string;
      unique: number;
    }>;
    const uniqueSets = new Set<string>();
    for (const idx of pragmaIndexes.filter((i) => i.unique === 1)) {
      const idxInfo = sqliteDb.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
      uniqueSets.add(idxInfo.map((c) => c.name).join(','));
    }
    for (const expectedUnique of contract.uniqueConstraints) {
      if (!uniqueSets.has(expectedUnique.join(','))) {
        issues.push({
          table: contract.name,
          category: 'unique',
          severity: 'error',
          message: `Missing UNIQUE constraint (${expectedUnique.join(', ')}) on SQLite table '${contract.name}'.`,
        });
      }
    }
  }

  return {
    engine: 'sqlite',
    ok: !issues.some((i) => i.severity === 'error'),
    checkedTables: RXORBIT_SCHEMA_CONTRACT.length,
    issues,
  };
}

export async function auditPostgresCompatibility(): Promise<CompatibilityReport> {
  if (!isPostgresConfigured()) {
    return {
      engine: 'postgres',
      ok: false,
      checkedTables: 0,
      issues: [
        {
          table: '*',
          category: 'table',
          severity: 'error',
          message: 'DATABASE_URL is not configured; live PostgreSQL schema check skipped.',
        },
      ],
    };
  }

  const issues: CompatibilityIssue[] = [];

  const cols = await pgQueryRows<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    is_identity: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default, is_identity
     FROM information_schema.columns
     WHERE table_schema = 'public'`
  );

  const constraints = await pgQueryRows<{
    table_name: string;
    constraint_name: string;
    constraint_type: string;
    column_name: string;
    ordinal_position: number;
  }>(
    `SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, kcu.ordinal_position
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
     ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position`
  );

  const fkRows = await pgQueryRows<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
  }>(
    `SELECT tc.table_name, kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     JOIN information_schema.referential_constraints rc
       ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
     WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'`
  );

  const indexRows = await pgQueryRows<{ tablename: string; indexname: string }>(
    `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'`
  );

  const colsByTable = new Map<string, Map<string, (typeof cols)[number]>>();
  for (const col of cols) {
    const map = colsByTable.get(col.table_name) ?? new Map();
    map.set(col.column_name, col);
    colsByTable.set(col.table_name, map);
  }

  const indexesByTable = new Map<string, Set<string>>();
  for (const idx of indexRows) {
    const set = indexesByTable.get(idx.tablename) ?? new Set<string>();
    set.add(idx.indexname);
    indexesByTable.set(idx.tablename, set);
  }

  for (const contract of RXORBIT_SCHEMA_CONTRACT) {
    const tableCols = colsByTable.get(contract.name);
    if (!tableCols) {
      issues.push({
        table: contract.name,
        category: 'table',
        severity: 'error',
        message: `Missing PostgreSQL table '${contract.name}'.`,
      });
      continue;
    }

    for (const expectedCol of contract.columns) {
      const actual = tableCols.get(expectedCol.name);
      if (!actual) {
        issues.push({
          table: contract.name,
          category: 'column',
          severity: 'error',
          message: `Missing PostgreSQL column '${contract.name}.${expectedCol.name}'.`,
        });
        continue;
      }

      if (actual.data_type !== expectedCol.pgType) {
        issues.push({
          table: contract.name,
          category: 'type',
          severity: 'error',
          message: `Column '${contract.name}.${expectedCol.name}' expected '${expectedCol.pgType}', got '${actual.data_type}'.`,
        });
      }

      const actualNotNull = actual.is_nullable === 'NO';
      if (actualNotNull !== expectedCol.notNull) {
        issues.push({
          table: contract.name,
          category: 'nullability',
          severity: 'error',
          message: `Column '${contract.name}.${expectedCol.name}' nullability mismatch (expected NOT NULL=${expectedCol.notNull}).`,
        });
      }

      if (expectedCol.primaryKey && contract.hasIdentityPk && actual.is_identity !== 'YES') {
        issues.push({
          table: contract.name,
          category: 'primary_key',
          severity: 'error',
          message: `Column '${contract.name}.${expectedCol.name}' is expected to be an IDENTITY primary key.`,
        });
      }

      if (expectedCol.defaultPattern) {
        const def = (actual.column_default ?? '').toLowerCase();
        if (!def.includes(expectedCol.defaultPattern.toLowerCase())) {
          issues.push({
            table: contract.name,
            category: 'default',
            severity: 'error',
            message: `Column '${contract.name}.${expectedCol.name}' default mismatch: expected pattern '${expectedCol.defaultPattern}', got '${actual.column_default ?? 'NULL'}'.`,
          });
        }
      }
    }

    const pkCols = constraints
      .filter((c) => c.table_name === contract.name && c.constraint_type === 'PRIMARY KEY')
      .map((c) => c.column_name);
    if (pkCols.join(',') !== contract.primaryKeyColumns.join(',')) {
      issues.push({
        table: contract.name,
        category: 'primary_key',
        severity: 'error',
        message: `Primary key mismatch on '${contract.name}': expected [${contract.primaryKeyColumns.join(', ')}], got [${pkCols.join(', ')}].`,
      });
    }

    const uniqueByName = new Map<string, string[]>();
    for (const c of constraints.filter((x) => x.table_name === contract.name && x.constraint_type === 'UNIQUE')) {
      const list = uniqueByName.get(c.constraint_name) ?? [];
      list.push(c.column_name);
      uniqueByName.set(c.constraint_name, list);
    }
    const uniqueSets = new Set(Array.from(uniqueByName.values()).map((colsList) => colsList.join(',')));
    for (const expectedUnique of contract.uniqueConstraints) {
      if (!uniqueSets.has(expectedUnique.join(','))) {
        issues.push({
          table: contract.name,
          category: 'unique',
          severity: 'error',
          message: `Missing UNIQUE constraint (${expectedUnique.join(', ')}) on '${contract.name}'.`,
        });
      }
    }

    const tableFks = fkRows.filter((fk) => fk.table_name === contract.name);
    for (const expectedFk of contract.foreignKeys) {
      const match = tableFks.find(
        (fk) =>
          fk.column_name === expectedFk.column &&
          fk.foreign_table_name === expectedFk.referencesTable &&
          fk.foreign_column_name === expectedFk.referencesColumn &&
          fk.delete_rule.toUpperCase() === expectedFk.onDelete
      );
      if (!match) {
        issues.push({
          table: contract.name,
          category: 'foreign_key',
          severity: 'error',
          message: `Missing or mismatched FK on '${contract.name}.${expectedFk.column}' -> ${expectedFk.referencesTable}(${expectedFk.referencesColumn}) ON DELETE ${expectedFk.onDelete}.`,
        });
      }
    }

    const actualIndexes = indexesByTable.get(contract.name) ?? new Set<string>();
    for (const expectedIndex of contract.expectedIndexes) {
      if (!actualIndexes.has(expectedIndex)) {
        issues.push({
          table: contract.name,
          category: 'index',
          severity: 'error',
          message: `Missing index '${expectedIndex}' on '${contract.name}'.`,
        });
      }
    }
  }

  return {
    engine: 'postgres',
    ok: !issues.some((i) => i.severity === 'error'),
    checkedTables: RXORBIT_SCHEMA_CONTRACT.length,
    issues,
  };
}

export function normalizeRowValuesForPostgres(
  tableName: string,
  row: Record<string, unknown>
): Record<string, SqlParam> {
  const contract = RXORBIT_SCHEMA_CONTRACT.find((t) => t.name === tableName);
  if (!contract) {
    throw new Error(`Unknown table '${tableName}' in schema contract.`);
  }

  const normalized: Record<string, SqlParam> = {};
  for (const col of contract.columns) {
    const raw = row[col.name];

    if (raw === undefined || raw === null) {
      if (col.notNull) {
        if (col.pgType === 'boolean') {
          normalized[col.name] = col.defaultPattern === 'true';
        } else if (col.pgType === 'integer') {
          normalized[col.name] = 0;
        } else if (col.pgType === 'timestamp with time zone') {
          normalized[col.name] = new Date().toISOString();
        } else {
          normalized[col.name] = '';
        }
      } else {
        normalized[col.name] = null;
      }
      continue;
    }

    if (col.pgType === 'boolean') {
      normalized[col.name] = toPgBoolean(raw);
    } else if (col.pgType === 'integer') {
      normalized[col.name] = toPgInt(raw);
    } else if (col.pgType === 'timestamp with time zone') {
      normalized[col.name] = toIsoTimestamp(raw as Date | string);
    } else {
      normalized[col.name] = String(raw);
    }
  }

  return normalized;
}
