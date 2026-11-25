import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const MATERIALS_DIR = path.resolve(UPLOADS_DIR, 'materials');
export const MEDIA_DIR = path.resolve(UPLOADS_DIR, 'media');

fs.mkdirSync(MATERIALS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const dbPath = path.resolve(DATA_DIR, 'rxorbit.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    institution TEXT NOT NULL,
    course TEXT NOT NULL,
    semester_or_year TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS study_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    program TEXT NOT NULL,
    semester_or_spec TEXT NOT NULL,
    subject TEXT NOT NULL,
    material_type TEXT NOT NULL,
    description TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming',
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    venue_or_mode TEXT NOT NULL,
    poster_url TEXT NOT NULL,
    max_seats INTEGER NOT NULL DEFAULT 150,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    institution TEXT NOT NULL,
    course TEXT NOT NULL,
    semester_or_year TEXT NOT NULL,
    attendance_status TEXT NOT NULL DEFAULT 'registered',
    registration_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gallery_albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    event_date TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gallery_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL,
    event_date TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    section TEXT NOT NULL,
    bio TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    linkedin_url TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    institution TEXT NOT NULL,
    course_details TEXT NOT NULL,
    experience_type TEXT NOT NULL,
    quote TEXT NOT NULL,
    story TEXT NOT NULL,
    photo_url TEXT NOT NULL DEFAULT '',
    allow_photo INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_code TEXT NOT NULL UNIQUE,
    participant_name TEXT NOT NULL,
    participant_email TEXT NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    organization_name TEXT NOT NULL DEFAULT 'RxOrbit',
    template_title TEXT NOT NULL DEFAULT 'Certificate of Participation',
    template_subtitle TEXT NOT NULL DEFAULT 'This certificate is proudly awarded to',
    signatory_name TEXT NOT NULL DEFAULT '',
    signatory_role TEXT NOT NULL DEFAULT '',
    accent_color TEXT NOT NULL DEFAULT '#0D9488',
    issued_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Academic',
    link_path TEXT NOT NULL DEFAULT '/events',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_path TEXT NOT NULL DEFAULT '/',
    target_program TEXT NOT NULL DEFAULT 'All',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL,
    PRIMARY KEY (user_id, notification_id)
  );

  CREATE TABLE IF NOT EXISTS curriculum_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(program, name)
  );

  CREATE TABLE IF NOT EXISTS curriculum_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(unit_id, name)
  );
`);

// Ensure profile columns exist on pre-existing databases
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
const existingCols = new Set(userColumns.map((c) => c.name));
if (!existingCols.has('avatar_url')) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
}
if (!existingCols.has('bio')) {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
}
if (!existingCols.has('preferred_program')) {
  db.exec("ALTER TABLE users ADD COLUMN preferred_program TEXT NOT NULL DEFAULT 'All'");
}
if (!existingCols.has('preferred_subjects')) {
  db.exec("ALTER TABLE users ADD COLUMN preferred_subjects TEXT NOT NULL DEFAULT '[]'");
}

export async function initializeDatabase(): Promise<void> {
  // Intentionally leaves all content tables empty until real records are created by the owner/users.
}
