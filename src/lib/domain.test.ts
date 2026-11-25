import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterEvents,
  filterStudyMaterials,
  formatFileSize,
  normalizeCertificateCode,
  parseAppLocation,
  parseLinkPath,
  parseRoutePath,
  validateStudentRegistration,
} from './domain';
import type { RxEvent, StudyMaterial } from '../types';

const sampleMaterials: StudyMaterial[] = [
  {
    id: 1,
    title: 'Pharmacology Unit Notes',
    program: 'B.Pharm',
    semesterOrSpec: 'Semester 4',
    subject: 'Pharmacology I',
    materialType: 'Study Notes',
    description: 'Unit overview and topic summary.',
    fileName: 'pharmacology-unit.pdf',
    fileUrl: '/api/materials/1/file',
    fileSize: 204800,
    uploadedBy: 'Admin',
    downloads: 12,
    createdAt: '2026-10-01',
  },
  {
    id: 2,
    title: 'Liposomal Drug Carriers',
    program: 'M.Pharm',
    semesterOrSpec: 'Pharmaceutics',
    subject: 'Drug Delivery Systems',
    materialType: 'Reference Material',
    description: 'Formulation design reference.',
    fileName: 'liposomes.pdf',
    fileUrl: '/api/materials/2/file',
    fileSize: 1572864,
    uploadedBy: 'Coordinator',
    downloads: 5,
    createdAt: '2026-10-05',
  },
];

test('filterStudyMaterials filters by program, semester, and search query', () => {
  const bpharmOnly = filterStudyMaterials(sampleMaterials, {
    program: 'B.Pharm',
    semesterOrSpec: 'All',
    subject: 'All',
    materialType: 'All',
    query: '',
  });
  assert.equal(bpharmOnly.length, 1);
  assert.equal(bpharmOnly[0].id, 1);

  const queryMatch = filterStudyMaterials(sampleMaterials, {
    program: 'All',
    semesterOrSpec: 'All',
    subject: 'All',
    materialType: 'All',
    query: 'liposomal',
  });
  assert.equal(queryMatch.length, 1);
  assert.equal(queryMatch[0].id, 2);

  const aliasMatch = filterStudyMaterials(sampleMaterials, {
    program: 'All',
    semesterOrSpec: 'All',
    subject: 'All',
    materialType: 'All',
    query: 'pharmacology notes',
  });
  assert.equal(aliasMatch.length, 1);
  assert.equal(aliasMatch[0].id, 1);
});

test('filterEvents excludes drafts and filters by status and type', () => {
  const events: RxEvent[] = [
    {
      id: 1,
      title: 'Sample Workshop A',
      description: 'Workshop session description',
      eventType: 'Workshop',
      status: 'upcoming',
      eventDate: '2026-12-12',
      eventTime: '10:00 AM',
      venueOrMode: 'Online',
      posterUrl: '',
      maxSeats: 100,
      createdAt: '2026-11-01',
    },
    {
      id: 2,
      title: 'Draft Event B',
      description: 'Draft entry',
      eventType: 'Conference',
      status: 'draft',
      eventDate: '2026-12-20',
      eventTime: '09:00 AM',
      venueOrMode: 'Hall',
      posterUrl: '',
      maxSeats: 200,
      createdAt: '2026-11-02',
    },
  ];
  const filtered = filterEvents(events, { status: 'all', eventType: 'All', query: '' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
});

test('validateStudentRegistration enforces email, password strength, and institution', () => {
  assert.ok(
    validateStudentRegistration({
      fullName: 'Student One',
      email: 'bad-email',
      password: 'Password1',
      institution: 'Pharmacy College A',
      course: 'B.Pharm',
      semesterOrYear: 'Semester 5',
    })
  );
  assert.ok(
    validateStudentRegistration({
      fullName: 'Student One',
      email: 'student1@example.edu',
      password: 'weak',
      institution: 'Pharmacy College A',
      course: 'B.Pharm',
      semesterOrYear: 'Semester 5',
    })
  );
  assert.equal(
    validateStudentRegistration({
      fullName: 'Student One',
      email: 'student1@example.edu',
      password: 'Password12',
      institution: 'Pharmacy College A',
      course: 'B.Pharm',
      semesterOrYear: 'Semester 5',
    }),
    null
  );
});

test('formatFileSize and normalizeCertificateCode format cleanly', () => {
  assert.equal(formatFileSize(204800), '200 KB');
  assert.equal(formatFileSize(1572864), '1.5 MB');
  assert.equal(normalizeCertificateCode(' cert-0001! '), 'CERT-0001');
});

test('route parsing supports all RxOrbit pages, clean paths, and hash fallback', () => {
  assert.equal(parseRoutePath('/'), '/');
  assert.equal(parseRoutePath('/study-hub/'), '/study-hub');
  assert.equal(parseRoutePath('/study-hub/bpharm'), '/study-hub/bpharm');
  assert.equal(parseRoutePath('/study-hub/mpharm'), '/study-hub/mpharm');
  assert.equal(parseRoutePath('/events'), '/events');
  assert.equal(parseRoutePath('/gallery'), '/gallery');
  assert.equal(parseRoutePath('/team'), '/team');
  assert.equal(parseRoutePath('/voices'), '/voices');
  assert.equal(parseRoutePath('/about'), '/about');
  assert.equal(parseRoutePath('/login'), '/login');
  assert.equal(parseRoutePath('/register'), '/register');
  assert.equal(parseRoutePath('/auth'), '/login');
  assert.equal(parseRoutePath('/unknown-path'), '/');

  assert.deepEqual(parseAppLocation('/study-hub/bpharm', '?semester=Semester%202', ''), {
    path: '/study-hub/bpharm',
    search: '?semester=Semester%202',
  });
  assert.deepEqual(parseAppLocation('/', '', '#/events?status=upcoming'), {
    path: '/events',
    search: '?status=upcoming',
  });
  assert.deepEqual(parseLinkPath('/study-hub?material=5'), {
    path: '/study-hub',
    search: '?material=5',
  });
});
