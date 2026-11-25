import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  Megaphone,
  MessageSquareQuote,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { parseLinkPath, type RoutePath } from '../lib/domain';
import type {
  Certificate,
  EventRegistration,
  NotificationCategory,
  VoiceEntry,
} from '../types';

interface StudentDashboardPageProps {
  onNavigate: (path: RoutePath, search?: string) => void;
}

function parseLink(raw: string): { path: RoutePath; search: string } {
  return parseLinkPath(raw);
}

export function StudentDashboardPage({ onNavigate }: StudentDashboardPageProps) {
  const {
    user,
    updateProfile,
    notifications,
    unreadCount,
    notificationsLoading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAuth();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifFilter, setNotifFilter] = useState<NotificationCategory | 'all'>('all');

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [institution, setInstitution] = useState(user?.institution || '');
  const [course, setCourse] = useState<'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator'>(
    user?.course || 'B.Pharm'
  );
  const [semesterOrYear, setSemesterOrYear] = useState(user?.semesterOrYear || '');
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileErr, setProfileErr] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setInstitution(user.institution);
    setCourse(user.course);
    setSemesterOrYear(user.semesterOrYear);

    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [regRes, certRes, voiceRes] = await Promise.all([
          apiRequest<{ registrations: EventRegistration[] }>('/api/my/registrations'),
          apiRequest<{ certificates: Certificate[] }>('/api/my/certificates'),
          apiRequest<{ voices: VoiceEntry[] }>('/api/my/voices'),
        ]);
        if (!active) return;
        setRegistrations(regRes.registrations);
        setCertificates(certRes.certificates);
        setVoices(voiceRes.voices);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    return notifications.filter((n) => n.category === notifFilter);
  }, [notifications, notifFilter]);

  if (!user) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#0F2442]">
          Sign in to access your Student Dashboard
        </h1>
        <p className="text-sm text-slate-600">
          View your profile, notifications, event registrations, Voices of RxOrbit submissions, and
          verified certificates.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F2442] rounded-lg cursor-pointer"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErr('');
    setProfileSaved(false);
    setSaving(true);
    try {
      await updateProfile({ fullName, institution, course, semesterOrYear });
      setProfileSaved(true);
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <SafeImage
              src={user.avatarUrl}
              alt={user.fullName}
              className="h-14 w-14 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <UserIcon className="h-6 w-6 text-teal-700" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Student Dashboard
            </p>
            <h1 className="text-3xl font-display font-bold text-[#0F2442] mt-0.5">
              Welcome, {user.fullName}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {user.course} · {user.semesterOrYear} · {user.institution}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/profile')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>Open Dedicated Profile</span>
          </button>
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-teal-300" />
              <span>Open Admin Dashboard</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('/study-hub')}
            className="px-4 py-2 text-xs font-semibold text-[#0F2442] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Browse Study Hub
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 h-fit">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#0F2442]">
              <UserIcon className="h-4 w-4 text-teal-700" />
              <h2 className="font-display font-bold text-lg">Academic Profile</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/profile')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              <span>Full Profile &amp; Photo</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          {profileErr && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {profileErr}
            </div>
          )}
          {profileSaved && (
            <div className="p-3 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Profile updated successfully.</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="prof-email" className="block text-xs font-semibold text-slate-500 mb-1">
                Registered Email
              </label>
              <input
                id="prof-email"
                type="email"
                disabled
                value={user.email}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label htmlFor="prof-inst" className="block text-xs font-semibold text-slate-700 mb-1">
                Institution
              </label>
              <input
                id="prof-inst"
                type="text"
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prof-course" className="block text-xs font-semibold text-slate-700 mb-1">
                  Course
                </label>
                <select
                  id="prof-course"
                  value={course}
                  onChange={(e) =>
                    setCourse(
                      e.target.value as 'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator'
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
                >
                  <option value="B.Pharm">B.Pharm</option>
                  <option value="M.Pharm">M.Pharm</option>
                  <option value="Educator">Educator</option>
                  <option value="Coordinator">Coordinator</option>
                </select>
              </div>
              <div>
                <label htmlFor="prof-sem" className="block text-xs font-semibold text-slate-700 mb-1">
                  Semester / Year
                </label>
                <input
                  id="prof-sem"
                  type="text"
                  required
                  value={semesterOrYear}
                  onChange={(e) => setSemesterOrYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Quick Changes'}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Alert Category: {user.preferredProgram || 'All'}</span>
            <button
              type="button"
              onClick={() => onNavigate('/profile')}
              className="text-teal-700 font-semibold hover:underline cursor-pointer"
            >
              Manage Bio &amp; Preferences
            </button>
          </div>
        </section>

        {/* Right Column: Notifications, Registrations, Certificates, Voices */}
        <div className="lg:col-span-7 space-y-6">
          {/* Notifications Feed */}
          <section
            aria-label="Notifications feed"
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-teal-700" />
                <h2 className="font-display font-bold text-lg text-[#0F2442]">Notifications</h2>
                <span className="text-xs font-semibold text-teal-700 tabular-nums">
                  ({unreadCount} unread)
                </span>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Alerts' },
                  { id: 'event', label: 'Upcoming Events' },
                  { id: 'material', label: 'Study Materials' },
                  { id: 'announcement', label: 'Announcements' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNotifFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    notifFilter === tab.id
                      ? 'bg-[#0F2442] text-white border-[#0F2442]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {notificationsLoading ? (
              <div className="h-24 bg-slate-50 rounded-lg animate-pulse" />
            ) : filteredNotifications.length === 0 ? (
              <p className="text-sm text-slate-500">
                No notifications found for this filter. Update your preferred program in your
                profile to customize material alerts.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredNotifications.map((n) => {
                  const target = parseLink(n.linkPath);
                  return (
                    <div
                      key={n.id}
                      className={`py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                        n.isRead ? 'opacity-85' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {n.category === 'event' ? (
                            <Calendar className="h-3.5 w-3.5 text-teal-700" />
                          ) : n.category === 'material' ? (
                            <BookOpen className="h-3.5 w-3.5 text-[#0F2442]" />
                          ) : (
                            <Megaphone className="h-3.5 w-3.5 text-amber-700" />
                          )}
                          <span className="font-semibold uppercase tracking-wider text-slate-500">
                            {n.category}
                          </span>
                          {n.targetProgram !== 'All' && (
                            <span className="text-teal-700 font-semibold">{n.targetProgram}</span>
                          )}
                          {!n.isRead && (
                            <span className="font-bold text-teal-700">· Unread</span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-[#0F2442]">{n.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!n.isRead) void markNotificationRead(n.id);
                            onNavigate(target.path, target.search);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Event Registrations */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#0F2442] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-700" />
                <span>My Event Registrations</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('/events')}
                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                Browse Events
              </button>
            </div>
            {loading ? (
              <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            ) : registrations.length === 0 ? (
              <p className="text-sm text-slate-500">
                You have not registered for any upcoming events yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {registrations.map((r) => (
                  <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#0F2442]">{r.eventTitle}</div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {r.eventDate} · Code: {r.registrationCode}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-teal-700 capitalize">
                      {r.attendanceStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Certificates */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#0F2442] flex items-center gap-2">
                <Award className="h-4 w-4 text-teal-700" />
                <span>My Certificates</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('/verify')}
                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                Verify Portal
              </button>
            </div>
            {loading ? (
              <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            ) : certificates.length === 0 ? (
              <p className="text-sm text-slate-500">
                Certificates issued for your email ({user.email}) will appear here automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {certificates.map((c) => (
                  <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#0F2442]">{c.eventName}</div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {c.certificateCode} · {c.eventDate}
                      </div>
                    </div>
                    <a
                      href={`/api/certificates/${encodeURIComponent(c.certificateCode)}/pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Voices Submissions */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#0F2442] flex items-center gap-2">
                <MessageSquareQuote className="h-4 w-4 text-teal-700" />
                <span>My Voices of RxOrbit Submissions</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('/voices')}
                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                Share New Experience
              </button>
            </div>
            {loading ? (
              <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            ) : voices.length === 0 ? (
              <p className="text-sm text-slate-500">
                Share your learning or event experience in Voices of RxOrbit.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {voices.map((v) => (
                  <div key={v.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {v.experienceType}
                      </span>
                      <span
                        className={`text-xs font-semibold capitalize ${
                          v.status === 'approved'
                            ? 'text-teal-700'
                            : v.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {v.status === 'pending' ? 'Pending Review' : v.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#0F2442]">“{v.quote}”</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
