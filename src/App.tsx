import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { apiRequest } from './lib/api';
import { parseAppLocation, type RoutePath } from './lib/domain';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { BPharmPage } from './pages/BPharmPage';
import { EventsPage } from './pages/EventsPage';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { MPharmPage } from './pages/MPharmPage';
import { ProfilePage } from './pages/ProfilePage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { StudyHubPage } from './pages/StudyHubPage';
import { TeamPage } from './pages/TeamPage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';
import { VoicesPage } from './pages/VoicesPage';
import type {
  Announcement,
  CurriculumUnit,
  GalleryAlbum,
  GalleryPhoto,
  ProgramType,
  RxEvent,
  SiteContent,
  StudyMaterial,
  TeamMember,
  VoiceEntry,
} from './types';

const DEFAULT_CONTENT: SiteContent = {
  heroTitle: 'RxOrbit',
  heroSubtitle:
    'A pharmacy student educational community connecting B.Pharm and M.Pharm students, educators, and student coordinators.',
  heroTagline: 'Connect · Discover · Advance',
  aboutSummary: '',
  vision: '',
  mission: '',
  objectives: '',
  whyRxOrbit: '',
  commitment: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  linkedinUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
};

function normalizeSiteContent(raw: unknown): SiteContent {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_CONTENT;
  }
  const src = raw as Partial<Record<keyof SiteContent, unknown>>;
  const pickString = (key: keyof SiteContent): string =>
    typeof src[key] === 'string' ? src[key] : DEFAULT_CONTENT[key];

  return {
    heroTitle: pickString('heroTitle'),
    heroSubtitle: pickString('heroSubtitle'),
    heroTagline: pickString('heroTagline'),
    aboutSummary: pickString('aboutSummary'),
    vision: pickString('vision'),
    mission: pickString('mission'),
    objectives: pickString('objectives'),
    whyRxOrbit: pickString('whyRxOrbit'),
    commitment: pickString('commitment'),
    contactEmail: pickString('contactEmail'),
    contactPhone: pickString('contactPhone'),
    contactAddress: pickString('contactAddress'),
    linkedinUrl: pickString('linkedinUrl'),
    instagramUrl: pickString('instagramUrl'),
    youtubeUrl: pickString('youtubeUrl'),
  };
}

function readLocationState(): { path: RoutePath; search: string } {
  return parseAppLocation(
    window.location.pathname || '/',
    window.location.search || '',
    window.location.hash || ''
  );
}

