import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, MapPin, Search, Users, X } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { EVENT_TYPES, filterEvents } from '../lib/domain';
import type { EventRegistration, EventStatus, EventType, RxEvent } from '../types';

interface EventsPageProps {
  events: RxEvent[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export function EventsPage({ events, loading, onRefresh }: EventsPageProps) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EventType | 'All'>('All');
  const [query, setQuery] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<RxEvent | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('B.Pharm');
  const [semesterOrYear, setSemesterOrYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedReg, setConfirmedReg] = useState<EventRegistration | null>(null);

  const filtered = useMemo(
    () =>
      filterEvents(events, {
        status: statusFilter,
        eventType: typeFilter,
        query,
      }),
    [events, statusFilter, typeFilter, query]
  );

  const openRegistration = (ev: RxEvent) => {
    setSelectedEvent(ev);
    setConfirmedReg(null);
    setErrorMsg('');
    setFullName(user?.fullName || '');
    setEmail(user?.email || '');
    setInstitution(user?.institution || '');
    setCourse(user?.course || 'B.Pharm');
    setSemesterOrYear(user?.semesterOrYear || 'Semester 1');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ registration: EventRegistration }>(
        `/api/events/${selectedEvent.id}/register`,
        {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            email,
            institution,
            course,
            semesterOrYear,
          }),
        }
      );
      setConfirmedReg(res.registration);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Events &amp; Programs
        </p>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl font-display font-bold text-[#0F2442]">
              Webinars, Workshops, Conferences &amp; Competitions
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">
              Join interactive pharmacy education sessions, hands-on compounding workshops, and
              inter-collegiate academic competitions.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {([
              { id: 'all', label: 'All Events' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past Events' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#0F2442] shadow-sm'
                    : 'text-slate-600 hover:text-[#0F2442]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <label htmlFor="events-search" className="sr-only">
            Search events
          </label>
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="events-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by event title, topic, or mode..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>
        <div className="sm:w-60">
          <label htmlFor="event-type-select" className="sr-only">
            Filter by Event Type
          </label>
          <select
            id="event-type-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EventType | 'All')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
          >
            <option value="All">All Event Types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <Calendar className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-semibold text-lg text-[#0F2442]">
            {events.length === 0 || statusFilter === 'upcoming'
              ? 'No upcoming events at the moment.'
              : 'No events match this filter'}
          </h3>
          {events.length > 0 && (
            <p className="text-sm text-slate-500">
              Switch between Upcoming and Past events or clear your search query.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ev) => (
            <article
              key={ev.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                  <SafeImage
                    src={ev.posterUrl}
                    alt={ev.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-teal-700">{ev.eventType}</span>
                    <span
                      className={`font-medium ${
                        ev.status === 'upcoming' ? 'text-[#0F2442]' : 'text-slate-500'
                      }`}
                    >
                      {ev.status === 'upcoming' ? 'Upcoming · Open' : 'Completed'}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-lg text-[#0F2442] leading-snug">
                    {ev.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{ev.description}</p>
                  <div className="space-y-1.5 pt-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                      <span className="font-mono tabular-nums">{ev.eventDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                      <span>{ev.eventTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                      <span>{ev.venueOrMode}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {ev.registrationCount ?? 0} / {ev.maxSeats} registered
                  </span>
                </div>
                {ev.status === 'upcoming' ? (
                  <button
                    type="button"
                    onClick={() => openRegistration(ev)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Register Now
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Registration Closed</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Event Registration Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Register for ${selectedEvent.title}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-lg text-[#0F2442]">
                  Event Registration
                </h3>
                <p className="text-xs text-slate-500">{selectedEvent.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close registration modal"
                className="p-1.5 text-slate-500 hover:text-[#0F2442] rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {confirmedReg ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <CheckCircle2 className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-[#0F2442]">
                      Registration Confirmed
                    </div>
                    <p className="text-xs text-slate-600">
                      Your seat is reserved for {confirmedReg.eventTitle} on{' '}
                      {confirmedReg.eventDate}.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registration Code</span>
                    <span className="font-mono font-semibold text-[#0F2442]">
                      {confirmedReg.registrationCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Participant</span>
                    <span className="font-medium text-[#0F2442]">{confirmedReg.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Institution</span>
                    <span className="font-medium text-[#0F2442]">{confirmedReg.institution}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
                  >
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label htmlFor="ev-reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="ev-reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label htmlFor="ev-reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="ev-reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label htmlFor="ev-reg-inst" className="block text-xs font-semibold text-slate-700 mb-1">
                    Institution / College
                  </label>
                  <input
                    id="ev-reg-inst"
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    placeholder="Enter institution or college name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ev-reg-course" className="block text-xs font-semibold text-slate-700 mb-1">
                      Program / Role
                    </label>
                    <select
                      id="ev-reg-course"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
                    >
                      <option value="B.Pharm">B.Pharm</option>
                      <option value="M.Pharm">M.Pharm</option>
                      <option value="Educator">Educator</option>
                      <option value="Coordinator">Coordinator</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ev-reg-sem" className="block text-xs font-semibold text-slate-700 mb-1">
                      Semester / Year
                    </label>
                    <input
                      id="ev-reg-sem"
                      type="text"
                      required
                      value={semesterOrYear}
                      onChange={(e) => setSemesterOrYear(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      placeholder="Enter semester or year"
                    />
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#0F2442] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    {submitting ? 'Confirming...' : 'Confirm Registration'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
