import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  MessageSquareQuote,
  Settings,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  BPHARM_SEMESTERS,
  EVENT_TYPES,
  formatFileSize,
  GALLERY_CATEGORIES,
  MATERIAL_TYPES,
  TEAM_SECTIONS,
  type RoutePath,
} from '../lib/domain';
import type {
  Announcement,
  Certificate,
  CurriculumUnit,
  EventRegistration,
  GalleryAlbum,
  GalleryPhoto,
  ProgramType,
  RxEvent,
  SiteContent,
  StudyMaterial,
  TeamMember,
  User,
  VoiceEntry,
} from '../types';

type AdminTab =
  | 'overview'
  | 'students'
  | 'materials'
  | 'events'
  | 'registrations'
  | 'gallery'
  | 'team'
  | 'voices'
  | 'certificates'
  | 'announcements'
  | 'content';

interface AdminDashboardPageProps {
  siteContent: SiteContent;
  curriculumUnits?: CurriculumUnit[];
  onRefreshPublic: () => Promise<void>;
  onNavigate: (path: RoutePath) => void;
}

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
  { id: 'students', label: '2. Students', icon: Users },
  { id: 'materials', label: '3. Study Materials', icon: BookOpen },
  { id: 'events', label: '4. Events', icon: Calendar },
  { id: 'registrations', label: '5. Registrations', icon: UserCheck },
  { id: 'gallery', label: '6. Gallery', icon: ImageIcon },
  { id: 'team', label: '7. Team', icon: Users },
  { id: 'voices', label: '8. Voices of RxOrbit', icon: MessageSquareQuote },
  { id: 'certificates', label: '9. Certificates', icon: Award },
  { id: 'announcements', label: '10. Announcements', icon: Megaphone },
  { id: 'content', label: '11. Website Content', icon: Settings },
];