function AppShell() {
  const initialLoc = readLocationState();
  const [currentPath, setCurrentPath] = useState<RoutePath>(initialLoc.path);
  const [currentSearch, setCurrentSearch] = useState<string>(initialLoc.search);

  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [curriculumUnits, setCurriculumUnits] = useState<CurriculumUnit[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [events, setEvents] = useState<RxEvent[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPublicData = useCallback(async () => {
    try {
      const [contentRes, currRes, matRes, evRes, galRes, teamRes, voiceRes] =
        await Promise.allSettled([
          apiRequest<{ content?: SiteContent; announcements?: Announcement[] }>('/api/content'),
          apiRequest<{ units?: CurriculumUnit[] }>('/api/curriculum'),
          apiRequest<{ materials?: StudyMaterial[] }>('/api/materials'),
          apiRequest<{ events?: RxEvent[] }>('/api/events'),
          apiRequest<{ albums?: GalleryAlbum[]; photos?: GalleryPhoto[] }>('/api/gallery'),
          apiRequest<{ members?: TeamMember[] }>('/api/team'),
          apiRequest<{ voices?: VoiceEntry[] }>('/api/voices'),
        ]);

      if (contentRes.status === 'fulfilled' && contentRes.value) {
        setSiteContent(normalizeSiteContent(contentRes.value.content));
        if (Array.isArray(contentRes.value.announcements)) {
          setAnnouncements(contentRes.value.announcements);
        }
      }
      if (currRes.status === 'fulfilled' && Array.isArray(currRes.value?.units)) {
        setCurriculumUnits(currRes.value.units);
      }
      if (matRes.status === 'fulfilled' && Array.isArray(matRes.value?.materials)) {
        setMaterials(matRes.value.materials);
      }
      if (evRes.status === 'fulfilled' && Array.isArray(evRes.value?.events)) {
        setEvents(evRes.value.events);
      }
      if (galRes.status === 'fulfilled' && galRes.value) {
        if (Array.isArray(galRes.value.albums)) {
          setAlbums(galRes.value.albums);
        }
        if (Array.isArray(galRes.value.photos)) {
          setPhotos(galRes.value.photos);
        }
      }
      if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value?.members)) {
        setTeam(teamRes.value.members);
      }
      if (voiceRes.status === 'fulfilled' && Array.isArray(voiceRes.value?.voices)) {
        setVoices(voiceRes.value.voices);
      }
    } catch {
      // keep fallback state on transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    const onHashOrPop = () => {
      const next = readLocationState();
      setCurrentPath(next.path);
      setCurrentSearch(next.search);
    };
    window.addEventListener('hashchange', onHashOrPop);
    window.addEventListener('popstate', onHashOrPop);
    return () => {
      window.removeEventListener('hashchange', onHashOrPop);
      window.removeEventListener('popstate', onHashOrPop);
    };
  }, []);

  const navigate = useCallback((next: RoutePath, search = '') => {
    const normalizedSearch = search
      ? search.startsWith('?')
        ? search
        : `?${search}`
      : '';
    setCurrentPath(next);
    setCurrentSearch(normalizedSearch);
    const nextUrl = next === '/' && !normalizedSearch ? '/' : `${next}${normalizedSearch}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl || window.location.hash) {
      window.history.pushState({}, '', nextUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openStudyProgram = useCallback(
    (program: ProgramType) => {
      navigate(program === 'B.Pharm' ? '/study-hub/bpharm' : '/study-hub/mpharm');
    },
    [navigate]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F2442]">
      <Navbar currentPath={currentPath} onNavigate={navigate} />

      <main className="flex-1">
        {currentPath === '/' && (
          <HomePage
            content={siteContent}
            announcements={announcements}
            events={events}
            photos={photos}
            team={team}
            voices={voices}
            onNavigate={navigate}
            onOpenStudyProgram={openStudyProgram}
          />
        )}
        {currentPath === '/study-hub' && (
          <StudyHubPage
            materials={materials}
            curriculumUnits={curriculumUnits}
            loading={loading}
            initialSearch={currentSearch}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/study-hub/bpharm' && (
          <BPharmPage
            materials={materials}
            curriculumUnits={curriculumUnits}
            loading={loading}
            initialSearch={currentSearch}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/study-hub/mpharm' && (
          <MPharmPage
            materials={materials}
            curriculumUnits={curriculumUnits}
            loading={loading}
            initialSearch={currentSearch}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/events' && (
          <EventsPage
            events={events}
            loading={loading}
            onRefresh={loadPublicData}
          />
        )}
        {currentPath === '/gallery' && (
          <GalleryPage albums={albums} photos={photos} loading={loading} />
        )}
        {currentPath === '/team' && <TeamPage members={team} loading={loading} />}
        {currentPath === '/voices' && (
          <VoicesPage voices={voices} loading={loading} onNavigate={navigate} />
        )}
        {currentPath === '/about' && (
          <AboutPage content={siteContent} onNavigate={navigate} />
        )}
        {currentPath === '/login' && (
          <AuthPage initialMode="login" onNavigate={navigate} />
        )}
        {currentPath === '/register' && (
          <AuthPage initialMode="register" onNavigate={navigate} />
        )}
        {currentPath === '/dashboard' && <StudentDashboardPage onNavigate={navigate} />}
        {currentPath === '/profile' && (
          <ProfilePage curriculumUnits={curriculumUnits} onNavigate={navigate} />
        )}
        {currentPath === '/admin' && (
          <AdminDashboardPage
            siteContent={siteContent}
            curriculumUnits={curriculumUnits}
            onRefreshPublic={loadPublicData}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/verify' && <VerifyCertificatePage />}
      </main>

      <Footer content={siteContent} onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
