import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'pg';
import { createRxOrbitApp } from '../server';
import { MATERIALS_DIR, MEDIA_DIR } from './paths';

/**
 * Lightweight in-memory SQL adapter mimicking node-postgres Pool behavior
 * so every parameterized SQL query, transaction, and HTTP route in server.ts
 * can be exercised end-to-end without touching data/rxorbit.sqlite.
 */
function translatePgSqlToSqlite(rawSql: string, rawParams: unknown[] = []) {
  let sql = rawSql.trim();
  const expandedParams: unknown[] = [];

  // Map $1, $2, ... placeholders sequentially and handle PostgreSQL casts/types
  sql = sql.replace(/\$(\d+)/g, (_match, numStr) => {
    const idx = Number(numStr) - 1;
    const val = rawParams[idx];
    if (typeof val === 'boolean') {
      expandedParams.push(val ? 1 : 0);
    } else {
      expandedParams.push(val ?? null);
    }
    return '?';
  });

  sql = sql
    .replace(/::int\b/gi, '')
    .replace(/::text\b/gi, '')
    .replace(/\bCAST\(\?\s+AS\s+TEXT\)/gi, 'CAST(? AS TEXT)')
    .replace(/\bINTEGER\s+GENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
    .replace(/\bBOOLEAN\b/gi, 'INTEGER')
    .replace(/\bDEFAULT\s+NOW\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP')
    .replace(/\bDEFAULT\s+FALSE\b/gi, 'DEFAULT 0')
    .replace(/\bDEFAULT\s+TRUE\b/gi, 'DEFAULT 1')
    .replace(/\bIS_ACTIVE\s*=\s*TRUE\b/gi, 'is_active = 1')
    .replace(/\bFOR\s+UPDATE\b/gi, '');

  return { sql, params: expandedParams };
}

function createInMemoryPgPool() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const execQuery = (text: string, values: unknown[] = []) => {
    const trimmed = text.trim().toUpperCase();
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      sqlite.exec(trimmed);
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('ALTER TABLE USERS ADD COLUMN IF NOT EXISTS')) {
      // Already included in CREATE TABLE users in POSTGRES_SCHEMA_STATEMENTS
      return { rows: [], rowCount: 0 };
    }

    const { sql, params } = translatePgSqlToSqlite(text, values);
    const hasReturning = /\bRETURNING\b/i.test(sql);
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

    if (isSelect || hasReturning) {
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...(params as Array<null | number | string | Uint8Array>));
      return { rows, rowCount: rows.length };
    }

    const stmt = sqlite.prepare(sql);
    const info = stmt.run(...(params as Array<null | number | string | Uint8Array>));
    return { rows: [], rowCount: Number(info.changes ?? 0) };
  };

  const client = {
    query: async (text: string, values?: unknown[]) => execQuery(text, values),
    release: () => undefined,
  };

  const pool = {
    query: async (text: string, values?: unknown[]) => execQuery(text, values),
    connect: async () => client,
    on: () => pool,
    end: async () => {
      sqlite.close();
    },
  };

  return pool as unknown as Pool;
}

