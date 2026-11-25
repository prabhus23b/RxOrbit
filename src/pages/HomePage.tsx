import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  Image as ImageIcon,
  Megaphone,
  Users,
} from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import type { RoutePath } from '../components/Navbar';
import type {
  Announcement,
  GalleryPhoto,
  ProgramType,
  RxEvent,
  SiteContent,
  TeamMember,
  VoiceEntry,
} from '../types';

interface HomePageProps {
  content: SiteContent;
  announcements: Announcement[];
  events: RxEvent[];
  photos: GalleryPhoto[];
  team: TeamMember[];
  voices: VoiceEntry[];
  onNavigate: (path: RoutePath) => void;
  onOpenStudyProgram: (program: ProgramType) => void;
}

export function HomePage({
  content,
  announcements,
  events,
  photos,
  team,
  voices,
  onNavigate,
  onOpenStudyProgram,
}: HomePageProps) {
  const upcomingEvents = events.filter((e) => e.status === 'upcoming').slice(0, 3);
  const featuredPhotos = photos.slice(0, 4);
  const featuredTeam = team.slice(0, 4);
  const featuredVoices = voices.slice(0, 3);

  return (
    <div className="pb-8">
      {/* Active Announcements Bar */}
      {announcements.length > 0 && (
        <div className="bg-[#0F2442] text-white border-b border-slate-800">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <Megaphone className="h-4 w-4 text-teal-400 shrink-0" />
              <span className="font-semibold text-teal-300 shrink-0">
                {announcements[0].category}:
              </span>
              <span className="truncate text-slate-100">{announcements[0].title}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate((announcements[0].linkPath as RoutePath) || '/events')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View details</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-20">
        {/* Hero Section */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5 py-2">
              <p className="text-sm font-semibold tracking-wide text-teal-700">
                {content.heroTagline}
              </p>
              <h1
                className="font-display font-bold text-[#0F2442] leading-[1.12] tracking-tight"
                style={{ fontSize: 'clamp(2.15rem, 3.6vw, 3.25rem)', textWrap: 'balance' }}
              >
                {content.heroTitle}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {content.heroSubtitle}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Join RxOrbit</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/study-hub')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#0F2442] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 text-teal-700" />
                  <span>Explore Study Hub</span>
                </button>
              </div>
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-sm text-slate-600">
                <span>B.Pharm Semesters 1–8</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>M.Pharm Specializations</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>Verified Event Certificates</span>
              </div>
            </div>

          <div className="lg:col-span-6 flex items-stretch">
            <div className="w-full rounded-xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  Community Architecture
                </p>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-[#0F2442]">
                  Academic Resources, Events &amp; Verification
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  RxOrbit brings together pharmacy students, educators, and student coordinators on
                  a single academic platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => onOpenStudyProgram('B.Pharm')}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-teal-600 bg-slate-50/60 transition-colors cursor-pointer space-y-1"
                >
                  <div className="text-xs font-semibold text-teal-700">Undergraduate</div>
                  <div className="font-display font-bold text-sm text-[#0F2442]">
                    B.Pharm Study Hub
                  </div>
                  <p className="text-xs text-slate-600">Semesters 1–8 subject library</p>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenStudyProgram('M.Pharm')}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-teal-600 bg-slate-50/60 transition-colors cursor-pointer space-y-1"
                >
                  <div className="text-xs font-semibold text-teal-700">Postgraduate</div>
                  <div className="font-display font-bold text-sm text-[#0F2442]">
                    M.Pharm Study Hub
                  </div>
                  <p className="text-xs text-slate-600">Specialization-wise resources</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/events')}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-teal-600 bg-slate-50/60 transition-colors cursor-pointer space-y-1"
                >
                  <div className="text-xs font-semibold text-teal-700">Programs</div>
                  <div className="font-display font-bold text-sm text-[#0F2442]">
                    Events &amp; Workshops
                  </div>
                  <p className="text-xs text-slate-600">Webinars, seminars &amp; registration</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/verify')}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-teal-600 bg-slate-50/60 transition-colors cursor-pointer space-y-1"
                >
                  <div className="text-xs font-semibold text-teal-700">Credentials</div>
                  <div className="font-display font-bold text-sm text-[#0F2442]">
                    Certificate Registry
                  </div>
                  <p className="text-xs text-slate-600">Verify official PDF certificates</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Study Hub Introduction */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Study Hub
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              Structured Academic Resources for Pharmacy Degrees
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Browse study notes, reference PDFs, previous university question papers, and important
              exam questions organized by syllabus.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/study-hub')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open full Study Hub</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-teal-700">Undergraduate Curriculum</div>
              <h3 className="text-xl font-display font-bold text-[#0F2442]">
                B.Pharmacy (Semesters 1 – 8)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Organized semester-by-semester across Semesters 1–8 with subjects, notes, question
                papers, and reference PDFs configured and published by RxOrbit administrators.
              </p>
              <div className="text-xs text-slate-500 pt-1">
                Study Notes · PDF Materials · Previous Question Papers · Important Questions
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onOpenStudyProgram('B.Pharm')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <span>Browse B.Pharm Materials</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-teal-700">Postgraduate Specializations</div>
              <h3 className="text-xl font-display font-bold text-[#0F2442]">
                M.Pharmacy Specializations
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Organized by postgraduate specialization and subject as configured and published by
                RxOrbit administrators.
              </p>
              <div className="text-xs text-slate-500 pt-1">
                Academic Notes · Reference PDFs · Study Materials
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onOpenStudyProgram('M.Pharm')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <span>Browse M.Pharm Materials</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Academic Calendar
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              Upcoming Events &amp; Workshops
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/events')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>All events &amp; registration</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600 text-sm">
            No upcoming events at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingEvents.map((ev) => (
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
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-teal-700">{ev.eventType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{ev.eventDate}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-[#0F2442] leading-snug">
                      {ev.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{ev.description}</p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 truncate">{ev.venueOrMode}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/events')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F2442] hover:text-teal-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Register</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Gallery Highlights */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Gallery
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              Gallery Highlights
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/gallery')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Explore full gallery</span>
            <ImageIcon className="h-4 w-4" />
          </button>
        </div>

        {featuredPhotos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600 text-sm">
            Gallery updates coming soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onNavigate('/gallery')}
                className="group text-left bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <SafeImage
                    src={photo.imageUrl}
                    alt={photo.caption}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="font-medium text-teal-700">{photo.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{photo.eventDate}</span>
                  </div>
                  <p className="text-sm font-medium text-[#0F2442] line-clamp-2">{photo.caption}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Featured Team */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Our Team
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              Educators &amp; Student Coordinators
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/team')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Meet the full team</span>
            <Users className="h-4 w-4" />
          </button>
        </div>

        {featuredTeam.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600 text-sm">
            Our team information will be updated soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredTeam.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                    <SafeImage
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-base text-[#0F2442] truncate">
                      {member.fullName}
                    </h3>
                    <p className="text-xs font-medium text-teal-700 truncate">{member.designation}</p>
                    <p className="text-xs text-slate-500">{member.section}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Voices of RxOrbit Highlights */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Voices of RxOrbit
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              Community Member Reflections
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/voices')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Read all Voices</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {featuredVoices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600 text-sm">
            Member experiences will appear here soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredVoices.map((voice) => (
              <blockquote
                key={voice.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="text-xs font-medium text-teal-700">{voice.experienceType}</div>
                  <p className="text-base text-[#0F2442] font-medium leading-relaxed">
                    “{voice.quote}”
                  </p>
                </div>
                <footer className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  {voice.allowPhoto && voice.photoUrl ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                      <SafeImage
                        src={voice.photoUrl}
                        alt={voice.authorName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0F2442] truncate">
                      {voice.authorName}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {voice.courseDetails} · {voice.institution}
                    </div>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </section>

      {/* About RxOrbit & Verification */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              About RxOrbit
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F2442]">
              About RxOrbit
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              {content.aboutSummary.trim()
                ? content.aboutSummary
                : 'Verified organization details will appear here once supplied by the website owner.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('/about')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                About RxOrbit
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/verify')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Award className="h-4 w-4 text-teal-700" />
                <span>Verify Certificate</span>
              </button>
            </div>
          </div>
          {(content.vision.trim() || content.contactEmail.trim()) && (
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-8 space-y-4">
              {content.vision.trim() && (
                <div>
                  <div className="text-xs font-semibold text-slate-500">Our Vision</div>
                  <p className="text-sm text-[#0F2442] mt-1 leading-relaxed">{content.vision}</p>
                </div>
              )}
              {content.contactEmail.trim() && (
                <div>
                  <div className="text-xs font-semibold text-slate-500">Academic Contact</div>
                  <p className="text-sm text-teal-700 font-medium mt-1">{content.contactEmail}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