export function AdminDashboardPage({
  siteContent,
  curriculumUnits = [],
  onRefreshPublic,
  onNavigate,
}: AdminDashboardPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Data stores
  const [stats, setStats] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<User[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumUnit[]>(curriculumUnits);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [events, setEvents] = useState<RxEvent[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [contentForm, setContentForm] = useState<SiteContent>(siteContent);

  // Curriculum management form
  const [currProgram, setCurrProgram] = useState<ProgramType>('B.Pharm');
  const [currUnitName, setCurrUnitName] = useState<string>('Semester 1');
  const [newSpecName, setNewSpecName] = useState<string>('');
  const [newSubjectName, setNewSubjectName] = useState<string>('');
  const [newSubjectCode, setNewSubjectCode] = useState<string>('');

  // Material upload form
  const [matTitle, setMatTitle] = useState('');
  const [matProgram, setMatProgram] = useState<ProgramType>('B.Pharm');
  const [matSem, setMatSem] = useState('Semester 1');
  const [matSubject, setMatSubject] = useState('');
  const [matType, setMatType] = useState('Study Notes');
  const [matDesc, setMatDesc] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);

  // Event form
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('Workshop');
  const [evStatus, setEvStatus] = useState<'upcoming' | 'past' | 'draft'>('upcoming');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evSeats, setEvSeats] = useState('100');
  const [evDesc, setEvDesc] = useState('');
  const [evPoster, setEvPoster] = useState<File | null>(null);

  // Registration filter
  const [regEventFilter, setRegEventFilter] = useState<string>('all');

  // Gallery forms
  const [albTitle, setAlbTitle] = useState('');
  const [albCat, setAlbCat] = useState<string>(GALLERY_CATEGORIES[0]);
  const [albDate, setAlbDate] = useState('');
  const [albDesc, setAlbDesc] = useState('');
  const [albCover, setAlbCover] = useState<File | null>(null);

  const [photoAlbumId, setPhotoAlbumId] = useState<string>('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDate, setPhotoDate] = useState('');
  const [photoCat, setPhotoCat] = useState<string>(GALLERY_CATEGORIES[0]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Team form
  const [tmName, setTmName] = useState('');
  const [tmDesig, setTmDesig] = useState('');
  const [tmSection, setTmSection] = useState<string>(TEAM_SECTIONS[0]);
  const [tmBio, setTmBio] = useState('');
  const [tmLinkedIn, setTmLinkedIn] = useState('');
  const [tmEmail, setTmEmail] = useState('');
  const [tmPhoto, setTmPhoto] = useState<File | null>(null);

  // Certificate form
  const [certName, setCertName] = useState('');
  const [certEmail, setCertEmail] = useState('');
  const [certEventId, setCertEventId] = useState<string>('');
  const [certEventName, setCertEventName] = useState('');
  const [certEventDate, setCertEventDate] = useState('');
  const [certOrg, setCertOrg] = useState('RxOrbit');
  const [certTitle, setCertTitle] = useState('Certificate of Participation');
  const [certSubtitle, setCertSubtitle] = useState('This certificate is awarded to');
  const [certSignatory, setCertSignatory] = useState('');
  const [certSignRole, setCertSignRole] = useState('');
  const [certAccent, setCertAccent] = useState('#0D9488');

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annCat, setAnnCat] = useState('Upcoming Event');
  const [annLink, setAnnLink] = useState('/events');

  useEffect(() => {
    setContentForm(siteContent);
  }, [siteContent]);

  const loadAdminData = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const [ov, st, curr, mat, ev, reg, gal, tm, vc, ct, an] = await Promise.all([
        apiRequest<{ stats: Record<string, number> }>('/api/admin/overview'),
        apiRequest<{ users: User[] }>('/api/admin/students'),
        apiRequest<{ units: CurriculumUnit[] }>('/api/curriculum'),
        apiRequest<{ materials: StudyMaterial[] }>('/api/materials'),
        apiRequest<{ events: RxEvent[] }>('/api/admin/events'),
        apiRequest<{ registrations: EventRegistration[] }>('/api/admin/registrations'),
        apiRequest<{ albums: GalleryAlbum[]; photos: GalleryPhoto[] }>('/api/gallery'),
        apiRequest<{ members: TeamMember[] }>('/api/team'),
        apiRequest<{ voices: VoiceEntry[] }>('/api/admin/voices'),
        apiRequest<{ certificates: Certificate[] }>('/api/admin/certificates'),
        apiRequest<{ announcements: Announcement[] }>('/api/admin/announcements'),
      ]);
      setStats(ov?.stats && typeof ov.stats === 'object' ? ov.stats : {});
      setStudents(Array.isArray(st?.users) ? st.users : []);
      setCurriculum(Array.isArray(curr?.units) ? curr.units : []);
      setMaterials(Array.isArray(mat?.materials) ? mat.materials : []);
      setEvents(Array.isArray(ev?.events) ? ev.events : []);
      setRegistrations(Array.isArray(reg?.registrations) ? reg.registrations : []);
      const safeAlbums = Array.isArray(gal?.albums) ? gal.albums : [];
      setAlbums(safeAlbums);
      setPhotos(Array.isArray(gal?.photos) ? gal.photos : []);
      if (safeAlbums.length > 0 && !photoAlbumId) {
        setPhotoAlbumId(String(safeAlbums[0].id));
      }
      setTeam(Array.isArray(tm?.members) ? tm.members : []);
      setVoices(Array.isArray(vc?.voices) ? vc.voices : []);
      setCertificates(Array.isArray(ct?.certificates) ? ct.certificates : []);
      setAnnouncements(Array.isArray(an?.announcements) ? an.announcements : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin data.');
    }
  }, [user, photoAlbumId]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-16 text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h1 className="text-2xl font-display font-bold text-[#0F2442]">
          Administrator Access Required
        </h1>
        <p className="text-sm text-slate-600">
          This area is protected. Please sign in with an RxOrbit administrator account to manage
          study materials, events, students, gallery albums, and certificates.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F2442] rounded-lg cursor-pointer"
        >
          Go to Administrator Login
        </button>
      </div>
    );
  }

  const notify = (msg: string) => {
    setErrorMsg('');
    setNotice(msg);
  };

  const fail = (err: unknown) => {
    setNotice('');
    setErrorMsg(err instanceof Error ? err.message : 'Action failed.');
  };

  const mpharmUnits = curriculum.filter((u) => u.program === 'M.Pharm');
  const semOptions: string[] =
    matProgram === 'B.Pharm'
      ? [...BPHARM_SEMESTERS]
      : mpharmUnits.map((u) => u.name);

  const activeMatUnit = curriculum.find(
    (u) => u.program === matProgram && u.name === matSem
  );
  const subjectOptions: string[] = activeMatUnit
    ? activeMatUnit.subjects.map((s) => s.name)
    : [];

  const handleAddMPharmSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ units: CurriculumUnit[] }>('/api/admin/curriculum/units', {
        method: 'POST',
        body: JSON.stringify({ program: 'M.Pharm', name: newSpecName }),
      });
      setCurriculum(res.units);
      setCurrUnitName(newSpecName.trim());
      setNewSpecName('');
      notify('M.Pharm specialization added.');
      await onRefreshPublic();
    } catch (err) {
      fail(err);
    }
  };

  const handleAddCurriculumSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ units: CurriculumUnit[] }>(
        '/api/admin/curriculum/subjects',
        {
          method: 'POST',
          body: JSON.stringify({
            program: currProgram,
            unitName: currUnitName,
            name: newSubjectName,
            code: newSubjectCode,
          }),
        }
      );
      setCurriculum(res.units);
      setNewSubjectName('');
      setNewSubjectCode('');
      notify(`Subject added under ${currProgram} · ${currUnitName}.`);
      await onRefreshPublic();
    } catch (err) {
      fail(err);
    }
  };

  const handleMaterialUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matFile) {
      setErrorMsg('Please attach a PDF file.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', matTitle);
      fd.append('program', matProgram);
      fd.append('semesterOrSpec', matSem);
      fd.append('subject', matSubject);
      fd.append('materialType', matType);
      fd.append('description', matDesc);
      fd.append('file', matFile);
      await apiRequest('/api/admin/materials', { method: 'POST', body: fd });
      setMatTitle('');
      setMatDesc('');
      setMatFile(null);
      notify('Study material PDF uploaded and published.');
      await Promise.all([loadAdminData(), onRefreshPublic()]);
    } catch (err) {
      fail(err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', evTitle);
      fd.append('eventType', evType);
      fd.append('status', evStatus);
      fd.append('eventDate', evDate);
      fd.append('eventTime', evTime);
      fd.append('venueOrMode', evVenue);
      fd.append('maxSeats', evSeats);
      fd.append('description', evDesc);
      if (evPoster) fd.append('poster', evPoster);
      await apiRequest('/api/admin/events', { method: 'POST', body: fd });
      setEvTitle('');
      setEvDesc('');
      setEvPoster(null);
      notify('Event saved successfully.');
      await Promise.all([loadAdminData(), onRefreshPublic()]);
    } catch (err) {
      fail(err);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', albTitle);
      fd.append('category', albCat);
      fd.append('eventDate', albDate);
      fd.append('description', albDesc);
      if (albCover) fd.append('cover', albCover);
      await apiRequest('/api/admin/gallery/albums', { method: 'POST', body: fd });
      setAlbTitle('');
      setAlbDesc('');
      setAlbCover(null);
      notify('Gallery album created.');
      await Promise.all([loadAdminData(), onRefreshPublic()]);
    } catch (err) {
      fail(err);
    }
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile || !photoAlbumId) {
      setErrorMsg('Select an album and image file.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('albumId', photoAlbumId);
      fd.append('caption', photoCaption);
      fd.append('eventDate', photoDate);
      fd.append('category', photoCat);
      fd.append('image', photoFile);
      await apiRequest('/api/admin/gallery/photos', { method: 'POST', body: fd });
      setPhotoCaption('');
      setPhotoFile(null);
      notify('Photograph uploaded to gallery.');
      await Promise.all([loadAdminData(), onRefreshPublic()]);
    } catch (err) {
      fail(err);
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('fullName', tmName);
      fd.append('designation', tmDesig);
      fd.append('section', tmSection);
      fd.append('bio', tmBio);
      fd.append('linkedinUrl', tmLinkedIn);
      fd.append('email', tmEmail);
      if (tmPhoto) fd.append('photo', tmPhoto);
      await apiRequest('/api/admin/team', { method: 'POST', body: fd });
      setTmName('');
      setTmDesig('');
      setTmBio('');
      setTmLinkedIn('');
      setTmEmail('');
      setTmPhoto(null);
      notify('Team member added.');
      await Promise.all([loadAdminData(), onRefreshPublic()]);
    } catch (err) {
      fail(err);
    }
  };

  const handleGenerateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ certificate: Certificate }>('/api/admin/certificates', {
        method: 'POST',
        body: JSON.stringify({
          participantName: certName,
          participantEmail: certEmail,
          eventId: certEventId ? Number(certEventId) : null,
          eventName: certEventName,
          eventDate: certEventDate,
          organizationName: certOrg,
          templateTitle: certTitle,
          templateSubtitle: certSubtitle,
          signatoryName: certSignatory,
          signatoryRole: certSignRole,
          accentColor: certAccent,
        }),
      });
      setCertName('');
      setCertEmail('');
      notify(`Certificate ${res.certificate.certificateCode} generated and issued.`);
      await loadAdminData();
    } catch (err) {
      fail(err);
    }
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify(contentForm),
      });
      notify('Website content updated across all public pages.');
      await onRefreshPublic();
    } catch (err) {
      fail(err);
    }
  };

  const filteredRegs =
    regEventFilter === 'all'
      ? registrations
      : registrations.filter((r) => String(r.eventId) === regEventFilter);

  const exportRegistrationsCsv = () => {
    const header = 'Code,Event,Name,Email,Institution,Course,Semester,Attendance\n';
    const rows = filteredRegs
      .map((r) =>
        [
          r.registrationCode,
          r.eventTitle || '',
          r.fullName,
          r.email,
          r.institution,
          r.course,
          r.semesterOrYear,
          r.attendanceStatus,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rxorbit_event_registrations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 sticky top-20">
            <div className="px-3 py-2 border-b border-slate-100 mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                Admin Console
              </div>
              <div className="text-sm font-bold text-[#0F2442] truncate">{user.fullName}</div>
            </div>
            {ADMIN_TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setNotice('');
                    setErrorMsg('');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F2442] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Panel */}
        <div className="flex-1 min-w-0 space-y-6">
          {notice && (
            <div
              role="status"
              className="p-3.5 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-lg"
            >
              {notice}
            </div>
          )}
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg"
            >
              {errorMsg}
            </div>
          )}

          {/* 1. Overview */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-display font-bold text-[#0F2442]">
                Platform Overview
              </h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Registered Students', val: stats.students ?? 0 },
                  { label: 'Study Materials', val: stats.materials ?? 0 },
                  { label: 'Events', val: stats.events ?? 0 },
                  { label: 'Event Registrations', val: stats.registrations ?? 0 },
                  { label: 'Gallery Photos', val: stats.galleryPhotos ?? 0 },
                  { label: 'Team Members', val: stats.teamMembers ?? 0 },
                  { label: 'Pending Voices', val: stats.pendingVoices ?? 0 },
                  { label: 'Issued Certificates', val: stats.certificates ?? 0 },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-1"
                  >
                    <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
                    <div className="text-2xl font-display font-bold text-[#0F2442] tabular-nums">
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Student Management */}
          {tab === 'students' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-display font-bold text-[#0F2442]">
                Student &amp; Member Management
              </h1>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-3">Name &amp; Email</th>
                      <th className="py-2.5 pr-3">Institution</th>
                      <th className="py-2.5 pr-3">Course / Year</th>
                      <th className="py-2.5 pr-3">Role</th>
                      <th className="py-2.5 pr-3">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#0F2442]">{u.fullName}</div>
                          <div className="text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">{u.institution}</td>
                        <td className="py-3 pr-3 text-slate-700">
                          {u.course} · {u.semesterOrYear}
                        </td>
                        <td className="py-3 pr-3 font-medium capitalize">{u.role}</td>
                        <td className="py-3 pr-3 font-medium capitalize">{u.status}</td>
                        <td className="py-3 text-right space-x-2 whitespace-nowrap">
                          {u.id !== user.id && (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/admin/students/${u.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({
                                        status: u.status === 'active' ? 'suspended' : 'active',
                                      }),
                                    });
                                    notify(`Updated status for ${u.fullName}.`);
                                    await loadAdminData();
                                  } catch (err) {
                                    fail(err);
                                  }
                                }}
                                className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                              >
                                {u.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/admin/students/${u.id}`, {
                                      method: 'DELETE',
                                    });
                                    notify(`Removed account ${u.fullName}.`);
                                    await loadAdminData();
                                  } catch (err) {
                                    fail(err);
                                  }
                                }}
                                aria-label={`Delete ${u.fullName}`}
                                className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Study Material Management & Curriculum */}
          {tab === 'materials' && (
            <div className="space-y-6">
              {/* Curriculum Configuration */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-display font-bold text-[#0F2442]">
                    Configure B.Pharm &amp; M.Pharm Curriculum
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add subjects to B.Pharm Semesters 1–8 or create M.Pharm specializations and
                    subjects. Only administrator-configured items appear in the Study Hub.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Add M.Pharm Specialization */}
                  <form
                    onSubmit={handleAddMPharmSpec}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#0F2442]">
                      Add M.Pharm Specialization
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newSpecName}
                        onChange={(e) => setNewSpecName(e.target.value)}
                        placeholder="e.g. Pharmaceutics"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
                      >
                        Add Specialization
                      </button>
                    </div>
                  </form>

                  {/* Add Subject under Semester / Specialization */}
                  <form
                    onSubmit={handleAddCurriculumSubject}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#0F2442]">
                      Add Subject to Semester or Specialization
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        aria-label="Curriculum Program"
                        value={currProgram}
                        onChange={(e) => {
                          const nextProg = e.target.value as ProgramType;
                          setCurrProgram(nextProg);
                          setCurrUnitName(
                            nextProg === 'B.Pharm'
                              ? 'Semester 1'
                              : mpharmUnits[0]?.name || ''
                          );
                        }}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="B.Pharm">B.Pharm</option>
                        <option value="M.Pharm">M.Pharm</option>
                      </select>
                      {currProgram === 'B.Pharm' ? (
                        <select
                          aria-label="Curriculum Semester"
                          value={currUnitName}
                          onChange={(e) => setCurrUnitName(e.target.value)}
                          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                        >
                          {BPHARM_SEMESTERS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          aria-label="Curriculum Specialization"
                          value={currUnitName}
                          onChange={(e) => setCurrUnitName(e.target.value)}
                          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="">-- Select specialization --</option>
                          {mpharmUnits.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        required
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="Subject name"
                        className="flex-1 min-w-[160px] px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        placeholder="Code (optional)"
                        className="w-28 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer shrink-0"
                      >
                        Add Subject
                      </button>
                    </div>
                  </form>
                </div>

                {curriculum.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Configured Curriculum Units ({curriculum.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {curriculum.map((unit) => (
                        <div
                          key={unit.id}
                          className="p-3.5 border border-slate-200 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0F2442]">
                              {unit.program} · {unit.name}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest<{ units: CurriculumUnit[] }>(
                                    `/api/admin/curriculum/units/${unit.id}`,
                                    { method: 'DELETE' }
                                  );
                                  setCurriculum(res.units);
                                  notify(`Removed ${unit.program} · ${unit.name}.`);
                                  await onRefreshPublic();
                                } catch (err) {
                                  fail(err);
                                }
                              }}
                              className="text-[11px] text-red-600 hover:underline cursor-pointer"
                            >
                              Remove unit
                            </button>
                          </div>
                          {unit.subjects.length === 0 ? (
                            <p className="text-[11px] text-slate-500">No subjects added yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {unit.subjects.map((sub) => (
                                <span
                                  key={sub.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700 rounded"
                                >
                                  <span>
                                    {sub.code ? `${sub.code}: ` : ''}
                                    {sub.name}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Remove subject ${sub.name}`}
                                    onClick={async () => {
                                      try {
                                        const res = await apiRequest<{ units: CurriculumUnit[] }>(
                                          `/api/admin/curriculum/subjects/${sub.id}`,
                                          { method: 'DELETE' }
                                        );
                                        setCurriculum(res.units);
                                        notify(`Removed subject ${sub.name}.`);
                                        await onRefreshPublic();
                                      } catch (err) {
                                        fail(err);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-800 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={handleMaterialUpload}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Upload Study Hub PDF Material
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="mat-prog" className="block text-xs font-semibold text-slate-700 mb-1">
                      Program
                    </label>
                    <select
                      id="mat-prog"
                      value={matProgram}
                      onChange={(e) => {
                        const next = e.target.value as ProgramType;
                        setMatProgram(next);
                        if (next === 'B.Pharm') {
                          setMatSem('Semester 1');
                        } else {
                          setMatSem(mpharmUnits[0]?.name || '');
                        }
                        setMatSubject('');
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="B.Pharm">B.Pharm</option>
                      <option value="M.Pharm">M.Pharm</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mat-sem" className="block text-xs font-semibold text-slate-700 mb-1">
                      {matProgram === 'B.Pharm' ? 'Semester' : 'Specialization'}
                    </label>
                    {matProgram === 'B.Pharm' ? (
                      <select
                        id="mat-sem"
                        value={matSem}
                        onChange={(e) => {
                          setMatSem(e.target.value);
                          setMatSubject('');
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {semOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          id="mat-sem"
                          type="text"
                          required
                          list="mpharm-spec-list"
                          value={matSem}
                          onChange={(e) => setMatSem(e.target.value)}
                          placeholder="Select or type M.Pharm specialization"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                        />
                        <datalist id="mpharm-spec-list">
                          {semOptions.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>
                  <div>
                    <label htmlFor="mat-sub" className="block text-xs font-semibold text-slate-700 mb-1">
                      Subject
                    </label>
                    <input
                      id="mat-sub"
                      type="text"
                      required
                      list="configured-subject-list"
                      value={matSubject}
                      onChange={(e) => setMatSubject(e.target.value)}
                      placeholder="Select or enter subject name"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    />
                    <datalist id="configured-subject-list">
                      {subjectOptions.map((s: string) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mat-title" className="block text-xs font-semibold text-slate-700 mb-1">
                      Material Title
                    </label>
                    <input
                      id="mat-title"
                      type="text"
                      required
                      value={matTitle}
                      onChange={(e) => setMatTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      placeholder="Enter study material title"
                    />
                  </div>
                  <div>
                    <label htmlFor="mat-type" className="block text-xs font-semibold text-slate-700 mb-1">
                      Material Type
                    </label>
                    <select
                      id="mat-type"
                      value={matType}
                      onChange={(e) => setMatType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {MATERIAL_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="mat-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="mat-desc"
                    rows={2}
                    value={matDesc}
                    onChange={(e) => setMatDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Concise syllabus topics covered in this PDF..."
                  />
                </div>
                <div>
                  <label htmlFor="mat-file" className="block text-xs font-semibold text-slate-700 mb-1">
                    PDF Document (Max 15 MB)
                  </label>
                  <input
                    id="mat-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Upload &amp; Publish Material
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  Published Materials ({materials.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {materials.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F2442] truncate">
                          {m.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {m.program} · {m.semesterOrSpec} · {m.subject} ·{' '}
                          {formatFileSize(m.fileSize)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiRequest(`/api/admin/materials/${m.id}`, {
                              method: 'DELETE',
                            });
                            notify(`Deleted ${m.title}.`);
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          } catch (err) {
                            fail(err);
                          }
                        }}
                        aria-label={`Delete ${m.title}`}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Events Management */}
          {tab === 'events' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateEvent}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Create Event
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ev-title" className="block text-xs font-semibold text-slate-700 mb-1">
                      Event Title
                    </label>
                    <input
                      id="ev-title"
                      type="text"
                      required
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ev-type" className="block text-xs font-semibold text-slate-700 mb-1">
                        Event Type
                      </label>
                      <select
                        id="ev-type"
                        value={evType}
                        onChange={(e) => setEvType(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ev-status" className="block text-xs font-semibold text-slate-700 mb-1">
                        Status
                      </label>
                      <select
                        id="ev-status"
                        value={evStatus}
                        onChange={(e) =>
                          setEvStatus(e.target.value as 'upcoming' | 'past' | 'draft')
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="past">Past</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="ev-date" className="block text-xs font-semibold text-slate-700 mb-1">
                      Date
                    </label>
                    <input
                      id="ev-date"
                      type="date"
                      required
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-time" className="block text-xs font-semibold text-slate-700 mb-1">
                      Time
                    </label>
                    <input
                      id="ev-time"
                      type="text"
                      required
                      value={evTime}
                      onChange={(e) => setEvTime(e.target.value)}
                      placeholder="Enter event time"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-venue" className="block text-xs font-semibold text-slate-700 mb-1">
                      Venue / Mode
                    </label>
                    <input
                      id="ev-venue"
                      type="text"
                      required
                      value={evVenue}
                      onChange={(e) => setEvVenue(e.target.value)}
                      placeholder="Enter venue or online mode"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-seats" className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Seats
                    </label>
                    <input
                      id="ev-seats"
                      type="number"
                      min={1}
                      value={evSeats}
                      onChange={(e) => setEvSeats(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="ev-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="ev-desc"
                    rows={3}
                    required
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="ev-poster" className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional Poster Image (JPG / PNG / WebP)
                  </label>
                  <input
                    id="ev-poster"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEvPoster(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Publish Event
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  Manage Events ({events.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0F2442]">{ev.title}</div>
                        <div className="text-xs text-slate-500">
                          {ev.eventType} · {ev.eventDate} · {ev.registrationCount ?? 0} registered
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status for ${ev.title}`}
                          value={ev.status}
                          onChange={async (e) => {
                            try {
                              await apiRequest(`/api/admin/events/${ev.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: e.target.value }),
                              });
                              notify(`Updated status for ${ev.title}.`);
                              await Promise.all([loadAdminData(), onRefreshPublic()]);
                            } catch (err) {
                              fail(err);
                            }
                          }}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="past">Past</option>
                          <option value="draft">Draft</option>
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/admin/events/${ev.id}`, {
                                method: 'DELETE',
                              });
                              notify(`Deleted event ${ev.title}.`);
                              await Promise.all([loadAdminData(), onRefreshPublic()]);
                            } catch (err) {
                              fail(err);
                            }
                          }}
                          aria-label={`Delete ${ev.title}`}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. Event Registration Management */}
          {tab === 'registrations' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Event Registration Management ({filteredRegs.length})
                </h1>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Filter registrations by event"
                    value={regEventFilter}
                    onChange={(e) => setRegEventFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="all">All Events</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={String(ev.id)}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={exportRegistrationsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2442] border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Participant</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Institution / Course</th>
                      <th className="py-2">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRegs.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 pr-3 font-mono">{r.registrationCode}</td>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#0F2442]">{r.fullName}</div>
                          <div className="text-slate-500">{r.email}</div>
                        </td>
                        <td className="py-3 pr-3">{r.eventTitle}</td>
                        <td className="py-3 pr-3">
                          {r.institution} ({r.course})
                        </td>
                        <td className="py-3">
                          <select
                            aria-label={`Attendance for ${r.fullName}`}
                            value={r.attendanceStatus}
                            onChange={async (e) => {
                              try {
                                await apiRequest(`/api/admin/registrations/${r.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ attendanceStatus: e.target.value }),
                                });
                                notify(`Attendance updated for ${r.fullName}.`);
                                await loadAdminData();
                              } catch (err) {
                                fail(err);
                              }
                            }}
                            className="px-2 py-1 border border-slate-200 rounded bg-white"
                          >
                            <option value="registered">Registered</option>
                            <option value="attended">Attended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Gallery Management */}
          {tab === 'gallery' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleCreateAlbum}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
                >
                  <h2 className="font-display font-bold text-lg text-[#0F2442]">
                    Create Gallery Album
                  </h2>
                  <input
                    type="text"
                    required
                    value={albTitle}
                    onChange={(e) => setAlbTitle(e.target.value)}
                    placeholder="Album Title"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={albCat}
                      onChange={(e) => setAlbCat(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {GALLERY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      required
                      value={albDate}
                      onChange={(e) => setAlbDate(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={albDesc}
                    onChange={(e) => setAlbDesc(e.target.value)}
                    placeholder="Album description"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setAlbCover(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2442] rounded-lg cursor-pointer"
                  >
                    Create Album
                  </button>
                </form>

                <form
                  onSubmit={handleUploadPhoto}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
                >
                  <h2 className="font-display font-bold text-lg text-[#0F2442]">
                    Upload Gallery Photograph
                  </h2>
                  <select
                    value={photoAlbumId}
                    onChange={(e) => setPhotoAlbumId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {albums.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="Photo caption"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={photoCat}
                      onChange={(e) => setPhotoCat(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {GALLERY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      required
                      value={photoDate}
                      onChange={(e) => setPhotoDate(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                  >
                    Upload Photograph
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  Albums ({albums.length}) &amp; Photographs ({photos.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {albums.map((a) => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span>
                        <strong>{a.title}</strong> · {a.category} ({a.photoCount ?? 0} photos)
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/gallery/albums/${a.id}`, {
                            method: 'DELETE',
                          });
                          notify(`Deleted album ${a.title}.`);
                          await Promise.all([loadAdminData(), onRefreshPublic()]);
                        }}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Delete Album
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {photos.map((p) => (
                    <div key={p.id} className="border border-slate-200 rounded-lg p-2 space-y-1.5">
                      <img
                        src={p.imageUrl}
                        alt={p.caption}
                        className="w-full h-24 object-cover rounded"
                      />
                      <p className="text-xs text-slate-700 line-clamp-1">{p.caption}</p>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/gallery/photos/${p.id}`, {
                            method: 'DELETE',
                          });
                          notify('Photograph deleted.');
                          await Promise.all([loadAdminData(), onRefreshPublic()]);
                        }}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. Team Management */}
          {tab === 'team' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddTeamMember}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Add Team Member
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={tmName}
                    onChange={(e) => setTmName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={tmDesig}
                    onChange={(e) => setTmDesig(e.target.value)}
                    placeholder="Designation"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <select
                    value={tmSection}
                    onChange={(e) => setTmSection(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {TEAM_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  value={tmBio}
                  onChange={(e) => setTmBio(e.target.value)}
                  placeholder="Short academic biography"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <input
                    type="url"
                    value={tmLinkedIn}
                    onChange={(e) => setTmLinkedIn(e.target.value)}
                    placeholder="LinkedIn URL (optional)"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="email"
                    value={tmEmail}
                    onChange={(e) => setTmEmail(e.target.value)}
                    placeholder="Contact email (optional)"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setTmPhoto(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                >
                  Add Member
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  Current Team ({team.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {team.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[#0F2442]">
                          {m.fullName} — <span className="text-teal-700">{m.designation}</span>
                        </div>
                        <div className="text-xs text-slate-500">{m.section}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/team/${m.id}`, { method: 'DELETE' });
                          notify(`Removed ${m.fullName}.`);
                          await Promise.all([loadAdminData(), onRefreshPublic()]);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8. Voices of RxOrbit Management */}
          {tab === 'voices' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-display font-bold text-[#0F2442]">
                Voices of RxOrbit Moderation ({voices.length})
              </h1>
              <div className="divide-y divide-slate-100">
                {voices.map((v) => (
                  <div key={v.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm text-[#0F2442]">{v.authorName}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {v.institution} · {v.courseDetails}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            v.status === 'approved'
                              ? 'text-teal-700'
                              : v.status === 'rejected'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {v.status}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/voices/${v.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'approved' }),
                            });
                            notify(`Approved submission by ${v.authorName}.`);
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-teal-700 rounded cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/voices/${v.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'rejected' }),
                            });
                            notify(`Rejected submission by ${v.authorName}.`);
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 rounded cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/voices/${v.id}`, {
                              method: 'DELETE',
                            });
                            notify(`Deleted submission by ${v.authorName}.`);
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-[#0F2442]">“{v.quote}”</p>
                    <p className="text-xs text-slate-600">{v.story}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. Certificate Management */}
          {tab === 'certificates' && (
            <div className="space-y-6">
              <form
                onSubmit={handleGenerateCertificate}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Generate &amp; Customize Certificate
                </h1>

                {registrations.length > 0 && (
                  <div>
                    <label htmlFor="cert-prefill" className="block text-xs font-semibold text-slate-600 mb-1">
                      Quick-fill from Registered Event Participant
                    </label>
                    <select
                      id="cert-prefill"
                      defaultValue=""
                      onChange={(e) => {
                        const reg = registrations.find((r) => String(r.id) === e.target.value);
                        if (reg) {
                          setCertName(reg.fullName);
                          setCertEmail(reg.email);
                          setCertEventId(String(reg.eventId));
                          setCertEventName(reg.eventTitle || '');
                          setCertEventDate(reg.eventDate || '');
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">-- Select registered participant (optional) --</option>
                      {registrations.map((r) => (
                        <option key={r.id} value={String(r.id)}>
                          {r.fullName} ({r.email}) — {r.eventTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cert-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Participant Name
                    </label>
                    <input
                      id="cert-name"
                      type="text"
                      required
                      value={certName}
                      onChange={(e) => setCertName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="cert-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Participant Email
                    </label>
                    <input
                      id="cert-email"
                      type="email"
                      required
                      value={certEmail}
                      onChange={(e) => setCertEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="cert-ev" className="block text-xs font-semibold text-slate-700 mb-1">
                      Event Name
                    </label>
                    <input
                      id="cert-ev"
                      type="text"
                      required
                      value={certEventName}
                      onChange={(e) => setCertEventName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      placeholder="Enter event name"
                    />
                  </div>
                  <div>
                    <label htmlFor="cert-date" className="block text-xs font-semibold text-slate-700 mb-1">
                      Event Date
                    </label>
                    <input
                      id="cert-date"
                      type="date"
                      required
                      value={certEventDate}
                      onChange={(e) => setCertEventDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="Template Title"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={certSignatory}
                    onChange={(e) => setCertSignatory(e.target.value)}
                    placeholder="Signatory Name"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={certSignRole}
                    onChange={(e) => setCertSignRole(e.target.value)}
                    placeholder="Signatory Role"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <input
                    type="text"
                    value={certOrg}
                    onChange={(e) => setCertOrg(e.target.value)}
                    placeholder="Organization Name"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={certSubtitle}
                    onChange={(e) => setCertSubtitle(e.target.value)}
                    placeholder="Template Subtitle"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    <label htmlFor="cert-accent" className="font-semibold text-slate-700">
                      Accent Color:
                    </label>
                    <input
                      id="cert-accent"
                      type="color"
                      value={certAccent}
                      onChange={(e) => setCertAccent(e.target.value)}
                      className="h-8 w-12 rounded border border-slate-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Generate Certificate
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  Issued Certificates ({certificates.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {certificates.map((c) => (
                    <div
                      key={c.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0F2442]">
                          {c.participantName}{' '}
                          <span className="font-mono text-xs text-teal-700 ml-1">
                            {c.certificateCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {c.eventName} · {c.eventDate} · {c.participantEmail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/certificates/${encodeURIComponent(c.certificateCode)}/pdf`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F2442] border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Download PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/certificates/${c.id}`, {
                              method: 'DELETE',
                            });
                            notify(`Revoked certificate ${c.certificateCode}.`);
                            await loadAdminData();
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 10. Announcements */}
          {tab === 'announcements' && (
            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiRequest('/api/admin/announcements', {
                      method: 'POST',
                      body: JSON.stringify({
                        title: annTitle,
                        message: annMsg,
                        category: annCat,
                        linkPath: annLink,
                      }),
                    });
                    setAnnTitle('');
                    setAnnMsg('');
                    notify('Announcement published.');
                    await Promise.all([loadAdminData(), onRefreshPublic()]);
                  } catch (err) {
                    fail(err);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h1 className="text-xl font-display font-bold text-[#0F2442]">
                  Publish Announcement
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="Announcement Title"
                    className="sm:col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={annCat}
                    onChange={(e) => setAnnCat(e.target.value)}
                    placeholder="Category"
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={annMsg}
                    onChange={(e) => setAnnMsg(e.target.value)}
                    placeholder="Announcement summary message"
                    className="sm:col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <select
                    value={annLink}
                    onChange={(e) => setAnnLink(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="/events">Link: Events</option>
                    <option value="/study-hub">Link: Study Hub</option>
                    <option value="/voices">Link: Voices</option>
                    <option value="/verify">Link: Verify Certificate</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                >
                  Publish Announcement
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-[#0F2442]">
                  All Announcements ({announcements.length})
                </h2>
                <div className="divide-y divide-slate-100">
                  {announcements.map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[#0F2442]">{a.title}</div>
                        <div className="text-xs text-slate-500">{a.message}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/announcements/${a.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isActive: !a.isActive }),
                            });
                            notify('Announcement visibility updated.');
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          }}
                          className="px-3 py-1 text-xs font-semibold border border-slate-200 rounded cursor-pointer"
                        >
                          {a.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/announcements/${a.id}`, {
                              method: 'DELETE',
                            });
                            notify('Announcement deleted.');
                            await Promise.all([loadAdminData(), onRefreshPublic()]);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 11. Website Content Management */}
          {tab === 'content' && (
            <form
              onSubmit={handleSaveContent}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h1 className="text-xl font-display font-bold text-[#0F2442]">
                Website Content Management
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Headline
                  </label>
                  <input
                    type="text"
                    value={contentForm.heroTitle}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, heroTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={contentForm.heroTagline}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, heroTagline: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hero Introduction
                </label>
                <textarea
                  rows={2}
                  value={contentForm.heroSubtitle}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, heroSubtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  About RxOrbit Summary
                </label>
                <textarea
                  rows={2}
                  value={contentForm.aboutSummary}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, aboutSummary: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Our Vision
                  </label>
                  <textarea
                    rows={3}
                    value={contentForm.vision}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, vision: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Our Mission
                  </label>
                  <textarea
                    rows={3}
                    value={contentForm.mission}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, mission: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Our Objectives (one per line)
                </label>
                <textarea
                  rows={4}
                  value={contentForm.objectives}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, objectives: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Why RxOrbit?
                  </label>
                  <textarea
                    rows={3}
                    value={contentForm.whyRxOrbit}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, whyRxOrbit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Commitment to Pharmacy Education
                  </label>
                  <textarea
                    rows={3}
                    value={contentForm.commitment}
                    onChange={(e) =>
                      setContentForm({ ...contentForm, commitment: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  value={contentForm.contactEmail}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, contactEmail: e.target.value })
                  }
                  placeholder="Contact Email"
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={contentForm.contactPhone}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, contactPhone: e.target.value })
                  }
                  placeholder="Contact Phone"
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={contentForm.contactAddress}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, contactAddress: e.target.value })
                  }
                  placeholder="Contact Address"
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Save Website Content
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
