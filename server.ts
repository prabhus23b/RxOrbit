import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, initializeDatabase, MATERIALS_DIR, MEDIA_DIR, UPLOADS_DIR } from './server/db';
import { generateCertificatePdfBuffer } from './server/pdf';
import {
  hashPassword,
  isSafeHttpOrLocalUrl,
  safeResolveInside,
  sanitizeFileName,
  signToken,
  verifyPassword,
  verifyToken,
  type AuthTokenPayload,
} from './server/security';
import {
  BPHARM_SEMESTERS,
  filterStudyMaterials,
  normalizeCertificateCode,
  validateStudentRegistration,
} from './src/lib/domain';
import type {
  Certificate,
  CurriculumSubject,
  CurriculumUnit,
  MaterialType,
  NotificationCategory,
  NotificationItem,
  ProgramType,
  SiteContent,
  StudyMaterial,
  User,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
}

function parsePreferredSubjects(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
    }
  } catch {
    // ignore malformed json
  }
  return [];
}

function mapUser(row: Record<string, unknown>): User {
  const prefProg = String(row.preferred_program || 'All');
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    institution: String(row.institution),
    course: String(row.course) as User['course'],
    semesterOrYear: String(row.semester_or_year),
    avatarUrl: String(row.avatar_url || ''),
    bio: String(row.bio || ''),
    preferredProgram: (['All', 'B.Pharm', 'M.Pharm'].includes(prefProg)
      ? prefProg
      : 'All') as User['preferredProgram'],
    preferredSubjects: parsePreferredSubjects(row.preferred_subjects),
    role: String(row.role) as User['role'],
    status: String(row.status) as User['status'],
    createdAt: String(row.created_at),
  };
}

function createNotification(input: {
  userId?: number | null;
  category: NotificationCategory;
  title: string;
  message: string;
  linkPath: string;
  targetProgram?: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications (user_id, category, title, message, link_path, target_program, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.userId ?? null,
    input.category,
    input.title.slice(0, 180),
    input.message.slice(0, 400),
    input.linkPath || '/',
    input.targetProgram || 'All',
    now
  );
}

function mapCertificate(row: Record<string, unknown>): Certificate {
  return {
    id: Number(row.id),
    certificateCode: String(row.certificate_code),
    participantName: String(row.participant_name),
    participantEmail: String(row.participant_email),
    eventId: row.event_id ? Number(row.event_id) : null,
    eventName: String(row.event_name),
    eventDate: String(row.event_date),
    organizationName: String(row.organization_name),
    templateTitle: String(row.template_title),
    templateSubtitle: String(row.template_subtitle),
    signatoryName: String(row.signatory_name),
    signatoryRole: String(row.signatory_role),
    accentColor: String(row.accent_color),
    issuedAt: String(row.issued_at),
  };
}

function getSiteContentMap(): SiteContent {
  const rows = db.prepare('SELECT key, value FROM site_content').all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    heroTitle: map.heroTitle || 'RxOrbit',
    heroSubtitle:
      map.heroSubtitle ||
      'A pharmacy student educational community connecting B.Pharm and M.Pharm learners, educators, and student coordinators.',
    heroTagline: map.heroTagline || 'Connect · Discover · Advance',
    aboutSummary: map.aboutSummary || '',
    vision: map.vision || '',
    mission: map.mission || '',
    objectives: map.objectives || '',
    whyRxOrbit: map.whyRxOrbit || '',
    commitment: map.commitment || '',
    contactEmail: map.contactEmail || '',
    contactPhone: map.contactPhone || '',
    contactAddress: map.contactAddress || '',
    linkedinUrl: map.linkedinUrl || '',
    instagramUrl: map.instagramUrl || '',
    youtubeUrl: map.youtubeUrl || '',
  };
}

function getCurriculumUnits(): CurriculumUnit[] {
  const unitRows = db
    .prepare('SELECT * FROM curriculum_units ORDER BY program ASC, display_order ASC, id ASC')
    .all() as Array<Record<string, unknown>>;
  const subjectRows = db
    .prepare('SELECT * FROM curriculum_subjects ORDER BY display_order ASC, id ASC')
    .all() as Array<Record<string, unknown>>;

  const subjectsByUnit = new Map<number, CurriculumSubject[]>();
  for (const s of subjectRows) {
    const unitId = Number(s.unit_id);
    const list = subjectsByUnit.get(unitId) || [];
    list.push({
      id: Number(s.id),
      unitId,
      name: String(s.name),
      code: String(s.code || ''),
      displayOrder: Number(s.display_order || 0),
    });
    subjectsByUnit.set(unitId, list);
  }

  return unitRows.map((u) => {
    const id = Number(u.id);
    return {
      id,
      program: String(u.program) as ProgramType,
      name: String(u.name),
      displayOrder: Number(u.display_order || 0),
      subjects: subjectsByUnit.get(id) || [],
    };
  });
}

function ensureCurriculumUnitAndSubject(
  program: ProgramType,
  unitName: string,
  subjectName?: string,
  subjectCode = ''
): { unitId: number } {
  const now = new Date().toISOString();
  const semIndex = BPHARM_SEMESTERS.indexOf(unitName);
  const displayOrder = program === 'B.Pharm' && semIndex >= 0 ? semIndex + 1 : 50;

  let existingUnit = db
    .prepare('SELECT id FROM curriculum_units WHERE program = ? AND name = ?')
    .get(program, unitName) as { id: number } | undefined;

  if (!existingUnit) {
    const res = db
      .prepare(
        `INSERT INTO curriculum_units (program, name, display_order, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(program, unitName, displayOrder, now);
    existingUnit = { id: Number(res.lastInsertRowid) };
  }

  if (subjectName && subjectName.trim()) {
    const cleanSub = subjectName.trim();
    const existingSub = db
      .prepare('SELECT id FROM curriculum_subjects WHERE unit_id = ? AND name = ?')
      .get(existingUnit.id, cleanSub) as { id: number } | undefined;
    if (!existingSub) {
      db.prepare(
        `INSERT INTO curriculum_subjects (unit_id, name, code, display_order, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(existingUnit.id, cleanSub, subjectCode.trim(), 0, now);
    }
  }

  return { unitId: existingUnit.id };
}

function extractBearer(req: Request): AuthTokenPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return verifyToken(token, TOKEN_SECRET);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const decoded = extractBearer(req);
  if (!decoded) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const userRow = db
    .prepare('SELECT id, email, role, status FROM users WHERE id = ?')
    .get(decoded.sub) as { id: number; email: string; role: string; status: string } | undefined;
  if (!userRow || userRow.status !== 'active') {
    res.status(401).json({ error: 'Account is inactive or unavailable.' });
    return;
  }
  req.auth = {
    ...decoded,
    role: userRow.role as 'student' | 'admin',
  };
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    next();
  });
}

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MATERIALS_DIR),
    filename: (_req, file, cb) => {
      const safe = sanitizeFileName(file.originalname);
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/pdf' || ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are permitted for study materials.'));
    }
  },
});

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
    filename: (_req, file, cb) => {
      const safe = sanitizeFileName(file.originalname);
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WebP images are permitted.'));
    }
  },
});