test('Stage 5 End-to-End API Integration across Auth, Study Hub, Events, Gallery, Team, Voices, Certificates & Notifications', async () => {
  const prevPool = (globalThis as { __rxorbitPgPool?: Pool }).__rxorbitPgPool;
  const prevDbUrl = process.env.DATABASE_URL;
  const prevAdminPasscode = process.env.ADMIN_PASSCODE;

  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_PASSCODE;
  (globalThis as { __rxorbitPgPool?: Pool }).__rxorbitPgPool = undefined;

  const createdUploadFiles: string[] = [];
  const beforeMaterials = new Set(fs.readdirSync(MATERIALS_DIR));
  const beforeMedia = new Set(fs.readdirSync(MEDIA_DIR));

  // 1. Verify unconfigured-database graceful 503 behavior first
  const unconfiguredApp = await createRxOrbitApp({ skipVite: true });
  const unconfiguredServer = http.createServer(unconfiguredApp);
  await new Promise<void>((resolve) => unconfiguredServer.listen(0, '127.0.0.1', () => resolve()));
  const unconfiguredAddr = unconfiguredServer.address() as { port: number };
  const unconfiguredUrl = `http://127.0.0.1:${unconfiguredAddr.port}`;

  try {
    const healthRes = await fetch(`${unconfiguredUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { ok: boolean; databaseConfigured: boolean };
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.databaseConfigured, false);

    const guardRes = await fetch(`${unconfiguredUrl}/api/content`);
    assert.equal(guardRes.status, 503);
  } finally {
    await new Promise<void>((resolve) => unconfiguredServer.close(() => resolve()));
  }

  // 2. Inject in-memory PostgreSQL pool and test complete application workflow
  const memPool = createInMemoryPgPool();
  (globalThis as { __rxorbitPgPool?: Pool }).__rxorbitPgPool = memPool;

  const app = await createRxOrbitApp({ skipVite: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Health check with DB
    const healthOk = await fetch(`${baseUrl}/api/health?checkDb=1`);
    assert.equal(healthOk.status, 200);
    const healthOkJson = (await healthOk.json()) as { ok: boolean; databaseConfigured: boolean };
    assert.equal(healthOkJson.ok, true);
    assert.equal(healthOkJson.databaseConfigured, true);

    // Admin bootstrap & duplicate protection
    const adminStatus1 = await fetch(`${baseUrl}/api/auth/admin-status`).then((r) => r.json());
    assert.equal((adminStatus1 as { hasClaimedAdmin: boolean }).hasClaimedAdmin, false);

    const adminRes = await fetch(`${baseUrl}/api/auth/admin-bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Test Admin',
        email: 'admin@test.edu',
        password: 'AdminPassword#123',
        institution: 'Test Pharmacy Institute',
      }),
    });
    assert.equal(adminRes.status, 201);
    const adminBody = (await adminRes.json()) as { token: string; user: { id: number; role: string } };
    assert.equal(adminBody.user.role, 'admin');
    const adminToken = adminBody.token;

    const secondAdminRes = await fetch(`${baseUrl}/api/auth/admin-bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Second Admin',
        email: 'admin2@test.edu',
        password: 'AdminPassword#123',
      }),
    });
    assert.equal(secondAdminRes.status, 403);

    // Student registration, login, profile update, RBAC check
    const studentRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Student One',
        email: 'student1@test.edu',
        password: 'StudentPassword#123',
        institution: 'Pharmacy College',
        course: 'B.Pharm',
        semesterOrYear: 'Semester 5',
      }),
    });
    assert.equal(studentRegRes.status, 201);
    const studentBody = (await studentRegRes.json()) as { token: string; user: { id: number; role: string } };
    const studentToken = studentBody.token;
    assert.equal(studentBody.user.role, 'student');

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@test.edu',
        password: 'StudentPassword#123',
      }),
    });
    assert.equal(loginRes.status, 200);

    const profilePatchRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        fullName: 'Student One Updated',
        institution: 'Pharmacy College',
        course: 'B.Pharm',
        semesterOrYear: 'Semester 6',
        bio: 'Focused on Pharmacology',
        preferredProgram: 'B.Pharm',
        preferredSubjects: ['Pharmacology'],
      }),
    });
    assert.equal(profilePatchRes.status, 200);
    const patchedUser = (await profilePatchRes.json()) as { user: { preferredProgram: string; preferredSubjects: string[] } };
    assert.equal(patchedUser.user.preferredProgram, 'B.Pharm');
    assert.deepEqual(patchedUser.user.preferredSubjects, ['Pharmacology']);

    // Avatar upload & retrieval
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex'
    );
    const avatarForm = new FormData();
    avatarForm.append('avatar', new Blob([pngBytes], { type: 'image/png' }), 'avatar.png');
    const avatarRes = await fetch(`${baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: avatarForm,
    });
    assert.equal(avatarRes.status, 200);
    const avatarJson = (await avatarRes.json()) as { avatarUrl: string };
    assert.match(avatarJson.avatarUrl, /^\/uploads\/media\/.+avatar\.png$/);
    const mediaFetch = await fetch(`${baseUrl}${avatarJson.avatarUrl}`);
    assert.equal(mediaFetch.status, 200);

    // RBAC check: student blocked from admin routes
    const forbiddenRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbiddenRes.status, 403);

    // Site content & Announcements
    const contentPut = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ heroTagline: 'Connect · Discover · Advance' }),
    });
    assert.equal(contentPut.status, 200);

    const annPost = await fetch(`${baseUrl}/api/admin/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Exam Schedule Update',
        message: 'Semester 6 materials updated.',
        category: 'Academic',
        linkPath: '/study-hub',
        isActive: true,
      }),
    });
    assert.equal(annPost.status, 201);
    const publicContent = (await fetch(`${baseUrl}/api/content`).then((r) => r.json())) as {
      content: { heroTagline: string };
      announcements: Array<{ id: number; isActive: boolean }>;
    };
    assert.equal(publicContent.content.heroTagline, 'Connect · Discover · Advance');
    assert.equal(publicContent.announcements.length, 1);
    assert.equal(publicContent.announcements[0].isActive, true);

    // Curriculum & Study Materials upload/search/download
    const unitRes = await fetch(`${baseUrl}/api/admin/curriculum/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ program: 'B.Pharm', name: 'Semester 6' }),
    });
    assert.equal(unitRes.status, 201);

    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
    const matForm = new FormData();
    matForm.append('title', 'Pharmacology III Notes');
    matForm.append('program', 'B.Pharm');
    matForm.append('semesterOrSpec', 'Semester 6');
    matForm.append('subject', 'Pharmacology III');
    matForm.append('materialType', 'Notes');
    matForm.append('description', 'Unit 1 academic notes.');
    matForm.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'pharmacology.pdf');

    const matUpload = await fetch(`${baseUrl}/api/admin/materials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: matForm,
    });
    assert.equal(matUpload.status, 201);
    const matJson = (await matUpload.json()) as { id: number };

    const matSearch = (await fetch(`${baseUrl}/api/materials?q=Pharmacology&program=B.Pharm`).then((r) =>
      r.json()
    )) as { materials: Array<{ id: number; downloads: number }> };
    assert.equal(matSearch.materials.length, 1);
    assert.equal(matSearch.materials[0].downloads, 0);

    const matDownload = await fetch(`${baseUrl}/api/materials/${matJson.id}/download`);
    assert.equal(matDownload.status, 200);
    assert.equal(matDownload.headers.get('content-type'), 'application/pdf');

    const matAfterDownload = (await fetch(`${baseUrl}/api/materials`).then((r) => r.json())) as {
      materials: Array<{ downloads: number }>;
    };
    assert.equal(matAfterDownload.materials[0].downloads, 1);

    // Invalid ID check returns 400 cleanly
    const badIdRes = await fetch(`${baseUrl}/api/materials/abc/file`);
    assert.equal(badIdRes.status, 400);

    // Events & Registrations
    const eventPost = await fetch(`${baseUrl}/api/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Pharmacovigilance Seminar',
        description: 'Clinical safety review session.',
        eventType: 'Seminar',
        status: 'upcoming',
        eventDate: '2026-12-10',
        eventTime: '10:00 AM',
        venueOrMode: 'Online',
        maxSeats: 100,
      }),
    });
    assert.equal(eventPost.status, 201);
    const eventJson = (await eventPost.json()) as { id: number };

    const regRes = await fetch(`${baseUrl}/api/events/${eventJson.id}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        fullName: 'Student One Updated',
        email: 'student1@test.edu',
        institution: 'Pharmacy College',
        course: 'B.Pharm',
        semesterOrYear: 'Semester 6',
      }),
    });
    assert.equal(regRes.status, 201);

    const myRegs = (await fetch(`${baseUrl}/api/my/registrations`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }).then((r) => r.json())) as { registrations: Array<{ eventId: number }> };
    assert.equal(myRegs.registrations.length, 1);

    // Gallery, Team, Voices
    const albumRes = await fetch(`${baseUrl}/api/admin/gallery/albums`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Annual Symposium',
        category: 'Symposium',
        eventDate: '2026-11-01',
        description: 'Highlights',
      }),
    });
    assert.equal(albumRes.status, 201);
    const albumJson = (await albumRes.json()) as { id: number };

    const photoForm = new FormData();
    photoForm.append('albumId', String(albumJson.id));
    photoForm.append('caption', 'Opening Keynote');
    photoForm.append('eventDate', '2026-11-01');
    photoForm.append('category', 'Symposium');
    photoForm.append('image', new Blob([pngBytes], { type: 'image/png' }), 'gallery.png');
    const photoRes = await fetch(`${baseUrl}/api/admin/gallery/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: photoForm,
    });
    assert.equal(photoRes.status, 201);

    const voiceRes = await fetch(`${baseUrl}/api/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        experienceType: 'Community Learning',
        quote: 'Organized pharmacy resources helped me prepare efficiently.',
        story: 'Accessing structured semester-wise notes and joining peer seminars made preparation much clearer.',
        allowPhoto: false,
      }),
    });
    assert.equal(voiceRes.status, 201);
    const voiceJson = (await voiceRes.json()) as { id: number };

    await fetch(`${baseUrl}/api/admin/voices/${voiceJson.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    const publicVoices = (await fetch(`${baseUrl}/api/voices`).then((r) => r.json())) as {
      voices: Array<{ id: number; allowPhoto: boolean }>;
    };
    assert.equal(publicVoices.voices.length, 1);
    assert.equal(publicVoices.voices[0].allowPhoto, false);

    // Certificates & PDF export
    const certRes = await fetch(`${baseUrl}/api/admin/certificates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        participantName: 'Student One Updated',
        participantEmail: 'student1@test.edu',
        eventId: eventJson.id,
        eventName: 'Pharmacovigilance Seminar',
        eventDate: '2026-12-10',
      }),
    });
    assert.equal(certRes.status, 201);
    const certJson = (await certRes.json()) as { certificate: { certificateCode: string } };

    const certPdfRes = await fetch(`${baseUrl}/api/certificates/${certJson.certificate.certificateCode}/pdf`);
    assert.equal(certPdfRes.status, 200);
    const certPdfBuf = Buffer.from(await certPdfRes.arrayBuffer());
    assert.equal(certPdfBuf.subarray(0, 5).toString('utf8'), '%PDF-');

    // Notifications & read-all
    const notifRes = (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }).then((r) => r.json())) as { notifications: Array<{ id: number }>; unreadCount: number };
    assert.ok(notifRes.unreadCount >= 2);

    const readAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(readAllRes.status, 200);

    const notifAfter = (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }).then((r) => r.json())) as { unreadCount: number };
    assert.equal(notifAfter.unreadCount, 0);

    // Admin overview counts match real inserted records
    const overview = (await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json())) as {
      stats: {
        students: number;
        materials: number;
        events: number;
        registrations: number;
        galleryPhotos: number;
        certificates: number;
      };
    };
    assert.equal(overview.stats.students, 1);
    assert.equal(overview.stats.materials, 1);
    assert.equal(overview.stats.events, 1);
    assert.equal(overview.stats.registrations, 1);
    assert.equal(overview.stats.galleryPhotos, 1);
    assert.equal(overview.stats.certificates, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await memPool.end();

    for (const file of fs.readdirSync(MATERIALS_DIR)) {
      if (!beforeMaterials.has(file)) {
        createdUploadFiles.push(path.join(MATERIALS_DIR, file));
      }
    }
    for (const file of fs.readdirSync(MEDIA_DIR)) {
      if (!beforeMedia.has(file)) {
        createdUploadFiles.push(path.join(MEDIA_DIR, file));
      }
    }
    for (const filePath of createdUploadFiles) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    (globalThis as { __rxorbitPgPool?: Pool }).__rxorbitPgPool = prevPool;
    if (prevDbUrl !== undefined) process.env.DATABASE_URL = prevDbUrl;
    else delete process.env.DATABASE_URL;
    if (prevAdminPasscode !== undefined) process.env.ADMIN_PASSCODE = prevAdminPasscode;
    else delete process.env.ADMIN_PASSCODE;
  }
});
