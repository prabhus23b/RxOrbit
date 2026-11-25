import type {
  EventStatus,
  EventType,
  MaterialType,
  ProgramType,
  RxEvent,
  StudyMaterial,
} from '../types';

export type RoutePath =
  | '/'
  | '/study-hub'
  | '/study-hub/bpharm'
  | '/study-hub/mpharm'
  | '/events'
  | '/gallery'
  | '/team'
  | '/voices'
  | '/about'
  | '/login'
  | '/register'
  | '/dashboard'
  | '/profile'
  | '/admin'
  | '/verify';

export const VALID_ROUTE_PATHS: readonly RoutePath[] = [
  '/',
  '/study-hub',
  '/study-hub/bpharm',
  '/study-hub/mpharm',
  '/events',
  '/gallery',
  '/team',
  '/voices',
  '/about',
  '/login',
  '/register',
  '/dashboard',
  '/profile',
  '/admin',
  '/verify',
] as const;

const VALID_ROUTE_SET = new Set<string>(VALID_ROUTE_PATHS);

export function parseRoutePath(rawPathname: string): RoutePath {
  const cleaned = rawPathname.trim().replace(/\/+$/, '') || '/';
  if (cleaned === '/auth') {
    return '/login';
  }
  if (VALID_ROUTE_SET.has(cleaned)) {
    return cleaned as RoutePath;
  }
  return '/';
}

export function parseAppLocation(
  pathname: string,
  search = '',
  hash = ''
): { path: RoutePath; search: string } {
  const trimmedHash = hash.replace(/^#/, '');
  if (trimmedHash.startsWith('/')) {
    const [hashPath, hashSearch] = trimmedHash.split('?');
    return {
      path: parseRoutePath(hashPath),
      search: hashSearch ? `?${hashSearch}` : '',
    };
  }
  return {
    path: parseRoutePath(pathname),
    search: search ? (search.startsWith('?') ? search : `?${search}`) : '',
  };
}

export function parseLinkPath(raw: string): { path: RoutePath; search: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { path: '/', search: '' };
  const [rawPath, rawSearch] = trimmed.split('?');
  return {
    path: parseRoutePath(rawPath),
    search: rawSearch ? `?${rawSearch}` : '',
  };
}

export const BPHARM_SEMESTERS: readonly string[] = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
];

export const MATERIAL_TYPES: MaterialType[] = [
  'Study Notes',
  'PDF Material',
  'Question Paper',
  'Important Questions',
  'Reference Material',
];

export const EVENT_TYPES: EventType[] = [
  'Webinar',
  'Workshop',
  'Seminar',
  'Conference',
  'Competition',
  'Guest Lecture',
];

export const GALLERY_CATEGORIES = [
  'Webinar Photographs',
  'Workshop Photographs',
  'Seminar Photographs',
  'Conference Memories',
  'Student Activities',
  'Competition Highlights',
  'Community Achievements',
] as const;

export const TEAM_SECTIONS = [
  'Founder',
  'Leadership Team',
  'Core Team',
  'Student Coordinators',
] as const;

export interface MaterialFilterOptions {
  program: ProgramType | 'All';
  semesterOrSpec: string;
  subject: string;
  materialType: MaterialType | 'All';
  query: string;
}

const MATERIAL_QUERY_ALIASES: Record<string, string[]> = {
  notes: ['study notes', 'notes'],
  note: ['study notes', 'notes'],
  papers: ['question paper', 'papers', 'exam'],
  paper: ['question paper', 'paper', 'exam'],
  qp: ['question paper'],
  important: ['important questions'],
  questions: ['important questions', 'question paper'],
  reference: ['reference material'],
  pdf: ['pdf material'],
};

export function filterStudyMaterials(
  materials: StudyMaterial[],
  filters: MaterialFilterOptions
): StudyMaterial[] {
  const rawQuery = filters.query.trim().toLowerCase();
  const tokens = rawQuery
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const scored: Array<{ item: StudyMaterial; score: number }> = [];

  for (const item of materials) {
    if (filters.program !== 'All' && item.program !== filters.program) {
      continue;
    }
    if (
      filters.semesterOrSpec !== 'All' &&
      filters.semesterOrSpec &&
      item.semesterOrSpec !== filters.semesterOrSpec
    ) {
      continue;
    }
    if (filters.subject !== 'All' && filters.subject && item.subject !== filters.subject) {
      continue;
    }
    if (filters.materialType !== 'All' && item.materialType !== filters.materialType) {
      continue;
    }

    if (tokens.length === 0) {
      scored.push({ item, score: 1 });
      continue;
    }

    const titleLower = item.title.toLowerCase();
    const subjectLower = item.subject.toLowerCase();
    const typeLower = item.materialType.toLowerCase();
    const haystack = [
      titleLower,
      subjectLower,
      item.semesterOrSpec.toLowerCase(),
      item.description.toLowerCase(),
      typeLower,
      item.program.toLowerCase(),
      item.fileName.toLowerCase(),
      item.uploadedBy.toLowerCase(),
    ].join(' ');

    let matchedAll = true;
    let score = 0;

    for (const token of tokens) {
      const aliases = MATERIAL_QUERY_ALIASES[token] || [];
      const tokenMatches =
        haystack.includes(token) || aliases.some((alias) => haystack.includes(alias));
      if (!tokenMatches) {
        matchedAll = false;
        break;
      }
      if (titleLower.includes(token)) score += 5;
      if (subjectLower.includes(token)) score += 4;
      if (typeLower.includes(token) || aliases.some((a) => typeLower.includes(a))) score += 3;
      score += 1;
    }

    if (matchedAll) {
      scored.push({ item, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || b.item.id - a.item.id)
    .map((entry) => entry.item);
}

export interface EventFilterOptions {
  status: EventStatus | 'all';
  eventType: EventType | 'All';
  query: string;
}

export function filterEvents(events: RxEvent[], filters: EventFilterOptions): RxEvent[] {
  const q = filters.query.trim().toLowerCase();
  return events.filter((ev) => {
    if (ev.status === 'draft') {
      return false;
    }
    if (filters.status !== 'all' && ev.status !== filters.status) {
      return false;
    }
    if (filters.eventType !== 'All' && ev.eventType !== filters.eventType) {
      return false;
    }
    if (q) {
      const haystack = [ev.title, ev.description, ev.eventType, ev.venueOrMode]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function validateStudentRegistration(input: {
  fullName: string;
  email: string;
  password: string;
  institution: string;
  course: string;
  semesterOrYear: string;
}): string | null {
  if (!input.fullName || input.fullName.trim().length < 2) {
    return 'Please enter your full name (at least 2 characters).';
  }
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  if (!input.password || input.password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password)) {
    return 'Password must include at least one letter and one number.';
  }
  if (!input.institution || input.institution.trim().length < 2) {
    return 'Please enter your pharmacy institution or college name.';
  }
  if (!['B.Pharm', 'M.Pharm', 'Educator', 'Coordinator'].includes(input.course)) {
    return 'Please select your course or academic role.';
  }
  if (!input.semesterOrYear || input.semesterOrYear.trim().length < 1) {
    return 'Please specify your semester or academic year.';
  }
  return null;
}

export function normalizeCertificateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