async function startServer() {
  await initializeDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded media images safely
  app.get('/uploads/media/:filename', (req, res) => {
    const safePath = safeResolveInside(MEDIA_DIR, sanitizeFileName(req.params.filename));
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Media file not found.' });
      return;
    }
    res.sendFile(safePath);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ── Auth Routes ────────────────────────────────────────────────────────────
  app.get('/api/auth/admin-status', (_req, res) => {
    const envPasscode = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const row = db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND status = 'active'")
      .get() as { cnt: number };
    res.json({
      envPasscodeConfigured: envPasscode,
      hasClaimedAdmin: row.cnt > 0,
    });
  });

  app.post('/api/auth/admin-bootstrap', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const existingAdmin = db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
      .get() as { cnt: number };

    if (envPasscode || existingAdmin.cnt > 0) {
      res.status(403).json({
        error: 'Administrator account has already been configured. Please sign in normally.',
      });
      return;
    }

    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const institution = String(req.body.institution || 'RxOrbit National Secretariat').trim();

    const validationErr = validateStudentRegistration({
      fullName,
      email,
      password,
      institution,
      course: 'Educator',
      semesterOrYear: 'Administration',
    });
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
         VALUES (?, ?, ?, ?, 'Educator', 'Administration', 'admin', 'active', ?)`
      )
      .run(fullName, email, passwordHash, institution, now);

    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;
    const user = mapUser(userRow);
    const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
    res.status(201).json({ token, user });
  });

  app.post('/api/auth/admin-passcode-login', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (!envPasscode) {
      res.status(400).json({ error: 'Server ADMIN_PASSCODE is not configured.' });
      return;
    }
    const passcode = String(req.body.passcode || '');
    const a = Buffer.from(passcode);
    const b = Buffer.from(envPasscode);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Invalid administrator passcode.' });
      return;
    }

    const adminEmail = 'admin@rxorbit.org';
    let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail) as
      | Record<string, unknown>
      | undefined;
    if (!userRow) {
      const now = new Date().toISOString();
      const resInsert = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
           VALUES ('RxOrbit Administrator', ?, ?, 'RxOrbit Secretariat', 'Educator', 'Administration', 'admin', 'active', ?)`
        )
        .run(adminEmail, hashPassword(crypto.randomBytes(24).toString('hex')), now);
      userRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(resInsert.lastInsertRowid) as Record<string, unknown>;
    }
    const user = mapUser(userRow);
    const token = signToken({ sub: user.id, email: user.email, role: 'admin' }, TOKEN_SECRET);
    res.json({ token, user });
  });

  app.post('/api/auth/register', (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const institution = String(req.body.institution || '').trim();
    const course = String(req.body.course || '').trim();
    const semesterOrYear = String(req.body.semesterOrYear || '').trim();

    const validationErr = validateStudentRegistration({
      fullName,
      email,
      password,
      institution,
      course,
      semesterOrYear,
    });
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'student', 'active', ?)`
      )
      .run(fullName, email, passwordHash, institution, course, semesterOrYear, now);

    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;
    const user = mapUser(userRow);
    const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
    res.status(201).json({ token, user });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | Record<string, unknown>
      | undefined;
    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (String(userRow.status) !== 'active') {
      res.status(403).json({ error: 'Your account is currently suspended. Contact an administrator.' });
      return;
    }
    const user = mapUser(userRow);
    const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
    res.json({ token, user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.sub) as
      | Record<string, unknown>
      | undefined;
    if (!userRow) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: mapUser(userRow) });
  });

  app.patch('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const institution = String(req.body.institution || '').trim();
    const course = String(req.body.course || '').trim();
    const semesterOrYear = String(req.body.semesterOrYear || '').trim();
    const bio =
      req.body.bio !== undefined ? String(req.body.bio || '').trim().slice(0, 500) : undefined;
    const preferredProgramRaw =
      req.body.preferredProgram !== undefined
        ? String(req.body.preferredProgram || 'All').trim()
        : undefined;
    const preferredSubjectsRaw = Array.isArray(req.body.preferredSubjects)
      ? req.body.preferredSubjects
          .map((s: unknown) => String(s).trim())
          .filter(Boolean)
          .slice(0, 12)
      : undefined;

    if (fullName.length < 2 || institution.length < 2 || !semesterOrYear) {
      res.status(400).json({ error: 'Full name, institution, and semester/year are required.' });
      return;
    }
    if (!['B.Pharm', 'M.Pharm', 'Educator', 'Coordinator'].includes(course)) {
      res.status(400).json({ error: 'Invalid course selection.' });
      return;
    }
    if (
      preferredProgramRaw !== undefined &&
      !['All', 'B.Pharm', 'M.Pharm'].includes(preferredProgramRaw)
    ) {
      res.status(400).json({ error: 'Invalid preferred program selection.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.sub) as Record<
      string,
      unknown
    >;

    const nextBio = bio !== undefined ? bio : String(existing.bio || '');
    const nextPrefProg =
      preferredProgramRaw !== undefined
        ? preferredProgramRaw
        : String(existing.preferred_program || 'All');
    const nextPrefSubjects =
      preferredSubjectsRaw !== undefined
        ? JSON.stringify(preferredSubjectsRaw)
        : String(existing.preferred_subjects || '[]');

    db.prepare(
      `UPDATE users
       SET full_name = ?, institution = ?, course = ?, semester_or_year = ?,
           bio = ?, preferred_program = ?, preferred_subjects = ?
       WHERE id = ?`
    ).run(
      fullName,
      institution,
      course,
      semesterOrYear,
      nextBio,
      nextPrefProg,
      nextPrefSubjects,
      req.auth!.sub
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.sub) as Record<
      string,
      unknown
    >;
    res.json({ user: mapUser(updated) });
  });

  app.post(
    '/api/profile/avatar',
    requireAuth,
    imageUpload.single('avatar'),
    (req: AuthedRequest, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Please select a JPG, PNG, or WebP profile picture.' });
        return;
      }
      const avatarUrl = `/uploads/media/${req.file.filename}`;
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.auth!.sub);
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.sub) as Record<
        string,
        unknown
      >;
      res.json({ avatarUrl, user: mapUser(updated) });
    }
  );

  // ── Notifications ──────────────────────────────────────────────────────────
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const userRow = db
      .prepare('SELECT preferred_program FROM users WHERE id = ?')
      .get(req.auth!.sub) as { preferred_program?: string } | undefined;
    const prefProg = String(userRow?.preferred_program || 'All');

    const rows = db
      .prepare(
        `SELECT n.*, nr.read_at
         FROM notifications n
         LEFT JOIN notification_reads nr
           ON nr.notification_id = n.id AND nr.user_id = ?
         WHERE (n.user_id IS NULL OR n.user_id = ?)
           AND (n.target_program = 'All' OR ? = 'All' OR n.target_program = ?)
         ORDER BY n.id DESC
         LIMIT 40`
      )
      .all(req.auth!.sub, req.auth!.sub, prefProg, prefProg) as Array<Record<string, unknown>>;

    const notifications: NotificationItem[] = rows.map((r) => ({
      id: Number(r.id),
      category: String(r.category) as NotificationCategory,
      title: String(r.title),
      message: String(r.message),
      linkPath: String(r.link_path),
      targetProgram: String(r.target_program),
      isRead: Boolean(r.read_at),
      createdAt: String(r.created_at),
    }));

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!exists) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    db.prepare(
      `INSERT OR IGNORE INTO notification_reads (user_id, notification_id, read_at)
       VALUES (?, ?, ?)`
    ).run(req.auth!.sub, id, new Date().toISOString());
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR IGNORE INTO notification_reads (user_id, notification_id, read_at)
       SELECT ?, id, ?
       FROM notifications
       WHERE user_id IS NULL OR user_id = ?`
    ).run(req.auth!.sub, now, req.auth!.sub);
    res.json({ ok: true });
  });

  // ── Public Content & Announcements ─────────────────────────────────────────
  app.get('/api/content', (_req, res) => {
    const content = getSiteContentMap();
    const announcements = (
      db
        .prepare('SELECT * FROM announcements WHERE is_active = 1 ORDER BY id DESC')
        .all() as Array<Record<string, unknown>>
    ).map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      message: String(r.message),
      category: String(r.category),
      linkPath: String(r.link_path),
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
    }));
    res.json({ content, announcements });
  });

  // ── Study Hub & Curriculum ─────────────────────────────────────────────────
  app.get('/api/curriculum', (_req, res) => {
    res.json({ units: getCurriculumUnits() });
  });

  app.post('/api/admin/curriculum/units', requireAdmin, (req, res) => {
    const program = String(req.body.program || '').trim() as ProgramType;
    const name = String(req.body.name || '').trim();
    if (!['B.Pharm', 'M.Pharm'].includes(program) || name.length < 2) {
      res.status(400).json({ error: 'Valid program and unit/specialization name are required.' });
      return;
    }
    if (program === 'B.Pharm' && !BPHARM_SEMESTERS.includes(name)) {
      res.status(400).json({ error: 'B.Pharm units must be Semester 1 through Semester 8.' });
      return;
    }
    const { unitId } = ensureCurriculumUnitAndSubject(program, name);
    res.status(201).json({ unitId, units: getCurriculumUnits() });
  });

  app.delete('/api/admin/curriculum/units/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM curriculum_units WHERE id = ?').run(Number(req.params.id));
    res.json({ units: getCurriculumUnits() });
  });

  app.post('/api/admin/curriculum/subjects', requireAdmin, (req, res) => {
    const unitIdInput = req.body.unitId ? Number(req.body.unitId) : null;
    const program = String(req.body.program || '').trim() as ProgramType;
    const unitName = String(req.body.unitName || '').trim();
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim();

    if (name.length < 2) {
      res.status(400).json({ error: 'Subject name must be at least 2 characters.' });
      return;
    }

    let resolvedUnitId = unitIdInput;
    if (!resolvedUnitId) {
      if (!['B.Pharm', 'M.Pharm'].includes(program) || unitName.length < 2) {
        res.status(400).json({ error: 'Program and semester/specialization are required.' });
        return;
      }
      resolvedUnitId = ensureCurriculumUnitAndSubject(program, unitName).unitId;
    } else {
      const unitExists = db
        .prepare('SELECT id FROM curriculum_units WHERE id = ?')
        .get(resolvedUnitId);
      if (!unitExists) {
        res.status(404).json({ error: 'Curriculum semester or specialization not found.' });
        return;
      }
    }

    const dup = db
      .prepare('SELECT id FROM curriculum_subjects WHERE unit_id = ? AND LOWER(name) = LOWER(?)')
      .get(resolvedUnitId, name);
    if (dup) {
      res.status(409).json({ error: 'This subject is already configured for this unit.' });
      return;
    }

    db.prepare(
      `INSERT INTO curriculum_subjects (unit_id, name, code, display_order, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(resolvedUnitId, name, code, 0, new Date().toISOString());

    res.status(201).json({ units: getCurriculumUnits() });
  });

  app.delete('/api/admin/curriculum/subjects/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM curriculum_subjects WHERE id = ?').run(Number(req.params.id));
    res.json({ units: getCurriculumUnits() });
  });

  app.get('/api/materials', (req, res) => {
    const rows = db
      .prepare('SELECT * FROM study_materials ORDER BY id DESC')
      .all() as Array<Record<string, unknown>>;
    const allMaterials: StudyMaterial[] = rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      program: String(r.program) as ProgramType,
      semesterOrSpec: String(r.semester_or_spec),
      subject: String(r.subject),
      materialType: String(r.material_type) as MaterialType,
      description: String(r.description),
      fileName: String(r.file_name),
      fileUrl: `/api/materials/${Number(r.id)}/file`,
      fileSize: Number(r.file_size),
      uploadedBy: String(r.uploaded_by),
      downloads: Number(r.downloads),
      createdAt: String(r.created_at),
    }));

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const programParam = typeof req.query.program === 'string' ? req.query.program : 'All';
    const semParam =
      typeof req.query.semesterOrSpec === 'string' ? req.query.semesterOrSpec : 'All';
    const subParam = typeof req.query.subject === 'string' ? req.query.subject : 'All';
    const typeParam = typeof req.query.materialType === 'string' ? req.query.materialType : 'All';

    const hasFilters =
      Boolean(q.trim()) ||
      programParam !== 'All' ||
      semParam !== 'All' ||
      subParam !== 'All' ||
      typeParam !== 'All';

    const materials = hasFilters
      ? filterStudyMaterials(allMaterials, {
          program: (['B.Pharm', 'M.Pharm'].includes(programParam)
            ? programParam
            : 'All') as ProgramType | 'All',
          semesterOrSpec: semParam,
          subject: subParam,
          materialType: typeParam as MaterialType | 'All',
          query: q,
        })
      : allMaterials;

    res.json({ materials });
  });

  app.get('/api/materials/:id/file', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM study_materials WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Material not found.' });
      return;
    }
    const safePath = safeResolveInside(UPLOADS_DIR, String(row.file_path));
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'PDF file unavailable.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeFileName(String(row.file_name))}"`
    );
    res.sendFile(safePath);
  });

  app.get('/api/materials/:id/download', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM study_materials WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Material not found.' });
      return;
    }
    const safePath = safeResolveInside(UPLOADS_DIR, String(row.file_path));
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'PDF file unavailable.' });
      return;
    }
    db.prepare('UPDATE study_materials SET downloads = downloads + 1 WHERE id = ?').run(id);
    res.download(safePath, sanitizeFileName(String(row.file_name)));
  });

  app.post(
    '/api/admin/materials',
    requireAdmin,
    pdfUpload.single('file'),
    (req: AuthedRequest, res) => {
      const title = String(req.body.title || '').trim();
      const program = String(req.body.program || '').trim();
      const semesterOrSpec = String(req.body.semesterOrSpec || '').trim();
      const subject = String(req.body.subject || '').trim();
      const materialType = String(req.body.materialType || '').trim();
      const description = String(req.body.description || '').trim();

      if (!title || !program || !semesterOrSpec || !subject || !materialType) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'All material metadata fields are required.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Please select a PDF file to upload.' });
        return;
      }

      const uploaderRow = db
        .prepare('SELECT full_name FROM users WHERE id = ?')
        .get(req.auth!.sub) as { full_name: string } | undefined;

      const relPath = `materials/${req.file.filename}`;
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO study_materials (
            title, program, semester_or_spec, subject, material_type,
            description, file_name, file_path, file_size, uploaded_by, downloads, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
        )
        .run(
          title,
          program,
          semesterOrSpec,
          subject,
          materialType,
          description || `${subject} academic resource.`,
          sanitizeFileName(req.file.originalname),
          relPath,
          req.file.size,
          uploaderRow?.full_name || 'RxOrbit Admin',
          now
        );

      const newId = Number(result.lastInsertRowid);
      if (program === 'B.Pharm' || program === 'M.Pharm') {
        ensureCurriculumUnitAndSubject(program, semesterOrSpec, subject);
      }
      createNotification({
        category: 'material',
        title: `New ${program} ${materialType}: ${title}`,
        message: `Added under ${semesterOrSpec} · ${subject}.`,
        linkPath: `/study-hub?material=${newId}`,
        targetProgram: program === 'B.Pharm' || program === 'M.Pharm' ? program : 'All',
      });

      res.status(201).json({ id: newId });
    }
  );

  app.delete('/api/admin/materials/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT file_path FROM study_materials WHERE id = ?').get(id) as
      | { file_path: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Material not found.' });
      return;
    }
    const safePath = safeResolveInside(UPLOADS_DIR, row.file_path);
    if (safePath && fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
    db.prepare('DELETE FROM study_materials WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ── Events & Registrations ─────────────────────────────────────────────────
  app.get('/api/events', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT e.*, COUNT(r.id) as reg_count
         FROM events e
         LEFT JOIN event_registrations r ON r.event_id = e.id AND r.attendance_status != 'cancelled'
         WHERE e.status != 'draft'
         GROUP BY e.id
         ORDER BY e.event_date DESC`
      )
      .all() as Array<Record<string, unknown>>;
    res.json({
      events: rows.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        description: String(r.description),
        eventType: String(r.event_type),
        status: String(r.status),
        eventDate: String(r.event_date),
        eventTime: String(r.event_time),
        venueOrMode: String(r.venue_or_mode),
        posterUrl: String(r.poster_url),
        maxSeats: Number(r.max_seats),
        registrationCount: Number(r.reg_count || 0),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/events/:id/register', (req, res) => {
    const eventId = Number(req.params.id);
    const eventRow = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as
      | Record<string, unknown>
      | undefined;
    if (!eventRow || String(eventRow.status) !== 'upcoming') {
      res.status(400).json({ error: 'Registrations are only open for upcoming published events.' });
      return;
    }

    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const institution = String(req.body.institution || '').trim();
    const course = String(req.body.course || '').trim();
    const semesterOrYear = String(req.body.semesterOrYear || '').trim();

    if (
      fullName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      institution.length < 2 ||
      !course ||
      !semesterOrYear
    ) {
      res.status(400).json({ error: 'Please complete all event registration fields accurately.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, registration_code FROM event_registrations WHERE event_id = ? AND email = ?')
      .get(eventId, email) as { id: number; registration_code: string } | undefined;
    if (existing) {
      res.status(409).json({
        error: `You are already registered for this event (Code: ${existing.registration_code}).`,
      });
      return;
    }

    const regCountRow = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM event_registrations WHERE event_id = ? AND attendance_status != 'cancelled'"
      )
      .get(eventId) as { cnt: number };
    if (regCountRow.cnt >= Number(eventRow.max_seats)) {
      res.status(400).json({ error: 'Maximum participant capacity has been reached for this event.' });
      return;
    }

    const auth = extractBearer(req);
    const regCode = `REG-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO event_registrations (
          event_id, user_id, full_name, email, institution, course, semester_or_year,
          attendance_status, registration_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?)`
      )
      .run(
        eventId,
        auth ? auth.sub : null,
        fullName,
        email,
        institution,
        course,
        semesterOrYear,
        regCode,
        now
      );

    res.status(201).json({
      registration: {
        id: Number(result.lastInsertRowid),
        eventId,
        eventTitle: String(eventRow.title),
        eventDate: String(eventRow.event_date),
        fullName,
        email,
        institution,
        course,
        semesterOrYear,
        attendanceStatus: 'registered',
        registrationCode: regCode,
        createdAt: now,
      },
    });
  });

  app.get('/api/my/registrations', requireAuth, (req: AuthedRequest, res) => {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.auth!.sub) as {
      email: string;
    };
    const rows = db
      .prepare(
        `SELECT r.*, e.title as event_title, e.event_date as event_date
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.user_id = ? OR LOWER(r.email) = LOWER(?)
         ORDER BY r.id DESC`
      )
      .all(req.auth!.sub, user.email) as Array<Record<string, unknown>>;

    res.json({
      registrations: rows.map((r) => ({
        id: Number(r.id),
        eventId: Number(r.event_id),
        eventTitle: String(r.event_title),
        eventDate: String(r.event_date),
        userId: r.user_id ? Number(r.user_id) : null,
        fullName: String(r.full_name),
        email: String(r.email),
        institution: String(r.institution),
        course: String(r.course),
        semesterOrYear: String(r.semester_or_year),
        attendanceStatus: String(r.attendance_status),
        registrationCode: String(r.registration_code),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.get('/api/admin/events', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT e.*, COUNT(r.id) as reg_count
         FROM events e
         LEFT JOIN event_registrations r ON r.event_id = e.id AND r.attendance_status != 'cancelled'
         GROUP BY e.id
         ORDER BY e.id DESC`
      )
      .all() as Array<Record<string, unknown>>;
    res.json({
      events: rows.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        description: String(r.description),
        eventType: String(r.event_type),
        status: String(r.status),
        eventDate: String(r.event_date),
        eventTime: String(r.event_time),
        venueOrMode: String(r.venue_or_mode),
        posterUrl: String(r.poster_url),
        maxSeats: Number(r.max_seats),
        registrationCount: Number(r.reg_count || 0),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/admin/events', requireAdmin, imageUpload.single('poster'), (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const eventType = String(req.body.eventType || '').trim();
    const status = String(req.body.status || 'upcoming').trim();
    const eventDate = String(req.body.eventDate || '').trim();
    const eventTime = String(req.body.eventTime || '').trim();
    const venueOrMode = String(req.body.venueOrMode || '').trim();
    const maxSeats = Math.max(1, Number(req.body.maxSeats || 150));
    const posterUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.posterUrl || '');

    if (!title || !description || !eventType || !eventDate || !eventTime || !venueOrMode) {
      res.status(400).json({ error: 'All required event fields must be provided.' });
      return;
    }
    if (!isSafeHttpOrLocalUrl(posterUrl)) {
      res.status(400).json({ error: 'Invalid poster URL.' });
      return;
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO events (
          title, description, event_type, status, event_date, event_time,
          venue_or_mode, poster_url, max_seats, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        description,
        eventType,
        status,
        eventDate,
        eventTime,
        venueOrMode,
        posterUrl,
        maxSeats,
        now
      );

    const eventId = Number(result.lastInsertRowid);
    if (status === 'upcoming') {
      createNotification({
        category: 'event',
        title: `New Upcoming ${eventType}: ${title}`,
        message: `Scheduled for ${eventDate} (${eventTime}). Registrations are now open.`,
        linkPath: '/events',
        targetProgram: 'All',
      });
    }

    res.status(201).json({ id: eventId });
  });

  app.put('/api/admin/events/:id', requireAdmin, imageUpload.single('poster'), (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }
    const title = String(req.body.title ?? existing.title).trim();
    const description = String(req.body.description ?? existing.description).trim();
    const eventType = String(req.body.eventType ?? existing.event_type).trim();
    const status = String(req.body.status ?? existing.status).trim();
    const eventDate = String(req.body.eventDate ?? existing.event_date).trim();
    const eventTime = String(req.body.eventTime ?? existing.event_time).trim();
    const venueOrMode = String(req.body.venueOrMode ?? existing.venue_or_mode).trim();
    const maxSeats = Math.max(1, Number(req.body.maxSeats ?? existing.max_seats));
    const posterUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.posterUrl ?? existing.poster_url);

    if (!isSafeHttpOrLocalUrl(posterUrl)) {
      res.status(400).json({ error: 'Invalid poster URL.' });
      return;
    }

    db.prepare(
      `UPDATE events SET
        title = ?, description = ?, event_type = ?, status = ?, event_date = ?,
        event_time = ?, venue_or_mode = ?, poster_url = ?, max_seats = ?
       WHERE id = ?`
    ).run(
      title,
      description,
      eventType,
      status,
      eventDate,
      eventTime,
      venueOrMode,
      posterUrl,
      maxSeats,
      id
    );
    if (String(existing.status) !== 'upcoming' && status === 'upcoming') {
      createNotification({
        category: 'event',
        title: `Event Published: ${title}`,
        message: `${eventType} on ${eventDate} (${eventTime}) is now open for registration.`,
        linkPath: '/events',
        targetProgram: 'All',
      });
    }
    res.json({ ok: true });
  });

  app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  app.get('/api/admin/registrations', requireAdmin, (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;
    const sql = eventId
      ? `SELECT r.*, e.title as event_title, e.event_date as event_date
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.event_id = ?
         ORDER BY r.id DESC`
      : `SELECT r.*, e.title as event_title, e.event_date as event_date
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
         ORDER BY r.id DESC`;
    const rows = (eventId ? db.prepare(sql).all(eventId) : db.prepare(sql).all()) as Array<
      Record<string, unknown>
    >;
    res.json({
      registrations: rows.map((r) => ({
        id: Number(r.id),
        eventId: Number(r.event_id),
        eventTitle: String(r.event_title),
        eventDate: String(r.event_date),
        userId: r.user_id ? Number(r.user_id) : null,
        fullName: String(r.full_name),
        email: String(r.email),
        institution: String(r.institution),
        course: String(r.course),
        semesterOrYear: String(r.semester_or_year),
        attendanceStatus: String(r.attendance_status),
        registrationCode: String(r.registration_code),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.patch('/api/admin/registrations/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body.attendanceStatus || '');
    if (!['registered', 'attended', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid attendance status.' });
      return;
    }
    db.prepare('UPDATE event_registrations SET attendance_status = ? WHERE id = ?').run(status, id);
    res.json({ ok: true });
  });

  // ── Gallery ────────────────────────────────────────────────────────────────
  app.get('/api/gallery', (_req, res) => {
    const albums = (
      db
        .prepare(
          `SELECT a.*, COUNT(p.id) as photo_count
           FROM gallery_albums a
           LEFT JOIN gallery_photos p ON p.album_id = a.id
           GROUP BY a.id
           ORDER BY a.event_date DESC`
        )
        .all() as Array<Record<string, unknown>>
    ).map((a) => ({
      id: Number(a.id),
      title: String(a.title),
      category: String(a.category),
      eventDate: String(a.event_date),
      description: String(a.description),
      coverUrl: String(a.cover_url),
      photoCount: Number(a.photo_count || 0),
      createdAt: String(a.created_at),
    }));

    const photos = (
      db
        .prepare(
          `SELECT p.*, a.title as album_title
           FROM gallery_photos p
           JOIN gallery_albums a ON a.id = p.album_id
           ORDER BY p.id DESC`
        )
        .all() as Array<Record<string, unknown>>
    ).map((p) => ({
      id: Number(p.id),
      albumId: Number(p.album_id),
      albumTitle: String(p.album_title),
      imageUrl: String(p.image_url),
      caption: String(p.caption),
      eventDate: String(p.event_date),
      category: String(p.category),
      createdAt: String(p.created_at),
    }));

    res.json({ albums, photos });
  });

  app.post('/api/admin/gallery/albums', requireAdmin, imageUpload.single('cover'), (req, res) => {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const eventDate = String(req.body.eventDate || '').trim();
    const description = String(req.body.description || '').trim();
    const coverUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.coverUrl || '');

    if (!title || !category || !eventDate) {
      res.status(400).json({ error: 'Album title, category, and event date are required.' });
      return;
    }
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO gallery_albums (title, category, event_date, description, cover_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(title, category, eventDate, description, coverUrl, now);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.put('/api/admin/gallery/albums/:id', requireAdmin, imageUpload.single('cover'), (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM gallery_albums WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Album not found.' });
      return;
    }
    const title = String(req.body.title ?? existing.title).trim();
    const category = String(req.body.category ?? existing.category).trim();
    const eventDate = String(req.body.eventDate ?? existing.event_date).trim();
    const description = String(req.body.description ?? existing.description).trim();
    const coverUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.coverUrl ?? existing.cover_url);
    db.prepare(
      'UPDATE gallery_albums SET title = ?, category = ?, event_date = ?, description = ?, cover_url = ? WHERE id = ?'
    ).run(title, category, eventDate, description, coverUrl, id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/gallery/albums/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM gallery_albums WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/gallery/photos', requireAdmin, imageUpload.single('image'), (req, res) => {
    const albumId = Number(req.body.albumId);
    const caption = String(req.body.caption || '').trim();
    const eventDate = String(req.body.eventDate || '').trim();
    const category = String(req.body.category || '').trim();
    if (!albumId || !caption || !eventDate || !category) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Album, caption, category, and event date are required.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Please select an image file to upload.' });
      return;
    }
    const imageUrl = `/uploads/media/${req.file.filename}`;
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO gallery_photos (album_id, image_url, caption, event_date, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(albumId, imageUrl, caption, eventDate, category, now);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.delete('/api/admin/gallery/photos/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Team ───────────────────────────────────────────────────────────────────
  app.get('/api/team', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM team_members ORDER BY display_order ASC, id ASC')
      .all() as Array<Record<string, unknown>>;
    res.json({
      members: rows.map((r) => ({
        id: Number(r.id),
        fullName: String(r.full_name),
        designation: String(r.designation),
        section: String(r.section),
        bio: String(r.bio),
        photoUrl: String(r.photo_url),
        linkedinUrl: String(r.linkedin_url),
        email: String(r.email),
        displayOrder: Number(r.display_order),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/admin/team', requireAdmin, imageUpload.single('photo'), (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const designation = String(req.body.designation || '').trim();
    const section = String(req.body.section || '').trim();
    const bio = String(req.body.bio || '').trim();
    const linkedinUrl = String(req.body.linkedinUrl || '').trim();
    const email = String(req.body.email || '').trim();
    const displayOrder = Number(req.body.displayOrder || 10);
    const photoUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.photoUrl || '');

    if (!fullName || !designation || !section || !bio) {
      res.status(400).json({ error: 'Name, designation, section, and biography are required.' });
      return;
    }
    if (!isSafeHttpOrLocalUrl(linkedinUrl) || !isSafeHttpOrLocalUrl(photoUrl)) {
      res.status(400).json({ error: 'Invalid URL provided.' });
      return;
    }
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO team_members (
          full_name, designation, section, bio, photo_url, linkedin_url, email, display_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(fullName, designation, section, bio, photoUrl, linkedinUrl, email, displayOrder, now);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.put('/api/admin/team/:id', requireAdmin, imageUpload.single('photo'), (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }
    const fullName = String(req.body.fullName ?? existing.full_name).trim();
    const designation = String(req.body.designation ?? existing.designation).trim();
    const section = String(req.body.section ?? existing.section).trim();
    const bio = String(req.body.bio ?? existing.bio).trim();
    const linkedinUrl = String(req.body.linkedinUrl ?? existing.linkedin_url).trim();
    const email = String(req.body.email ?? existing.email).trim();
    const displayOrder = Number(req.body.displayOrder ?? existing.display_order);
    const photoUrl = req.file
      ? `/uploads/media/${req.file.filename}`
      : String(req.body.photoUrl ?? existing.photo_url);
    if (!isSafeHttpOrLocalUrl(linkedinUrl) || !isSafeHttpOrLocalUrl(photoUrl)) {
      res.status(400).json({ error: 'Invalid URL provided.' });
      return;
    }
    db.prepare(
      `UPDATE team_members SET
        full_name = ?, designation = ?, section = ?, bio = ?, photo_url = ?,
        linkedin_url = ?, email = ?, display_order = ?
       WHERE id = ?`
    ).run(fullName, designation, section, bio, photoUrl, linkedinUrl, email, displayOrder, id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/team/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM team_members WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Voices of RxOrbit ──────────────────────────────────────────────────────
  app.get('/api/voices', (_req, res) => {
    const rows = db
      .prepare("SELECT * FROM voices WHERE status = 'approved' ORDER BY id DESC")
      .all() as Array<Record<string, unknown>>;
    res.json({
      voices: rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id ? Number(r.user_id) : null,
        authorName: String(r.author_name),
        institution: String(r.institution),
        courseDetails: String(r.course_details),
        experienceType: String(r.experience_type),
        quote: String(r.quote),
        story: String(r.story),
        photoUrl: Boolean(r.allow_photo) ? String(r.photo_url) : '',
        allowPhoto: Boolean(r.allow_photo),
        status: String(r.status),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.get('/api/my/voices', requireAuth, (req: AuthedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM voices WHERE user_id = ? ORDER BY id DESC')
      .all(req.auth!.sub) as Array<Record<string, unknown>>;
    res.json({
      voices: rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id ? Number(r.user_id) : null,
        authorName: String(r.author_name),
        institution: String(r.institution),
        courseDetails: String(r.course_details),
        experienceType: String(r.experience_type),
        quote: String(r.quote),
        story: String(r.story),
        photoUrl: String(r.photo_url),
        allowPhoto: Boolean(r.allow_photo),
        status: String(r.status),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/voices', requireAuth, imageUpload.single('photo'), (req: AuthedRequest, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.sub) as Record<
      string,
      unknown
    >;
    const experienceType = String(req.body.experienceType || 'Student Experience').trim();
    const quote = String(req.body.quote || '').trim();
    const story = String(req.body.story || '').trim();
    const allowPhoto = req.body.allowPhoto === 'true' || req.body.allowPhoto === true;
    const courseDetails = String(
      req.body.courseDetails || `${user.course} · ${user.semester_or_year}`
    ).trim();
    const photoUrl = allowPhoto && req.file ? `/uploads/media/${req.file.filename}` : '';

    if (quote.length < 15 || story.length < 30) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(400).json({
        error: 'Please share a concise headline quote (15+ chars) and full experience (30+ chars).',
      });
      return;
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO voices (
          user_id, author_name, institution, course_details, experience_type,
          quote, story, photo_url, allow_photo, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(
        req.auth!.sub,
        String(user.full_name),
        String(user.institution),
        courseDetails,
        experienceType,
        quote,
        story,
        photoUrl,
        allowPhoto ? 1 : 0,
        now
      );

    res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
  });

  app.get('/api/admin/voices', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM voices ORDER BY id DESC').all() as Array<
      Record<string, unknown>
    >;
    res.json({
      voices: rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id ? Number(r.user_id) : null,
        authorName: String(r.author_name),
        institution: String(r.institution),
        courseDetails: String(r.course_details),
        experienceType: String(r.experience_type),
        quote: String(r.quote),
        story: String(r.story),
        photoUrl: String(r.photo_url),
        allowPhoto: Boolean(r.allow_photo),
        status: String(r.status),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.patch('/api/admin/voices/:id', requireAdmin, (req, res) => {
    const status = String(req.body.status || '');
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      res.status(400).json({ error: 'Invalid review status.' });
      return;
    }
    db.prepare('UPDATE voices SET status = ? WHERE id = ?').run(status, Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete('/api/admin/voices/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM voices WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Certificates & Verification ────────────────────────────────────────────
  app.get('/api/certificates/verify/:code', (req, res) => {
    const code = normalizeCertificateCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Certificate ID is required.' });
      return;
    }
    const row = db
      .prepare('SELECT * FROM certificates WHERE UPPER(certificate_code) = ?')
      .get(code) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'No verified certificate found with that ID.' });
      return;
    }
    res.json({ certificate: mapCertificate(row) });
  });

  app.get('/api/certificates/:code/pdf', async (req, res) => {
    const code = normalizeCertificateCode(req.params.code);
    const row = db
      .prepare('SELECT * FROM certificates WHERE UPPER(certificate_code) = ?')
      .get(code) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Certificate not found.' });
      return;
    }
    const cert = mapCertificate(row);
    const pdfBuf = await generateCertificatePdfBuffer(cert);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RxOrbit_Certificate_${cert.certificateCode}.pdf"`
    );
    res.send(pdfBuf);
  });

  app.get('/api/my/certificates', requireAuth, (req: AuthedRequest, res) => {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.auth!.sub) as {
      email: string;
    };
    const rows = db
      .prepare('SELECT * FROM certificates WHERE LOWER(participant_email) = LOWER(?) ORDER BY id DESC')
      .all(user.email) as Array<Record<string, unknown>>;
    res.json({ certificates: rows.map(mapCertificate) });
  });

  app.get('/api/admin/certificates', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM certificates ORDER BY id DESC').all() as Array<
      Record<string, unknown>
    >;
    res.json({ certificates: rows.map(mapCertificate) });
  });

  app.post('/api/admin/certificates', requireAdmin, (req, res) => {
    const participantName = String(req.body.participantName || '').trim();
    const participantEmail = String(req.body.participantEmail || '').trim().toLowerCase();
    const eventId = req.body.eventId ? Number(req.body.eventId) : null;
    const eventName = String(req.body.eventName || '').trim();
    const eventDate = String(req.body.eventDate || '').trim();
    const organizationName = String(req.body.organizationName || 'RxOrbit').trim();
    const templateTitle = String(req.body.templateTitle || 'Certificate of Participation').trim();
    const templateSubtitle = String(
      req.body.templateSubtitle || 'This certificate is proudly awarded to'
    ).trim();
    const signatoryName = String(req.body.signatoryName || '').trim();
    const signatoryRole = String(req.body.signatoryRole || '').trim();
    const accentColor = String(req.body.accentColor || '#0D9488').trim();

    if (!participantName || !participantEmail || !eventName || !eventDate) {
      res.status(400).json({
        error: 'Participant name, email, event name, and event date are required.',
      });
      return;
    }

    let code = `RXO-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
    while (db.prepare('SELECT id FROM certificates WHERE certificate_code = ?').get(code)) {
      code = `RXO-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
    }
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO certificates (
          certificate_code, participant_name, participant_email, event_id, event_name,
          event_date, organization_name, template_title, template_subtitle,
          signatory_name, signatory_role, accent_color, issued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        participantName,
        participantEmail,
        eventId,
        eventName,
        eventDate,
        organizationName,
        templateTitle,
        templateSubtitle,
        signatoryName,
        signatoryRole,
        accentColor,
        now
      );

    const row = db
      .prepare('SELECT * FROM certificates WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ certificate: mapCertificate(row) });
  });

  app.delete('/api/admin/certificates/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM certificates WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin Overview, Students, Announcements, Content ───────────────────────
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const count = (sql: string) => (db.prepare(sql).get() as { cnt: number }).cnt;
    res.json({
      stats: {
        students: count("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'"),
        materials: count('SELECT COUNT(*) as cnt FROM study_materials'),
        events: count('SELECT COUNT(*) as cnt FROM events'),
        registrations: count('SELECT COUNT(*) as cnt FROM event_registrations'),
        galleryPhotos: count('SELECT COUNT(*) as cnt FROM gallery_photos'),
        teamMembers: count('SELECT COUNT(*) as cnt FROM team_members'),
        pendingVoices: count("SELECT COUNT(*) as cnt FROM voices WHERE status = 'pending'"),
        certificates: count('SELECT COUNT(*) as cnt FROM certificates'),
      },
    });
  });

  app.get('/api/admin/students', requireAdmin, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM users ORDER BY id DESC')
      .all() as Array<Record<string, unknown>>;
    res.json({ users: rows.map(mapUser) });
  });

  app.patch('/api/admin/students/:id', requireAdmin, (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const role = String(req.body.role ?? existing.role);
    const status = String(req.body.status ?? existing.status);
    if (!['student', 'admin'].includes(role) || !['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid role or status.' });
      return;
    }
    if (id === req.auth!.sub && (role !== 'admin' || status !== 'active')) {
      res.status(400).json({ error: 'You cannot demote or suspend your own active admin account.' });
      return;
    }
    db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(role, status, id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/students/:id', requireAdmin, (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (id === req.auth!.sub) {
      res.status(400).json({ error: 'You cannot delete your own active admin account.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  app.get('/api/admin/announcements', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all() as Array<
      Record<string, unknown>
    >;
    res.json({
      announcements: rows.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        message: String(r.message),
        category: String(r.category),
        linkPath: String(r.link_path),
        isActive: Boolean(r.is_active),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/admin/announcements', requireAdmin, (req, res) => {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const category = String(req.body.category || 'Academic').trim();
    const linkPath = String(req.body.linkPath || '/events').trim();
    const isActive = req.body.isActive !== false;
    if (!title || !message) {
      res.status(400).json({ error: 'Announcement title and message are required.' });
      return;
    }
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO announcements (title, message, category, link_path, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(title, message, category, linkPath, isActive ? 1 : 0, now);

    if (isActive) {
      createNotification({
        category: 'announcement',
        title: `Admin Announcement: ${title}`,
        message,
        linkPath: linkPath || '/',
        targetProgram: 'All',
      });
    }

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.patch('/api/admin/announcements/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Announcement not found.' });
      return;
    }
    const isActive =
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : Boolean(existing.is_active);
    db.prepare('UPDATE announcements SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/announcements/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.put('/api/admin/content', requireAdmin, (req, res) => {
    const allowedKeys: Array<keyof SiteContent> = [
      'heroTitle',
      'heroSubtitle',
      'heroTagline',
      'aboutSummary',
      'vision',
      'mission',
      'objectives',
      'whyRxOrbit',
      'commitment',
      'contactEmail',
      'contactPhone',
      'contactAddress',
      'linkedinUrl',
      'instagramUrl',
      'youtubeUrl',
    ];
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        upsert.run(key, String(req.body[key]), now);
      }
    }
    res.json({ content: getSiteContentMap() });
  });

  // Error handler for multer/upload/API errors
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(400).json({ error: msg });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RxOrbit server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RxOrbit server:', err);
  process.exit(1);
});
