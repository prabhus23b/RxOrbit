import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import multer from 'multer';
import type { PoolClient } from 'pg';
import { createServer as createViteServer } from 'vite';
import { MATERIALS_DIR, MEDIA_DIR } from './server/paths';
import { generateCertificatePdfBuffer } from './server/pdf';
import {
  closePostgresPool,
  initializePostgresDatabase,
  isPostgresConfigured,
  pgExecute,
  pgHealthCheck,
  pgQueryOne,
  pgQueryRows,
  pgWithTransaction,
  toIsoTimestamp,
  toPgBoolean,
  toPgInt,
} from './server/postgres';
import {
  hashPassword,
  isSafeHttpOrLocalUrl,
  sanitizeFileName,
  signToken,
  verifyPassword,
  verifyToken,
  type AuthTokenPayload,
} from './server/security';
import {
  deleteStoredMaterial,
  getStorageMode,
  persistMaterialUpload,
  persistMediaUpload,
  readStoredMaterial,
  readStoredMedia,
} from './server/storage';
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

type AsyncRouteHandler = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

const asyncHandler = (fn: AsyncRouteHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req as AuthedRequest, res, next)).catch(next);
  };
};

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

async function ensureSchemaReady(): Promise<void> {
  if (schemaInitialized) return;
  if (!schemaInitPromise) {
    schemaInitPromise = initializePostgresDatabase()
      .then(() => {
        schemaInitialized = true;
      })
      .catch((err) => {
        schemaInitPromise = null;
        throw err;
      });
  }
  await schemaInitPromise;
}

function safeUnlink(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup error
  }
}

function parsePositiveId(raw: unknown): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
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
    createdAt: toIsoTimestamp(row.created_at as Date | string),
  };
}

