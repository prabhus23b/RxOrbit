import React, { useState } from 'react';
import { CheckCircle2, MessageSquareQuote, PenLine } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { RoutePath } from '../components/Navbar';
import type { VoiceEntry } from '../types';

interface VoicesPageProps {
  voices: VoiceEntry[];
  loading: boolean;
  onNavigate: (path: RoutePath) => void;
}

export function VoicesPage({ voices, loading, onNavigate }: VoicesPageProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [experienceType, setExperienceType] = useState('Student Experience');
  const [courseDetails, setCourseDetails] = useState(
    user ? `${user.course} · ${user.semesterOrYear}` : ''
  );
  const [quote, setQuote] = useState('');
  const [story, setStory] = useState('');
  const [allowPhoto, setAllowPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('experienceType', experienceType);
      fd.append('courseDetails', courseDetails);
      fd.append('quote', quote);
      fd.append('story', story);
      fd.append('allowPhoto', String(allowPhoto));
      if (allowPhoto && photoFile) {
        fd.append('photo', photoFile);
      }
      await apiRequest('/api/voices', {
        method: 'POST',
        body: fd,
      });
      setQuote('');
      setStory('');
      setPhotoFile(null);
      setAllowPhoto(false);
      setSubmittedNotice(true);
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit your experience.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="border-b border-slate-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Community Journal
          </p>
          <h1 className="text-3xl font-display font-bold text-[#0F2442]">
            Voices of RxOrbit
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Authentic academic reflections, workshop takeaways, and peer learning experiences
            shared by B.Pharm students, M.Pharm scholars, and coordinators across campuses.
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => {
              setCourseDetails(`${user.course} · ${user.semesterOrYear}`);
              setSubmittedNotice(false);
              setShowForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PenLine className="h-4 w-4" />
            <span>{showForm ? 'Close Submission Form' : 'Share Your Experience'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PenLine className="h-4 w-4" />
            <span>Sign in to Share Your Voice</span>
          </button>
        )}
      </div>

      {submittedNotice && (
        <div
          role="status"
          className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
          <div className="text-sm text-[#0F2442]">
            <span className="font-semibold">Experience submitted for review.</span> An RxOrbit
            administrator will review your reflection before publishing it to Voices of RxOrbit. You
            can track its approval status in your Student Dashboard.
          </div>
        </div>
      )}

      {showForm && user && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 max-w-3xl"
        >
          <div>
            <h2 className="font-display font-bold text-xl text-[#0F2442]">
              Submit to Voices of RxOrbit
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Posting as {user.fullName} ({user.institution}). Submissions are reviewed by
              administrators prior to public publication.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="voice-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Experience Category
              </label>
              <select
                id="voice-type"
                value={experienceType}
                onChange={(e) => setExperienceType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
              >
                <option value="Student Experience">Student Experience</option>
                <option value="Event Participant Experience">Event Participant Experience</option>
                <option value="Learning Experience">Learning Experience</option>
                <option value="Community Member Feedback">Community Member Feedback</option>
              </select>
            </div>
            <div>
              <label htmlFor="voice-course" className="block text-xs font-semibold text-slate-700 mb-1">
                Course &amp; Academic Details
              </label>
              <input
                id="voice-course"
                type="text"
                required
                value={courseDetails}
                onChange={(e) => setCourseDetails(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                placeholder="B.Pharm · Semester 6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="voice-quote" className="block text-xs font-semibold text-slate-700 mb-1">
              Key Takeaway / Highlight Quote
            </label>
            <input
              id="voice-quote"
              type="text"
              required
              minLength={15}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              placeholder="Summarize your main academic or community takeaway in 1–2 sentences"
            />
          </div>

          <div>
            <label htmlFor="voice-story" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Reflection
            </label>
            <textarea
              id="voice-story"
              required
              minLength={30}
              rows={4}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              placeholder="Describe how an RxOrbit event, study resource, or peer session helped your pharmacy learning..."
            />
          </div>

          <div className="space-y-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allowPhoto}
                onChange={(e) => setAllowPhoto(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>I grant permission to display my photograph alongside my submission</span>
            </label>
            {allowPhoto && (
              <div>
                <label htmlFor="voice-photo" className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Portrait Photo (JPG / PNG / WebP)
                </label>
                <input
                  id="voice-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#0F2442] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit for Admin Approval'}
            </button>
          </div>
        </form>
      )}

      {/* Editorial Voices Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : voices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <MessageSquareQuote className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-semibold text-lg text-[#0F2442]">
            Member experiences will appear here soon.
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {voices.map((v) => (
            <article
              key={v.id}
              className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-teal-700">{v.experienceType}</span>
                  <span className="font-mono tabular-nums">{v.createdAt.slice(0, 10)}</span>
                </div>
                <blockquote className="font-display font-semibold text-xl text-[#0F2442] leading-snug">
                  “{v.quote}”
                </blockquote>
                <p className="text-sm text-slate-600 leading-relaxed">{v.story}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-3.5">
                {v.allowPhoto && v.photoUrl ? (
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-200 shrink-0">
                    <SafeImage
                      src={v.photoUrl}
                      alt={v.authorName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-[#0F2442] shrink-0">
                    {v.authorName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#0F2442] truncate">{v.authorName}</div>
                  <div className="text-xs text-slate-600 truncate">{v.institution}</div>
                  <div className="text-xs text-slate-500 truncate">{v.courseDetails}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
