import {
  Award,
  BookOpen,
  Calendar,
  Check,
  Compass,
  Eye,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { RoutePath } from '../lib/domain';
import type { SiteContent } from '../types';

interface AboutPageProps {
  content: SiteContent;
  onNavigate: (path: RoutePath) => void;
}

const DEFAULT_ABOUT_PARAGRAPHS = [
  'RxOrbit is a pharmacy student community designed to bring together B.Pharm and M.Pharm students, educators, and individuals interested in pharmaceutical education.',
  'We aim to create a shared platform where students can access academic resources, discover educational opportunities, participate in events, and connect with fellow members of the pharmacy community.',
];

const DEFAULT_VISION_CONTENT =
  'To build an inclusive and knowledge-driven pharmacy community where students can connect, exchange ideas, explore opportunities, and grow academically and professionally.';

const DEFAULT_MISSION_CONTENT =
  'Our mission is to bridge the gap between pharmacy students and educational opportunities by providing an accessible platform for academic resources, interactive learning experiences.';

const WHY_RXORBIT_INTRO = [
  'Pharmacy education is not limited to textbooks, examinations, and classrooms. It also involves sharing knowledge, exploring new developments, developing skills, and connecting with people who share similar interests.',
  'RxOrbit aims to bring these opportunities together in one place.',
];

const WHY_RXORBIT_POINTS = [
  {
    number: '01',
    title: 'Academic Resources',
    description: 'Access organized B.Pharm and M.Pharm study resources.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'Educational Events',
    description: 'Discover webinars, workshops, seminars, and competitions.',
    icon: Calendar,
  },
  {
    number: '03',
    title: 'Knowledge Sharing',
    description: 'Share experiences and learn from fellow students.',
    icon: MessageSquare,
  },
  {
    number: '04',
    title: 'Community Connections',
    description: 'Connect with educators and members of the pharmacy community.',
    icon: Users,
  },
  {
    number: '05',
    title: 'Student Development',
    description: 'Explore academic and professional opportunities.',
    icon: GraduationCap,
  },
];

const WHY_RXORBIT_CLOSING =
  'RxOrbit is more than a website; it is a space for pharmacy students to connect, discover, and advance.';

const DEFAULT_OBJECTIVES = [
  {
    title: 'Academic Accessibility',
    description: 'Make pharmacy learning resources easier to discover and access.',
    icon: BookOpen,
  },
  {
    title: 'Knowledge Sharing',
    description: 'Encourage students to exchange academic knowledge and experiences.',
    icon: MessageSquare,
  },
  {
    title: 'Educational Engagement',
    description:
      'Provide opportunities to participate in webinars, workshops, seminars, and competitions.',
    icon: Calendar,
  },
  {
    title: 'Community Building',
    description:
      'Connect B.Pharm and M.Pharm students through a shared educational platform.',
    icon: Users,
  },
  {
    title: 'Student Development',
    description:
      'Encourage continuous learning, communication, collaboration, and professional growth.',
    icon: TrendingUp,
  },
  {
    title: 'Opportunity Awareness',
    description:
      'Help students discover relevant educational activities and opportunities in the pharmaceutical field.',
    icon: Compass,
  },
];

const COMMITMENT_INTRO =
  'At RxOrbit, we believe that accessible knowledge and collaborative learning play an important role in shaping the future of pharmacy.';

const COMMITMENT_ITEMS = [
  'Supporting continuous academic learning.',
  'Promoting knowledge sharing among pharmacy students.',
  'Encouraging participation in educational activities.',
  'Providing an organized platform for academic resources.',
  'Creating an inclusive and respectful student community.',
  'Encouraging curiosity, collaboration, and lifelong learning.',
];

const COMMITMENT_CLOSING =
  'Our goal is to contribute positively to the educational journey of pharmacy students.';

export function AboutPage({ content, onNavigate }: AboutPageProps) {
  const objectives = typeof content?.objectives === 'string' ? content.objectives : '';
  const aboutSummary = typeof content?.aboutSummary === 'string' ? content.aboutSummary : '';
  const vision = typeof content?.vision === 'string' ? content.vision : '';
  const mission = typeof content?.mission === 'string' ? content.mission : '';
  const whyRxOrbit = typeof content?.whyRxOrbit === 'string' ? content.whyRxOrbit : '';
  const commitment = typeof content?.commitment === 'string' ? content.commitment : '';
  const contactEmail = typeof content?.contactEmail === 'string' ? content.contactEmail : '';
  const contactPhone = typeof content?.contactPhone === 'string' ? content.contactPhone : '';
  const contactAddress = typeof content?.contactAddress === 'string' ? content.contactAddress : '';
  const linkedinUrl = typeof content?.linkedinUrl === 'string' ? content.linkedinUrl : '';
  const instagramUrl = typeof content?.instagramUrl === 'string' ? content.instagramUrl : '';
  const youtubeUrl = typeof content?.youtubeUrl === 'string' ? content.youtubeUrl : '';

  const objectiveLines = objectives
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const aboutParagraphs = aboutSummary.trim()
    ? aboutSummary
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : DEFAULT_ABOUT_PARAGRAPHS;

  const visionText = vision.trim() || DEFAULT_VISION_CONTENT;
  const missionText = mission.trim() || DEFAULT_MISSION_CONTENT;
  const hasCustomObjectives = objectiveLines.length > 0;
  const hasCustomWhy = Boolean(whyRxOrbit.trim());
  const hasCustomCommitment = Boolean(commitment.trim());
  const hasContactDetails = Boolean(
    contactEmail.trim() || contactPhone.trim() || contactAddress.trim()
  );
  const hasSocialLinks = Boolean(
    linkedinUrl.trim() || instagramUrl.trim() || youtubeUrl.trim()
  );

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* 1. About RxOrbit */}
      <section className="space-y-4 border-b border-slate-200 pb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          RxOrbit · Connect • Discover • Advance
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#0B2D59]">
          About RxOrbit
        </h1>
        <div className="space-y-4">
          {aboutParagraphs.map((paragraph, index) => (
            <p key={index} className="text-slate-600 text-base leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0B2D59] hover:bg-[#092347] rounded-lg transition-colors cursor-pointer"
          >
            Join RxOrbit Community
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/study-hub')}
            className="px-5 py-2.5 text-sm font-semibold text-[#0B2D59] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            Explore Study Hub
          </button>
        </div>
      </section>

      {/* 2. Our Vision & 3. Our Mission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#00BFA6]/10 border border-[#00BFA6]/25 flex items-center justify-center text-teal-700 shrink-0">
              <Eye className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="font-display font-bold text-xl text-[#0B2D59]">Our Vision</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{visionText}</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#0B2D59]/5 border border-[#0B2D59]/15 flex items-center justify-center text-[#0B2D59] shrink-0">
              <Target className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="font-display font-bold text-xl text-[#0B2D59]">Our Mission</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{missionText}</p>
        </section>
      </div>

      {/* 4. Why RxOrbit? (Five visually balanced content blocks) */}
      <section className="space-y-6 border-t border-slate-200 pt-10">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Community Purpose
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B2D59]">
            Why RxOrbit?
          </h2>
          {hasCustomWhy ? (
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {content.whyRxOrbit}
            </p>
          ) : (
            <div className="space-y-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              {WHY_RXORBIT_INTRO.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          {WHY_RXORBIT_POINTS.map((point, index) => {
            const Icon = point.icon;
            const spanClass = index < 3 ? 'lg:col-span-2' : 'lg:col-span-3';
            return (
              <div
                key={point.title}
                className={`${spanClass} bg-white border border-slate-200 rounded-xl p-6 space-y-3`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#00BFA6]/10 border border-[#00BFA6]/25 flex items-center justify-center text-teal-700 shrink-0">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                    {point.number}
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg text-[#0B2D59]">{point.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{point.description}</p>
              </div>
            );
          })}
        </div>

        <blockquote className="border-l-4 border-[#00BFA6] bg-slate-50 px-5 py-4 rounded-r-lg">
          <p className="text-sm sm:text-base font-medium text-[#0B2D59] leading-relaxed">
            “{WHY_RXORBIT_CLOSING}”
          </p>
        </blockquote>
      </section>

      {/* 5. Our Objectives (Six-item grid with subtle icons) */}
      <section className="space-y-6 border-t border-slate-200 pt-10">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Academic Direction
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B2D59]">
            Our Objectives
          </h2>
        </div>

        {hasCustomObjectives ? (
          <ul className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {objectiveLines.map((line, i) => (
              <li
                key={i}
                className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEFAULT_OBJECTIVES.map((obj) => {
              const Icon = obj.icon;
              return (
                <div
                  key={obj.title}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex items-start gap-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#0B2D59]/5 border border-[#0B2D59]/10 flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="font-display font-bold text-base text-[#0B2D59]">
                      {obj.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{obj.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Our Commitment to Pharmacy Education (Full-width editorial section) */}
      <section className="border-t border-slate-200 pt-10">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="h-1 bg-[#0B2D59]" aria-hidden="true" />
          <div className="p-6 sm:p-10 space-y-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
                <Award className="h-4 w-4" aria-hidden="true" />
                <span>Editorial Statement</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B2D59]">
                Our Commitment to Pharmacy Education
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {hasCustomCommitment ? content.commitment : COMMITMENT_INTRO}
              </p>
            </div>

            {!hasCustomCommitment && (
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B2D59]">
                  Our commitments
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {COMMITMENT_ITEMS.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm sm:text-base text-slate-700 leading-relaxed"
                    >
                      <span
                        className="mt-1 h-5 w-5 rounded-full bg-[#00BFA6]/15 text-teal-700 flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-200 pt-5">
              <p className="text-base sm:text-lg font-display font-semibold text-[#0B2D59]">
                “{COMMITMENT_CLOSING}”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Sections & Contact Information */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-[#0F2442]">
            Community Information &amp; Contact
          </h2>
          {hasContactDetails ? (
            <div className="space-y-2.5 text-sm text-slate-600">
              {contactEmail.trim() && (
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-teal-700 shrink-0" />
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-medium text-[#0F2442] hover:text-teal-700"
                  >
                    {contactEmail}
                  </a>
                </div>
              )}
              {contactPhone.trim() && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-teal-700 shrink-0" />
                  <span className="tabular-nums">{contactPhone}</span>
                </div>
              )}
              {contactAddress.trim() && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>{contactAddress}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">
              Official contact details will appear here once provided by the RxOrbit website owner.
            </p>
          )}

          {hasSocialLinks && (
            <div className="pt-2 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Connect With RxOrbit
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                {linkedinUrl.trim() && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg border border-slate-200 text-[#0F2442] hover:bg-slate-50"
                  >
                    LinkedIn
                  </a>
                )}
                {instagramUrl.trim() && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg border border-slate-200 text-[#0F2442] hover:bg-slate-50"
                  >
                    Instagram
                  </a>
                )}
                {youtubeUrl.trim() && (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg border border-slate-200 text-[#0F2442] hover:bg-slate-50"
                  >
                    YouTube
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="md:border-l md:border-slate-200 md:pl-8 space-y-4">
          <h3 className="font-display font-bold text-lg text-[#0F2442]">
            Explore Community Modules
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('/study-hub/bpharm')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-teal-600 text-left space-y-1 cursor-pointer"
            >
              <div className="font-semibold text-[#0F2442] flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-teal-700" />
                <span>B.Pharm Study Hub</span>
              </div>
              <p className="text-slate-500">Semesters 1–8 resources</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/study-hub/mpharm')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-teal-600 text-left space-y-1 cursor-pointer"
            >
              <div className="font-semibold text-[#0F2442] flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-teal-700" />
                <span>M.Pharm Study Hub</span>
              </div>
              <p className="text-slate-500">Postgraduate specializations</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/events')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-teal-600 text-left space-y-1 cursor-pointer"
            >
              <div className="font-semibold text-[#0F2442] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-teal-700" />
                <span>Events &amp; Workshops</span>
              </div>
              <p className="text-slate-500">Academic programs &amp; registration</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/team')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-teal-600 text-left space-y-1 cursor-pointer"
            >
              <div className="font-semibold text-[#0F2442] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-teal-700" />
                <span>Our Team</span>
              </div>
              <p className="text-slate-500">Mentors &amp; student coordinators</p>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
