import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  MessageSquareQuote,
  Plus,
  User as UserIcon,
  X,
} from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { RoutePath } from '../lib/domain';
import type {
  Certificate,
  CurriculumUnit,
  EventRegistration,
  ProgramType,
  VoiceEntry,
} from '../types';

interface ProfilePageProps {
  curriculumUnits?: CurriculumUnit[];
  onNavigate: (path: RoutePath, search?: string) => void;
}

export function ProfilePage({ curriculumUnits = [], onNavigate }: ProfilePageProps) {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState<'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator'>('B.Pharm');
  const [semesterOrYear, setSemesterOrYear] = useState('');
  const [bio, setBio] = useState('');
  const [preferredProgram, setPreferredProgram] = useState<ProgramType | 'All'>('All');
  const [preferredSubjects, setPreferredSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');

  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setInstitution(user.institution);
    setCourse(user.course);
    setSemesterOrYear(user.semesterOrYear);
    setBio(user.bio || '');
    setPreferredProgram(user.preferredProgram || 'All');
    setPreferredSubjects(user.preferredSubjects || []);

    let active = true;
    (async () => {
      setActivityLoading(true);
      try {
        const [voiceRes, regRes, certRes] = await Promise.allSettled([
          apiRequest<{ voices?: VoiceEntry[] }>('/api/my/voices'),
          apiRequest<{ registrations?: EventRegistration[] }>('/api/my/registrations'),
          apiRequest<{ certificates?: Certificate[] }>('/api/my/certificates'),
        ]);
        if (!active) return;
        if (voiceRes.status === 'fulfilled' && Array.isArray(voiceRes.value?.voices)) {
          setVoices(voiceRes.value.voices);
        }
        if (regRes.status === 'fulfilled' && Array.isArray(regRes.value?.registrations)) {
          setRegistrations(regRes.value.registrations);
        }
        if (certRes.status === 'fulfilled' && Array.isArray(certRes.value?.certificates)) {
          setCertificates(certRes.value.certificates);
        }
      } catch {
        // ignore transient error
      } finally {
        if (active) setActivityLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#0F2442]">
          Sign in to view your Profile
        </h1>
        <p className="text-sm text-slate-600">
          Registered students can edit personal and academic details, upload a profile picture, set
          Study Hub notification preferences, and review submitted content.
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

  const handleToggleSubject = (subj: string) => {
    setPreferredSubjects((prev) => {
      if (prev.includes(subj)) {
        return prev.filter((item) => item !== subj);
      }
      if (prev.length >= 12) return prev;
      return [...prev, subj];
    });
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (!preferredSubjects.includes(trimmed) && preferredSubjects.length < 12) {
      setPreferredSubjects((prev) => [...prev, trimmed]);
    }
    setCustomSubject('');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setAvatarMessage('');
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      setAvatarMessage('Profile picture uploaded successfully.');
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Unable to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      await updateProfile({
        fullName,
        institution,
        course,
        semesterOrYear,
        bio,
        preferredProgram,
        preferredSubjects,
      });
      setSaveSuccess('Your profile and notification preferences have been saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Student Dashboard</span>
          </button>
          <h1 className="text-3xl font-display font-bold text-[#0F2442]">My Academic Profile</h1>
          <p className="text-sm text-slate-600">
            Manage your personal information, academic track, profile photo, notification
            preferences, and submitted community content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/study-hub')}
            className="px-4 py-2 text-xs font-semibold text-[#0F2442] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Explore Study Hub
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Avatar & Account Summary */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col items-center text-center space-y-3">
              {user.avatarUrl ? (
                <SafeImage
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="h-24 w-24 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div
                  className="h-24 w-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0F2442]"
                  aria-label={`${user.fullName} avatar placeholder`}
                >
                  <UserIcon className="h-10 w-10 text-teal-700" />
                </div>
              )}

              <div>
                <h2 className="font-display font-bold text-lg text-[#0F2442]">{user.fullName}</h2>
                <p className="text-xs font-medium text-teal-700">
                  {user.course} · {user.semesterOrYear}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{user.institution}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <label
                htmlFor="profile-avatar-upload"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="h-4 w-4 text-teal-700" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}</span>
              </label>
              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                className="sr-only"
              />
              <p className="text-[11px] text-slate-500 text-center">
                Accepted formats: JPG, PNG, or WebP (max 8 MB).
              </p>

              {avatarError && (
                <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {avatarError}
                </div>
              )}
              {avatarMessage && (
                <div className="p-2.5 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{avatarMessage}</span>
                </div>
              )}
            </div>

            <dl className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-[#0F2442] truncate">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Account Role</dt>
                <dd className="font-medium text-[#0F2442] capitalize">{user.role}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Alert Category</dt>
                <dd className="font-medium text-teal-700">{user.preferredProgram || 'All'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Joined</dt>
                <dd className="font-mono text-slate-600 tabular-nums">
                  {user.createdAt.slice(0, 10)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Submitted Content Quick Summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display font-bold text-base text-[#0F2442]">
              Submitted Content &amp; Activity
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-lg font-bold text-[#0F2442] tabular-nums">{voices.length}</div>
                <div className="text-[11px] text-slate-500">Voices</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-lg font-bold text-[#0F2442] tabular-nums">
                  {registrations.length}
                </div>
                <div className="text-[11px] text-slate-500">Events</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-lg font-bold text-[#0F2442] tabular-nums">
                  {certificates.length}
                </div>
                <div className="text-[11px] text-slate-500">Certificates</div>
              </div>
            </div>
          </section>
        </aside>

        {/* Right Column: Edit Profile Form & Submitted Content Links */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-display font-bold text-lg text-[#0F2442]">
                Personal &amp; Academic Information
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Keep your institution, course, and Study Hub alert preferences up to date.
              </p>
            </div>

            {saveError && (
              <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="p-3 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="profile-fullname"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="profile-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-email"
                    className="block text-xs font-semibold text-slate-500 mb-1"
                  >
                    Registered Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-institution"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pharmacy Institution / College
                </label>
                <input
                  id="profile-institution"
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="profile-course"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Course / Academic Role
                  </label>
                  <select
                    id="profile-course"
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
                  <label
                    htmlFor="profile-semester"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Semester / Specialization / Year
                  </label>
                  <input
                    id="profile-semester"
                    type="text"
                    required
                    value={semesterOrYear}
                    onChange={(e) => setSemesterOrYear(e.target.value)}
                    placeholder="e.g. Semester 6 or Pharmaceutics Year 1"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-bio"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Short Academic Bio (optional)
                </label>
                <textarea
                  id="profile-bio"
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your academic interests, favorite pharmacy subjects, or campus coordinator experience..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Notification & Study Category Preferences */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-[#0F2442]">
                  <Bell className="h-4 w-4 text-teal-700" />
                  <h3 className="font-display font-bold text-sm">
                    Study Hub &amp; Notification Preferences
                  </h3>
                </div>

                <div>
                  <label
                    htmlFor="profile-preferred-program"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Preferred Program for New Material Alerts
                  </label>
                  <select
                    id="profile-preferred-program"
                    value={preferredProgram}
                    onChange={(e) => setPreferredProgram(e.target.value as ProgramType | 'All')}
                    className="w-full sm:w-64 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
                  >
                    <option value="All">All Programs (B.Pharm &amp; M.Pharm)</option>
                    <option value="B.Pharm">B.Pharm Resources Only</option>
                    <option value="M.Pharm">M.Pharm Resources Only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    Preferred Subjects (up to 12)
                  </span>
                  {preferredSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {preferredSubjects.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleToggleSubject(sub)}
                          aria-label={`Remove ${sub}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200 rounded-md hover:bg-teal-100 cursor-pointer"
                        >
                          <span>{sub}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}

                  {curriculumUnits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(
                        new Set(curriculumUnits.flatMap((u) => u.subjects.map((s) => s.name)))
                      )
                        .filter((s) => !preferredSubjects.includes(s))
                        .slice(0, 8)
                        .map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => handleToggleSubject(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:border-teal-600 hover:text-teal-700 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>{sub}</span>
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 max-w-md">
                    <label htmlFor="profile-custom-subject" className="sr-only">
                      Add custom subject interest
                    </label>
                    <input
                      id="profile-custom-subject"
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSubject();
                        }
                      }}
                      placeholder="Add another subject..."
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSubject}
                      className="px-3 py-1.5 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Saving Profile...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* Submitted Content & Links */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#0F2442]">
                <MessageSquareQuote className="h-4 w-4 text-teal-700" />
                <h2 className="font-display font-bold text-lg">My Submitted Content</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/voices')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                <span>Open Voices of RxOrbit</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            {activityLoading ? (
              <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            ) : voices.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  You have not submitted a story to Voices of RxOrbit yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/voices')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Share Your Story
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {voices.map((v) => (
                  <div key={v.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-500">{v.experienceType}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold capitalize ${
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
                    <button
                      type="button"
                      onClick={() => onNavigate('/voices')}
                      className="text-xs font-semibold text-teal-700 hover:underline shrink-0 cursor-pointer"
                    >
                      View in Voices
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Links to Registrations & Certificates */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F2442] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-teal-700" />
                    <span>Event Registrations ({registrations.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/events')}
                    className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    Events Page
                  </button>
                </div>
                {registrations.slice(0, 2).map((r) => (
                  <div key={r.id} className="text-xs text-slate-600 truncate">
                    {r.eventTitle} · <span className="font-mono">{r.registrationCode}</span>
                  </div>
                ))}
                {registrations.length === 0 && (
                  <p className="text-xs text-slate-500">No upcoming event registrations yet.</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F2442] flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-teal-700" />
                    <span>Issued Certificates ({certificates.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/verify')}
                    className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    Verify Portal
                  </button>
                </div>
                {certificates.slice(0, 2).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 truncate">{c.eventName}</span>
                    <a
                      href={`/api/certificates/${encodeURIComponent(c.certificateCode)}/pdf`}
                      className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline shrink-0"
                    >
                      <Download className="h-3 w-3" />
                      <span>PDF</span>
                    </a>
                  </div>
                ))}
                {certificates.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Certificates issued to {user.email} appear here.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