async function createNotification(
  input: {
    userId?: number | null;
    category: NotificationCategory;
    title: string;
    message: string;
    linkPath: string;
    targetProgram?: string;
  },
  client?: PoolClient
): Promise<void> {
  const now = new Date().toISOString();
  await pgExecute(
    `INSERT INTO notifications (user_id, category, title, message, link_path, target_program, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.userId ?? null,
      input.category,
      input.title.slice(0, 180),
      input.message.slice(0, 400),
      input.linkPath || '/',
      input.targetProgram || 'All',
      now,
    ],
    client
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
    issuedAt: toIsoTimestamp(row.issued_at as Date | string),
  };
}

async function getSiteContentMap(): Promise<SiteContent> {
  const rows = await pgQueryRows<{ key: string; value: string }>(
    'SELECT key, value FROM site_content'
  );
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

async function getCurriculumUnits(): Promise<CurriculumUnit[]> {
  const [unitRows, subjectRows] = await Promise.all([
    pgQueryRows<Record<string, unknown>>(
      'SELECT * FROM curriculum_units ORDER BY program ASC, display_order ASC, id ASC'
    ),
    pgQueryRows<Record<string, unknown>>(
      'SELECT * FROM curriculum_subjects ORDER BY display_order ASC, id ASC'
    ),
  ]);

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

async function ensureCurriculumUnitAndSubject(
  program: ProgramType,
  unitName: string,
  subjectName?: string,
  subjectCode = ''
): Promise<{ unitId: number }> {
  const now = new Date().toISOString();
  const semIndex = BPHARM_SEMESTERS.indexOf(unitName);
  const displayOrder = program === 'B.Pharm' && semIndex >= 0 ? semIndex + 1 : 50;

  let existingUnit = await pgQueryOne<{ id: number }>(
    'SELECT id FROM curriculum_units WHERE program = $1 AND name = $2',
    [program, unitName]
  );

  if (!existingUnit) {
    existingUnit = await pgQueryOne<{ id: number }>(
      `INSERT INTO curriculum_units (program, name, display_order, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (program, name) DO UPDATE SET display_order = curriculum_units.display_order
       RETURNING id`,
      [program, unitName, displayOrder, now]
    );
  }

  if (!existingUnit) {
    throw new Error('Failed to create or load curriculum unit.');
  }

  if (subjectName && subjectName.trim()) {
    const cleanSub = subjectName.trim();
    const existingSub = await pgQueryOne<{ id: number }>(
      'SELECT id FROM curriculum_subjects WHERE unit_id = $1 AND LOWER(name) = LOWER($2)',
      [existingUnit.id, cleanSub]
    );
    if (!existingSub) {
      await pgExecute(
        `INSERT INTO curriculum_subjects (unit_id, name, code, display_order, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (unit_id, name) DO NOTHING`,
        [existingUnit.id, cleanSub, subjectCode.trim(), 0, now]
      );
    }
  }

  return { unitId: Number(existingUnit.id) };
}

function extractBearer(req: Request): AuthTokenPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return verifyToken(token, TOKEN_SECRET);
}

async function authenticateRequest(req: AuthedRequest, res: Response): Promise<boolean> {
  const decoded = extractBearer(req);
  if (!decoded) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return false;
  }
  const userRow = await pgQueryOne<{ id: number; email: string; role: string; status: string }>(
    'SELECT id, email, role, status FROM users WHERE id = $1',
    [decoded.sub]
  );
  if (!userRow || userRow.status !== 'active') {
    res.status(401).json({ error: 'Account is inactive or unavailable.' });
    return false;
  }
  req.auth = {
    ...decoded,
    role: userRow.role as 'student' | 'admin',
  };
  return true;
}

const requireAuth: RequestHandler = (req, res, next) => {
  authenticateRequest(req as AuthedRequest, res)
    .then((ok) => {
      if (ok) next();
    })
    .catch(next);
};

const requireAdmin: RequestHandler = (req, res, next) => {
  authenticateRequest(req as AuthedRequest, res)
    .then((ok) => {
      if (!ok) return;
      if ((req as AuthedRequest).auth?.role !== 'admin') {
        res.status(403).json({ error: 'Administrator permission required.' });
        return;
      }
      next();
    })
    .catch(next);
};

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
      const err = new Error('Only PDF files are permitted for study materials.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 400;
      cb(err);
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
      const err = new Error('Only JPG, PNG, or WebP images are permitted.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 400;
      cb(err);
    }
  },
});

export async function createRxOrbitApp(options: { skipVite?: boolean } = {}) {
  if (isPostgresConfigured()) {
    try {
      await ensureSchemaReady();
    } catch (err) {
      console.error(
        '[postgres] Initial schema check deferred:',
        err instanceof Error ? err.message : 'Unable to connect on boot.'
      );
    }
  } else if (!options.skipVite) {
    console.warn(
      '[postgres] DATABASE_URL is not configured yet. Database API routes will return 503 until configured.'
    );
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded media images safely (local disk or Supabase Storage)
  app.get(
    '/uploads/media/:filename',
    asyncHandler(async (req, res) => {
      const media = await readStoredMedia(req.params.filename);
      if (!media) {
        res.status(404).json({ error: 'Media file not found.' });
        return;
      }
      if (media.localPath) {
        res.sendFile(media.localPath);
        return;
      }
      res.setHeader('Content-Type', media.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(media.buffer);
    })
  );

  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      const configured = isPostgresConfigured();
      const storageMode = getStorageMode();
      if (req.query.checkDb === '1' && configured) {
        const dbHealth = await pgHealthCheck();
        res.json({ ok: true, databaseConfigured: true, storageMode, database: dbHealth });
        return;
      }
      res.json({ ok: true, databaseConfigured: configured, storageMode });
    })
  );

  // Ensure PostgreSQL is configured and schema is initialized for database-backed API routes
  app.use(
    '/api',
    asyncHandler(async (_req, res, next) => {
      if (!isPostgresConfigured()) {
        res.status(503).json({
          error: 'PostgreSQL database is not configured. Set DATABASE_URL on the server.',
        });
        return;
      }
      await ensureSchemaReady();
      next();
    })
  );

  // ── Auth Routes ────────────────────────────────────────────────────────────
  app.get(
    '/api/auth/admin-status',
    asyncHandler(async (_req, res) => {
      const envPasscode = Boolean(process.env.ADMIN_PASSCODE?.trim());
      const row = await pgQueryOne<{ cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin' AND status = 'active'"
      );
      res.json({
        envPasscodeConfigured: envPasscode,
        hasClaimedAdmin: toPgInt(row?.cnt) > 0,
      });
    })
  );

  app.post(
    '/api/auth/admin-bootstrap',
    asyncHandler(async (req, res) => {
      const envPasscode = process.env.ADMIN_PASSCODE?.trim();
      if (envPasscode) {
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

      const outcome = await pgWithTransaction(async (client) => {
        const existingAdmin = await pgQueryOne<{ cnt: number }>(
          "SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'",
          [],
          client
        );
        if (toPgInt(existingAdmin?.cnt) > 0) {
          return {
            errorStatus: 403,
            error: 'Administrator account has already been configured. Please sign in normally.',
          } as const;
        }

        const existingEmail = await pgQueryOne<{ id: number }>(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
          [email],
          client
        );
        if (existingEmail) {
          return {
            errorStatus: 409,
            error: 'An account with this email already exists.',
          } as const;
        }

        const now = new Date().toISOString();
        const passwordHash = hashPassword(password);
        const userRow = await pgQueryOne<Record<string, unknown>>(
          `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
           VALUES ($1, $2, $3, $4, 'Educator', 'Administration', 'admin', 'active', $5)
           RETURNING *`,
          [fullName, email, passwordHash, institution, now],
          client
        );

        return { userRow } as const;
      });

      if (!('userRow' in outcome) || !outcome.userRow) {
        res.status(outcome.errorStatus ?? 400).json({ error: outcome.error ?? 'Failed to create admin account.' });
        return;
      }

      const user = mapUser(outcome.userRow);
      const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
      res.status(201).json({ token, user });
    })
  );

  app.post(
    '/api/auth/admin-passcode-login',
    asyncHandler(async (req, res) => {
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
      let userRow = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [adminEmail]
      );
      if (!userRow) {
        const now = new Date().toISOString();
        userRow = await pgQueryOne<Record<string, unknown>>(
          `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
           VALUES ('RxOrbit Administrator', $1, $2, 'RxOrbit Secretariat', 'Educator', 'Administration', 'admin', 'active', $3)
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
           RETURNING *`,
          [adminEmail, hashPassword(crypto.randomBytes(24).toString('hex')), now]
        );
      }
      const user = mapUser(userRow!);
      const token = signToken({ sub: user.id, email: user.email, role: 'admin' }, TOKEN_SECRET);
      res.json({ token, user });
    })
  );

  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
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

      const existing = await pgQueryOne<{ id: number }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);
      const userRow = await pgQueryOne<Record<string, unknown>>(
        `INSERT INTO users (full_name, email, password_hash, institution, course, semester_or_year, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'student', 'active', $7)
         RETURNING *`,
        [fullName, email, passwordHash, institution, course, semesterOrYear, now]
      );

      const user = mapUser(userRow!);
      const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
      res.status(201).json({ token, user });
    })
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }
      const userRow = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      if (String(userRow.status) !== 'active') {
        res
          .status(403)
          .json({ error: 'Your account is currently suspended. Contact an administrator.' });
        return;
      }
      const user = mapUser(userRow);
      const token = signToken({ sub: user.id, email: user.email, role: user.role }, TOKEN_SECRET);
      res.json({ token, user });
    })
  );

  app.get(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userRow = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json({ user: mapUser(userRow) });
    })
  );

  app.patch(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req, res) => {
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

      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!existing) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const nextBio = bio !== undefined ? bio : String(existing.bio || '');
      const nextPrefProg =
        preferredProgramRaw !== undefined
          ? preferredProgramRaw
          : String(existing.preferred_program || 'All');
      const nextPrefSubjects =
        preferredSubjectsRaw !== undefined
          ? JSON.stringify(preferredSubjectsRaw)
          : String(existing.preferred_subjects || '[]');

      const updated = await pgQueryOne<Record<string, unknown>>(
        `UPDATE users
         SET full_name = $1, institution = $2, course = $3, semester_or_year = $4,
             bio = $5, preferred_program = $6, preferred_subjects = $7
         WHERE id = $8
         RETURNING *`,
        [
          fullName,
          institution,
          course,
          semesterOrYear,
          nextBio,
          nextPrefProg,
          nextPrefSubjects,
          req.auth!.sub,
        ]
      );

      res.json({ user: mapUser(updated!) });
    })
  );

  app.post(
    '/api/profile/avatar',
    requireAuth,
    imageUpload.single('avatar'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Please select a JPG, PNG, or WebP profile picture.' });
        return;
      }
      const existing = await pgQueryOne<{ id: number }>(
        'SELECT id FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!existing) {
        safeUnlink(req.file.path);
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const avatarUrl = await persistMediaUpload(req.file);
      const updated = await pgQueryOne<Record<string, unknown>>(
        'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *',
        [avatarUrl, req.auth!.sub]
      );
      res.json({ avatarUrl, user: mapUser(updated!) });
    })
  );

  // ── Notifications ──────────────────────────────────────────────────────────
  app.get(
    '/api/notifications',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userRow = await pgQueryOne<{ preferred_program?: string }>(
        'SELECT preferred_program FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      const prefProg = String(userRow?.preferred_program || 'All');

      const rows = await pgQueryRows<Record<string, unknown>>(
        `SELECT n.*, nr.read_at
         FROM notifications n
         LEFT JOIN notification_reads nr
           ON nr.notification_id = n.id AND nr.user_id = $1
         WHERE (n.user_id IS NULL OR n.user_id = $2)
           AND (n.target_program = 'All' OR CAST($3 AS TEXT) = 'All' OR n.target_program = $4)
         ORDER BY n.id DESC
         LIMIT 40`,
        [req.auth!.sub, req.auth!.sub, prefProg, prefProg]
      );

      const notifications: NotificationItem[] = rows.map((r) => ({
        id: Number(r.id),
        category: String(r.category) as NotificationCategory,
        title: String(r.title),
        message: String(r.message),
        linkPath: String(r.link_path),
        targetProgram: String(r.target_program),
        isRead: Boolean(r.read_at),
        createdAt: toIsoTimestamp(r.created_at as Date | string),
      }));

      const unreadCount = notifications.filter((n) => !n.isRead).length;
      res.json({ notifications, unreadCount });
    })
  );

  app.post(
    '/api/notifications/:id/read',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid notification ID.' });
        return;
      }
      const exists = await pgQueryOne<{ id: number }>(
        'SELECT id FROM notifications WHERE id = $1',
        [id]
      );
      if (!exists) {
        res.status(404).json({ error: 'Notification not found.' });
        return;
      }
      await pgExecute(
        `INSERT INTO notification_reads (user_id, notification_id, read_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, notification_id) DO NOTHING`,
        [req.auth!.sub, id, new Date().toISOString()]
      );
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/notifications/read-all',
    requireAuth,
    asyncHandler(async (req, res) => {
      const now = new Date().toISOString();
      await pgExecute(
        `INSERT INTO notification_reads (user_id, notification_id, read_at)
         SELECT $1, id, $2
         FROM notifications
         WHERE user_id IS NULL OR user_id = $3
         ON CONFLICT (user_id, notification_id) DO NOTHING`,
        [req.auth!.sub, now, req.auth!.sub]
      );
      res.json({ ok: true });
    })
  );

  // ── Public Content & Announcements ─────────────────────────────────────────
  app.get(
    '/api/content',
    asyncHandler(async (_req, res) => {
      const [content, announcementRows] = await Promise.all([
        getSiteContentMap(),
        pgQueryRows<Record<string, unknown>>(
          'SELECT * FROM announcements WHERE is_active = TRUE ORDER BY id DESC'
        ),
      ]);
      const announcements = announcementRows.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        message: String(r.message),
        category: String(r.category),
        linkPath: String(r.link_path),
        isActive: toPgBoolean(r.is_active),
        createdAt: toIsoTimestamp(r.created_at as Date | string),
      }));
      res.json({ content, announcements });
    })
  );

  // ── Study Hub & Curriculum ─────────────────────────────────────────────────
  app.get(
    '/api/curriculum',
    asyncHandler(async (_req, res) => {
      res.json({ units: await getCurriculumUnits() });
    })
  );

  app.post(
    '/api/admin/curriculum/units',
    requireAdmin,
    asyncHandler(async (req, res) => {
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
      const { unitId } = await ensureCurriculumUnitAndSubject(program, name);
      res.status(201).json({ unitId, units: await getCurriculumUnits() });
    })
  );

  app.delete(
    '/api/admin/curriculum/units/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }
      await pgExecute('DELETE FROM curriculum_units WHERE id = $1', [id]);
      res.json({ units: await getCurriculumUnits() });
    })
  );

  app.post(
    '/api/admin/curriculum/subjects',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const unitIdInput = req.body.unitId ? parsePositiveId(req.body.unitId) : null;
      if (req.body.unitId && !unitIdInput) {
        res.status(400).json({ error: 'Invalid curriculum unit ID.' });
        return;
      }
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
        resolvedUnitId = (await ensureCurriculumUnitAndSubject(program, unitName)).unitId;
      } else {
        const unitExists = await pgQueryOne<{ id: number }>(
          'SELECT id FROM curriculum_units WHERE id = $1',
          [resolvedUnitId]
        );
        if (!unitExists) {
          res.status(404).json({ error: 'Curriculum semester or specialization not found.' });
          return;
        }
      }

      const dup = await pgQueryOne<{ id: number }>(
        'SELECT id FROM curriculum_subjects WHERE unit_id = $1 AND LOWER(name) = LOWER($2)',
        [resolvedUnitId, name]
      );
      if (dup) {
        res.status(409).json({ error: 'This subject is already configured for this unit.' });
        return;
      }

      await pgExecute(
        `INSERT INTO curriculum_subjects (unit_id, name, code, display_order, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [resolvedUnitId, name, code, 0, new Date().toISOString()]
      );

      res.status(201).json({ units: await getCurriculumUnits() });
    })
  );

  app.delete(
    '/api/admin/curriculum/subjects/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid subject ID.' });
        return;
      }
      await pgExecute('DELETE FROM curriculum_subjects WHERE id = $1', [id]);
      res.json({ units: await getCurriculumUnits() });
    })
  );

  app.get(
    '/api/materials',
    asyncHandler(async (req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM study_materials ORDER BY id DESC'
      );
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
        createdAt: toIsoTimestamp(r.created_at as Date | string),
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
    })
  );

  app.get(
    '/api/materials/:id/file',
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid material ID.' });
        return;
      }
      const row = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM study_materials WHERE id = $1',
        [id]
      );
      if (!row) {
        res.status(404).json({ error: 'Material not found.' });
        return;
      }
      const stored = await readStoredMaterial(String(row.file_path));
      if (!stored) {
        res.status(404).json({ error: 'PDF file unavailable.' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${sanitizeFileName(String(row.file_name))}"`
      );
      if (stored.localPath) {
        res.sendFile(stored.localPath);
        return;
      }
      res.send(stored.buffer);
    })
  );

  app.get(
    '/api/materials/:id/download',
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid material ID.' });
        return;
      }
      const row = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM study_materials WHERE id = $1',
        [id]
      );
      if (!row) {
        res.status(404).json({ error: 'Material not found.' });
        return;
      }
      const stored = await readStoredMaterial(String(row.file_path));
      if (!stored) {
        res.status(404).json({ error: 'PDF file unavailable.' });
        return;
      }
      await pgExecute('UPDATE study_materials SET downloads = downloads + 1 WHERE id = $1', [id]);
      const downloadName = sanitizeFileName(String(row.file_name));
      if (stored.localPath) {
        res.download(stored.localPath, downloadName);
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(stored.buffer);
    })
  );

  app.post(
    '/api/admin/materials',
    requireAdmin,
    pdfUpload.single('file'),
    asyncHandler(async (req, res) => {
      const title = String(req.body.title || '').trim();
      const program = String(req.body.program || '').trim();
      const semesterOrSpec = String(req.body.semesterOrSpec || '').trim();
      const subject = String(req.body.subject || '').trim();
      const materialType = String(req.body.materialType || '').trim();
      const description = String(req.body.description || '').trim();

      if (!title || !program || !semesterOrSpec || !subject || !materialType) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'All material metadata fields are required.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Please select a PDF file to upload.' });
        return;
      }

      const uploaderRow = await pgQueryOne<{ full_name: string }>(
        'SELECT full_name FROM users WHERE id = $1',
        [req.auth!.sub]
      );

      const relPath = await persistMaterialUpload(req.file);
      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO study_materials (
          title, program, semester_or_spec, subject, material_type,
          description, file_name, file_path, file_size, uploaded_by, downloads, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11)
        RETURNING id`,
        [
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
          now,
        ]
      );

      const newId = Number(inserted!.id);
      if (program === 'B.Pharm' || program === 'M.Pharm') {
        await ensureCurriculumUnitAndSubject(program, semesterOrSpec, subject);
      }
      await createNotification({
        category: 'material',
        title: `New ${program} ${materialType}: ${title}`,
        message: `Added under ${semesterOrSpec} · ${subject}.`,
        linkPath: `/study-hub?material=${newId}`,
        targetProgram: program === 'B.Pharm' || program === 'M.Pharm' ? program : 'All',
      });

      res.status(201).json({ id: newId });
    })
  );

  app.delete(
    '/api/admin/materials/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid material ID.' });
        return;
      }
      const row = await pgQueryOne<{ file_path: string }>(
        'SELECT file_path FROM study_materials WHERE id = $1',
        [id]
      );
      if (!row) {
        res.status(404).json({ error: 'Material not found.' });
        return;
      }
      await deleteStoredMaterial(row.file_path);
      await pgExecute('DELETE FROM study_materials WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  // ── Events & Registrations ─────────────────────────────────────────────────
  app.get(
    '/api/events',
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        `SELECT e.*, COUNT(r.id)::int AS reg_count
         FROM events e
         LEFT JOIN event_registrations r ON r.event_id = e.id AND r.attendance_status != 'cancelled'
         WHERE e.status != 'draft'
         GROUP BY e.id
         ORDER BY e.event_date DESC`
      );
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
          registrationCount: toPgInt(r.reg_count),
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.post(
    '/api/events/:id/register',
    asyncHandler(async (req, res) => {
      const eventId = parsePositiveId(req.params.id);
      if (!eventId) {
        res.status(400).json({ error: 'Invalid event ID.' });
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

      const auth = extractBearer(req);

      const outcome = await pgWithTransaction(async (client) => {
        const eventRow = await pgQueryOne<Record<string, unknown>>(
          'SELECT * FROM events WHERE id = $1 FOR UPDATE',
          [eventId],
          client
        );
        if (!eventRow || String(eventRow.status) !== 'upcoming') {
          return {
            errorStatus: 400,
            error: 'Registrations are only open for upcoming published events.',
          } as const;
        }

        const existing = await pgQueryOne<{ id: number; registration_code: string }>(
          'SELECT id, registration_code FROM event_registrations WHERE event_id = $1 AND LOWER(email) = LOWER($2)',
          [eventId, email],
          client
        );
        if (existing) {
          return {
            errorStatus: 409,
            error: `You are already registered for this event (Code: ${existing.registration_code}).`,
          } as const;
        }

        const regCountRow = await pgQueryOne<{ cnt: number }>(
          "SELECT COUNT(*)::int AS cnt FROM event_registrations WHERE event_id = $1 AND attendance_status != 'cancelled'",
          [eventId],
          client
        );
        if (toPgInt(regCountRow?.cnt) >= Number(eventRow.max_seats)) {
          return {
            errorStatus: 400,
            error: 'Maximum participant capacity has been reached for this event.',
          } as const;
        }

        const regCode = `REG-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
        const now = new Date().toISOString();
        const inserted = await pgQueryOne<{ id: number }>(
          `INSERT INTO event_registrations (
            event_id, user_id, full_name, email, institution, course, semester_or_year,
            attendance_status, registration_code, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', $8, $9)
          RETURNING id`,
          [
            eventId,
            auth ? auth.sub : null,
            fullName,
            email,
            institution,
            course,
            semesterOrYear,
            regCode,
            now,
          ],
          client
        );

        return {
          registration: {
            id: Number(inserted!.id),
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
        } as const;
      });

      if (!('registration' in outcome) || !outcome.registration) {
        res.status(outcome.errorStatus ?? 400).json({ error: outcome.error ?? 'Event registration failed.' });
        return;
      }

      res.status(201).json({ registration: outcome.registration });
    })
  );

  app.get(
    '/api/my/registrations',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await pgQueryOne<{ email: string }>(
        'SELECT email FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const rows = await pgQueryRows<Record<string, unknown>>(
        `SELECT r.*, e.title AS event_title, e.event_date AS event_date
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.user_id = $1 OR LOWER(r.email) = LOWER($2)
         ORDER BY r.id DESC`,
        [req.auth!.sub, user.email]
      );

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
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.get(
    '/api/admin/events',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        `SELECT e.*, COUNT(r.id)::int AS reg_count
         FROM events e
         LEFT JOIN event_registrations r ON r.event_id = e.id AND r.attendance_status != 'cancelled'
         GROUP BY e.id
         ORDER BY e.id DESC`
      );
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
          registrationCount: toPgInt(r.reg_count),
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.post(
    '/api/admin/events',
    requireAdmin,
    imageUpload.single('poster'),
    asyncHandler(async (req, res) => {
      const title = String(req.body.title || '').trim();
      const description = String(req.body.description || '').trim();
      const eventType = String(req.body.eventType || '').trim();
      const status = String(req.body.status || 'upcoming').trim();
      const eventDate = String(req.body.eventDate || '').trim();
      const eventTime = String(req.body.eventTime || '').trim();
      const venueOrMode = String(req.body.venueOrMode || '').trim();
      const maxSeats = Math.max(1, Number(req.body.maxSeats || 150));
      const rawPosterUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.posterUrl || '');

      if (!title || !description || !eventType || !eventDate || !eventTime || !venueOrMode) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'All required event fields must be provided.' });
        return;
      }
      if (!isSafeHttpOrLocalUrl(rawPosterUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid poster URL.' });
        return;
      }
      const posterUrl = req.file ? await persistMediaUpload(req.file) : rawPosterUrl;

      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO events (
          title, description, event_type, status, event_date, event_time,
          venue_or_mode, poster_url, max_seats, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          title,
          description,
          eventType,
          status,
          eventDate,
          eventTime,
          venueOrMode,
          posterUrl,
          maxSeats,
          now,
        ]
      );

      const eventId = Number(inserted!.id);
      if (status === 'upcoming') {
        await createNotification({
          category: 'event',
          title: `New Upcoming ${eventType}: ${title}`,
          message: `Scheduled for ${eventDate} (${eventTime}). Registrations are now open.`,
          linkPath: '/events',
          targetProgram: 'All',
        });
      }

      res.status(201).json({ id: eventId });
    })
  );

  app.put(
    '/api/admin/events/:id',
    requireAdmin,
    imageUpload.single('poster'),
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid event ID.' });
        return;
      }
      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM events WHERE id = $1',
        [id]
      );
      if (!existing) {
        safeUnlink(req.file?.path);
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
      const rawPosterUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.posterUrl ?? existing.poster_url);

      if (!isSafeHttpOrLocalUrl(rawPosterUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid poster URL.' });
        return;
      }
      const posterUrl = req.file ? await persistMediaUpload(req.file) : rawPosterUrl;

      await pgExecute(
        `UPDATE events SET
          title = $1, description = $2, event_type = $3, status = $4, event_date = $5,
          event_time = $6, venue_or_mode = $7, poster_url = $8, max_seats = $9
         WHERE id = $10`,
        [
          title,
          description,
          eventType,
          status,
          eventDate,
          eventTime,
          venueOrMode,
          posterUrl,
          maxSeats,
          id,
        ]
      );
      if (String(existing.status) !== 'upcoming' && status === 'upcoming') {
        await createNotification({
          category: 'event',
          title: `Event Published: ${title}`,
          message: `${eventType} on ${eventDate} (${eventTime}) is now open for registration.`,
          linkPath: '/events',
          targetProgram: 'All',
        });
      }
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/events/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid event ID.' });
        return;
      }
      await pgExecute('DELETE FROM events WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/admin/registrations',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const eventId = req.query.eventId ? parsePositiveId(req.query.eventId) : null;
      if (req.query.eventId && !eventId) {
        res.status(400).json({ error: 'Invalid event ID.' });
        return;
      }
      const rows = eventId
        ? await pgQueryRows<Record<string, unknown>>(
            `SELECT r.*, e.title AS event_title, e.event_date AS event_date
             FROM event_registrations r
             JOIN events e ON e.id = r.event_id
             WHERE r.event_id = $1
             ORDER BY r.id DESC`,
            [eventId]
          )
        : await pgQueryRows<Record<string, unknown>>(
            `SELECT r.*, e.title AS event_title, e.event_date AS event_date
             FROM event_registrations r
             JOIN events e ON e.id = r.event_id
             ORDER BY r.id DESC`
          );

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
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.patch(
    '/api/admin/registrations/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid registration ID.' });
        return;
      }
      const status = String(req.body.attendanceStatus || '');
      if (!['registered', 'attended', 'cancelled'].includes(status)) {
        res.status(400).json({ error: 'Invalid attendance status.' });
        return;
      }
      await pgExecute('UPDATE event_registrations SET attendance_status = $1 WHERE id = $2', [
        status,
        id,
      ]);
      res.json({ ok: true });
    })
  );

  // ── Gallery ────────────────────────────────────────────────────────────────
  app.get(
    '/api/gallery',
    asyncHandler(async (_req, res) => {
      const [albumRows, photoRows] = await Promise.all([
        pgQueryRows<Record<string, unknown>>(
          `SELECT a.*, COUNT(p.id)::int AS photo_count
           FROM gallery_albums a
           LEFT JOIN gallery_photos p ON p.album_id = a.id
           GROUP BY a.id
           ORDER BY a.event_date DESC`
        ),
        pgQueryRows<Record<string, unknown>>(
          `SELECT p.*, a.title AS album_title
           FROM gallery_photos p
           JOIN gallery_albums a ON a.id = p.album_id
           ORDER BY p.id DESC`
        ),
      ]);

      const albums = albumRows.map((a) => ({
        id: Number(a.id),
        title: String(a.title),
        category: String(a.category),
        eventDate: String(a.event_date),
        description: String(a.description),
        coverUrl: String(a.cover_url),
        photoCount: toPgInt(a.photo_count),
        createdAt: toIsoTimestamp(a.created_at as Date | string),
      }));

      const photos = photoRows.map((p) => ({
        id: Number(p.id),
        albumId: Number(p.album_id),
        albumTitle: String(p.album_title),
        imageUrl: String(p.image_url),
        caption: String(p.caption),
        eventDate: String(p.event_date),
        category: String(p.category),
        createdAt: toIsoTimestamp(p.created_at as Date | string),
      }));

      res.json({ albums, photos });
    })
  );

  app.post(
    '/api/admin/gallery/albums',
    requireAdmin,
    imageUpload.single('cover'),
    asyncHandler(async (req, res) => {
      const title = String(req.body.title || '').trim();
      const category = String(req.body.category || '').trim();
      const eventDate = String(req.body.eventDate || '').trim();
      const description = String(req.body.description || '').trim();
      const rawCoverUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.coverUrl || '');

      if (!title || !category || !eventDate) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Album title, category, and event date are required.' });
        return;
      }
      if (!isSafeHttpOrLocalUrl(rawCoverUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid cover URL.' });
        return;
      }
      const coverUrl = req.file ? await persistMediaUpload(req.file) : rawCoverUrl;
      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO gallery_albums (title, category, event_date, description, cover_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [title, category, eventDate, description, coverUrl, now]
      );
      res.status(201).json({ id: Number(inserted!.id) });
    })
  );

  app.put(
    '/api/admin/gallery/albums/:id',
    requireAdmin,
    imageUpload.single('cover'),
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid album ID.' });
        return;
      }
      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM gallery_albums WHERE id = $1',
        [id]
      );
      if (!existing) {
        safeUnlink(req.file?.path);
        res.status(404).json({ error: 'Album not found.' });
        return;
      }
      const title = String(req.body.title ?? existing.title).trim();
      const category = String(req.body.category ?? existing.category).trim();
      const eventDate = String(req.body.eventDate ?? existing.event_date).trim();
      const description = String(req.body.description ?? existing.description).trim();
      const rawCoverUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.coverUrl ?? existing.cover_url);
      if (!isSafeHttpOrLocalUrl(rawCoverUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid cover URL.' });
        return;
      }
      const coverUrl = req.file ? await persistMediaUpload(req.file) : rawCoverUrl;
      await pgExecute(
        'UPDATE gallery_albums SET title = $1, category = $2, event_date = $3, description = $4, cover_url = $5 WHERE id = $6',
        [title, category, eventDate, description, coverUrl, id]
      );
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/gallery/albums/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid album ID.' });
        return;
      }
      await pgExecute('DELETE FROM gallery_albums WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/admin/gallery/photos',
    requireAdmin,
    imageUpload.single('image'),
    asyncHandler(async (req, res) => {
      const albumId = parsePositiveId(req.body.albumId);
      const caption = String(req.body.caption || '').trim();
      const eventDate = String(req.body.eventDate || '').trim();
      const category = String(req.body.category || '').trim();
      if (!albumId || !caption || !eventDate || !category) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Album, caption, category, and event date are required.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Please select an image file to upload.' });
        return;
      }
      const albumExists = await pgQueryOne<{ id: number }>(
        'SELECT id FROM gallery_albums WHERE id = $1',
        [albumId]
      );
      if (!albumExists) {
        safeUnlink(req.file.path);
        res.status(404).json({ error: 'Gallery album not found.' });
        return;
      }
      const imageUrl = await persistMediaUpload(req.file);
      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO gallery_photos (album_id, image_url, caption, event_date, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [albumId, imageUrl, caption, eventDate, category, now]
      );
      res.status(201).json({ id: Number(inserted!.id) });
    })
  );

  app.delete(
    '/api/admin/gallery/photos/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid photo ID.' });
        return;
      }
      await pgExecute('DELETE FROM gallery_photos WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  // ── Team ───────────────────────────────────────────────────────────────────
  app.get(
    '/api/team',
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM team_members ORDER BY display_order ASC, id ASC'
      );
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
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.post(
    '/api/admin/team',
    requireAdmin,
    imageUpload.single('photo'),
    asyncHandler(async (req, res) => {
      const fullName = String(req.body.fullName || '').trim();
      const designation = String(req.body.designation || '').trim();
      const section = String(req.body.section || '').trim();
      const bio = String(req.body.bio || '').trim();
      const linkedinUrl = String(req.body.linkedinUrl || '').trim();
      const email = String(req.body.email || '').trim();
      const displayOrder = toPgInt(req.body.displayOrder, 10);
      const rawPhotoUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.photoUrl || '');

      if (!fullName || !designation || !section || !bio) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Name, designation, section, and biography are required.' });
        return;
      }
      if (!isSafeHttpOrLocalUrl(linkedinUrl) || !isSafeHttpOrLocalUrl(rawPhotoUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid URL provided.' });
        return;
      }
      const photoUrl = req.file ? await persistMediaUpload(req.file) : rawPhotoUrl;
      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO team_members (
          full_name, designation, section, bio, photo_url, linkedin_url, email, display_order, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [fullName, designation, section, bio, photoUrl, linkedinUrl, email, displayOrder, now]
      );
      res.status(201).json({ id: Number(inserted!.id) });
    })
  );

  app.put(
    '/api/admin/team/:id',
    requireAdmin,
    imageUpload.single('photo'),
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid team member ID.' });
        return;
      }
      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM team_members WHERE id = $1',
        [id]
      );
      if (!existing) {
        safeUnlink(req.file?.path);
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }
      const fullName = String(req.body.fullName ?? existing.full_name).trim();
      const designation = String(req.body.designation ?? existing.designation).trim();
      const section = String(req.body.section ?? existing.section).trim();
      const bio = String(req.body.bio ?? existing.bio).trim();
      const linkedinUrl = String(req.body.linkedinUrl ?? existing.linkedin_url).trim();
      const email = String(req.body.email ?? existing.email).trim();
      const displayOrder = toPgInt(req.body.displayOrder ?? existing.display_order, 0);
      const rawPhotoUrl = req.file
        ? `/uploads/media/${req.file.filename}`
        : String(req.body.photoUrl ?? existing.photo_url);
      if (!isSafeHttpOrLocalUrl(linkedinUrl) || !isSafeHttpOrLocalUrl(rawPhotoUrl)) {
        safeUnlink(req.file?.path);
        res.status(400).json({ error: 'Invalid URL provided.' });
        return;
      }
      const photoUrl = req.file ? await persistMediaUpload(req.file) : rawPhotoUrl;
      await pgExecute(
        `UPDATE team_members SET
          full_name = $1, designation = $2, section = $3, bio = $4, photo_url = $5,
          linkedin_url = $6, email = $7, display_order = $8
         WHERE id = $9`,
        [fullName, designation, section, bio, photoUrl, linkedinUrl, email, displayOrder, id]
      );
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/team/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid team member ID.' });
        return;
      }
      await pgExecute('DELETE FROM team_members WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  // ── Voices of RxOrbit ──────────────────────────────────────────────────────
  app.get(
    '/api/voices',
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        "SELECT * FROM voices WHERE status = 'approved' ORDER BY id DESC"
      );
      res.json({
        voices: rows.map((r) => {
          const allowPhoto = toPgBoolean(r.allow_photo);
          return {
            id: Number(r.id),
            userId: r.user_id ? Number(r.user_id) : null,
            authorName: String(r.author_name),
            institution: String(r.institution),
            courseDetails: String(r.course_details),
            experienceType: String(r.experience_type),
            quote: String(r.quote),
            story: String(r.story),
            photoUrl: allowPhoto ? String(r.photo_url) : '',
            allowPhoto,
            status: String(r.status),
            createdAt: toIsoTimestamp(r.created_at as Date | string),
          };
        }),
      });
    })
  );

  app.get(
    '/api/my/voices',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM voices WHERE user_id = $1 ORDER BY id DESC',
        [req.auth!.sub]
      );
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
          allowPhoto: toPgBoolean(r.allow_photo),
          status: String(r.status),
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.post(
    '/api/voices',
    requireAuth,
    imageUpload.single('photo'),
    asyncHandler(async (req, res) => {
      const user = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!user) {
        safeUnlink(req.file?.path);
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const experienceType = String(req.body.experienceType || 'Student Experience').trim();
      const quote = String(req.body.quote || '').trim();
      const story = String(req.body.story || '').trim();
      const allowPhoto = req.body.allowPhoto === 'true' || req.body.allowPhoto === true;
      const courseDetails = String(
        req.body.courseDetails || `${user.course} · ${user.semester_or_year}`
      ).trim();

      if (quote.length < 15 || story.length < 30) {
        safeUnlink(req.file?.path);
        res.status(400).json({
          error:
            'Please share a concise headline quote (15+ chars) and full experience (30+ chars).',
        });
        return;
      }

      if (!allowPhoto && req.file) {
        safeUnlink(req.file.path);
      }

      const photoUrl = allowPhoto && req.file ? await persistMediaUpload(req.file) : '';

      const now = new Date().toISOString();
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO voices (
          user_id, author_name, institution, course_details, experience_type,
          quote, story, photo_url, allow_photo, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
        RETURNING id`,
        [
          req.auth!.sub,
          String(user.full_name),
          String(user.institution),
          courseDetails,
          experienceType,
          quote,
          story,
          photoUrl,
          allowPhoto,
          now,
        ]
      );

      res.status(201).json({ id: Number(inserted!.id), status: 'pending' });
    })
  );

  app.get(
    '/api/admin/voices',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM voices ORDER BY id DESC'
      );
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
          allowPhoto: toPgBoolean(r.allow_photo),
          status: String(r.status),
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.patch(
    '/api/admin/voices/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid submission ID.' });
        return;
      }
      const status = String(req.body.status || '');
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        res.status(400).json({ error: 'Invalid review status.' });
        return;
      }
      await pgExecute('UPDATE voices SET status = $1 WHERE id = $2', [status, id]);
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/voices/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid submission ID.' });
        return;
      }
      await pgExecute('DELETE FROM voices WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  // ── Certificates & Verification ────────────────────────────────────────────
  app.get(
    '/api/certificates/verify/:code',
    asyncHandler(async (req, res) => {
      const code = normalizeCertificateCode(req.params.code);
      if (!code) {
        res.status(400).json({ error: 'Certificate ID is required.' });
        return;
      }
      const row = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM certificates WHERE UPPER(certificate_code) = $1',
        [code]
      );
      if (!row) {
        res.status(404).json({ error: 'No verified certificate found with that ID.' });
        return;
      }
      res.json({ certificate: mapCertificate(row) });
    })
  );

  app.get(
    '/api/certificates/:code/pdf',
    asyncHandler(async (req, res) => {
      const code = normalizeCertificateCode(req.params.code);
      const row = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM certificates WHERE UPPER(certificate_code) = $1',
        [code]
      );
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
    })
  );

  app.get(
    '/api/my/certificates',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await pgQueryOne<{ email: string }>(
        'SELECT email FROM users WHERE id = $1',
        [req.auth!.sub]
      );
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM certificates WHERE LOWER(participant_email) = LOWER($1) ORDER BY id DESC',
        [user.email]
      );
      res.json({ certificates: rows.map(mapCertificate) });
    })
  );

  app.get(
    '/api/admin/certificates',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM certificates ORDER BY id DESC'
      );
      res.json({ certificates: rows.map(mapCertificate) });
    })
  );

  app.post(
    '/api/admin/certificates',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const participantName = String(req.body.participantName || '').trim();
      const participantEmail = String(req.body.participantEmail || '').trim().toLowerCase();
      const eventId = req.body.eventId ? parsePositiveId(req.body.eventId) : null;
      if (req.body.eventId && !eventId) {
        res.status(400).json({ error: 'Invalid event ID.' });
        return;
      }
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
      while (
        await pgQueryOne<{ id: number }>(
          'SELECT id FROM certificates WHERE certificate_code = $1',
          [code]
        )
      ) {
        code = `RXO-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
      }
      const now = new Date().toISOString();
      const row = await pgQueryOne<Record<string, unknown>>(
        `INSERT INTO certificates (
          certificate_code, participant_name, participant_email, event_id, event_name,
          event_date, organization_name, template_title, template_subtitle,
          signatory_name, signatory_role, accent_color, issued_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
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
          now,
        ]
      );

      res.status(201).json({ certificate: mapCertificate(row!) });
    })
  );

  app.delete(
    '/api/admin/certificates/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid certificate ID.' });
        return;
      }
      await pgExecute('DELETE FROM certificates WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  // ── Admin Overview, Students, Announcements, Content ───────────────────────
  app.get(
    '/api/admin/overview',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const count = async (sql: string) => {
        const row = await pgQueryOne<{ cnt: number }>(sql);
        return toPgInt(row?.cnt);
      };
      const [
        students,
        materials,
        events,
        registrations,
        galleryPhotos,
        teamMembers,
        pendingVoices,
        certificates,
      ] = await Promise.all([
        count("SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'student'"),
        count('SELECT COUNT(*)::int AS cnt FROM study_materials'),
        count('SELECT COUNT(*)::int AS cnt FROM events'),
        count('SELECT COUNT(*)::int AS cnt FROM event_registrations'),
        count('SELECT COUNT(*)::int AS cnt FROM gallery_photos'),
        count('SELECT COUNT(*)::int AS cnt FROM team_members'),
        count("SELECT COUNT(*)::int AS cnt FROM voices WHERE status = 'pending'"),
        count('SELECT COUNT(*)::int AS cnt FROM certificates'),
      ]);
      res.json({
        stats: {
          students,
          materials,
          events,
          registrations,
          galleryPhotos,
          teamMembers,
          pendingVoices,
          certificates,
        },
      });
    })
  );

  app.get(
    '/api/admin/students',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM users ORDER BY id DESC'
      );
      res.json({ users: rows.map(mapUser) });
    })
  );

  app.patch(
    '/api/admin/students/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }
      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
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
        res
          .status(400)
          .json({ error: 'You cannot demote or suspend your own active admin account.' });
        return;
      }
      await pgExecute('UPDATE users SET role = $1, status = $2 WHERE id = $3', [role, status, id]);
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/students/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }
      if (id === req.auth!.sub) {
        res.status(400).json({ error: 'You cannot delete your own active admin account.' });
        return;
      }
      await pgExecute('DELETE FROM users WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/admin/announcements',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await pgQueryRows<Record<string, unknown>>(
        'SELECT * FROM announcements ORDER BY id DESC'
      );
      res.json({
        announcements: rows.map((r) => ({
          id: Number(r.id),
          title: String(r.title),
          message: String(r.message),
          category: String(r.category),
          linkPath: String(r.link_path),
          isActive: toPgBoolean(r.is_active),
          createdAt: toIsoTimestamp(r.created_at as Date | string),
        })),
      });
    })
  );

  app.post(
    '/api/admin/announcements',
    requireAdmin,
    asyncHandler(async (req, res) => {
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
      const inserted = await pgQueryOne<{ id: number }>(
        `INSERT INTO announcements (title, message, category, link_path, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [title, message, category, linkPath, isActive, now]
      );

      if (isActive) {
        await createNotification({
          category: 'announcement',
          title: `Admin Announcement: ${title}`,
          message,
          linkPath: linkPath || '/',
          targetProgram: 'All',
        });
      }

      res.status(201).json({ id: Number(inserted!.id) });
    })
  );

  app.patch(
    '/api/admin/announcements/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid announcement ID.' });
        return;
      }
      const existing = await pgQueryOne<Record<string, unknown>>(
        'SELECT * FROM announcements WHERE id = $1',
        [id]
      );
      if (!existing) {
        res.status(404).json({ error: 'Announcement not found.' });
        return;
      }
      const isActive =
        req.body.isActive !== undefined
          ? toPgBoolean(req.body.isActive)
          : toPgBoolean(existing.is_active);
      await pgExecute('UPDATE announcements SET is_active = $1 WHERE id = $2', [isActive, id]);
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/announcements/:id',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid announcement ID.' });
        return;
      }
      await pgExecute('DELETE FROM announcements WHERE id = $1', [id]);
      res.json({ ok: true });
    })
  );

  app.put(
    '/api/admin/content',
    requireAdmin,
    asyncHandler(async (req, res) => {
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
      await pgWithTransaction(async (client) => {
        for (const key of allowedKeys) {
          if (req.body[key] !== undefined) {
            await pgExecute(
              `INSERT INTO site_content (key, value, updated_at) VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
              [key, String(req.body[key]), now],
              client
            );
          }
        }
      });
      res.json({ content: await getSiteContentMap() });
    })
  );

  // Error handler for multer/upload/database/API errors
  app.use('/api', (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (req.file?.path) {
      safeUnlink(req.file.path);
    }
    const typedErr = err as { statusCode?: number; message?: string };
    const statusCode =
      typeof typedErr?.statusCode === 'number' &&
      typedErr.statusCode >= 400 &&
      typedErr.statusCode < 600
        ? typedErr.statusCode
        : err instanceof multer.MulterError
          ? 400
          : 500;

    const rawMessage = err instanceof Error && err.message ? err.message : 'Unexpected server error.';
    const safeMessage =
      rawMessage.includes('postgres://') || rawMessage.includes('postgresql://')
        ? 'Database operation failed.'
        : rawMessage;

    res.status(statusCode).json({ error: safeMessage });
  });

  // Vite dev middleware or production static assets
  if (!options.skipVite) {
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
  }

  return app;
}

async function startServer() {
  const app = await createRxOrbitApp();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`RxOrbit server running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePostgresPool();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  startServer().catch((err) => {
    console.error('Failed to start RxOrbit server:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
