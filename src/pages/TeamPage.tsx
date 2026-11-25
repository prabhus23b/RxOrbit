import { ExternalLink, Mail, Users } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { TEAM_SECTIONS } from '../lib/domain';
import type { TeamMember } from '../types';

interface TeamPageProps {
  members: TeamMember[];
  loading: boolean;
}

export function TeamPage({ members, loading }: TeamPageProps) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-12">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Our Team
        </p>
        <h1 className="text-3xl font-display font-bold text-[#0F2442]">
          Faculty Mentors, Leadership &amp; Student Coordinators
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
          Educators, academic leads, and student coordinators supporting the RxOrbit pharmacy
          community.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <Users className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-semibold text-lg text-[#0F2442]">
            Our team information will be updated soon.
          </h3>
        </div>
      ) : (
        <div className="space-y-12">
          {TEAM_SECTIONS.map((section) => {
            const list = members.filter((m) => m.section === section);
            if (list.length === 0) return null;
            return (
              <section key={section} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h2 className="font-display font-bold text-xl text-[#0F2442]">{section}</h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {list.length} {list.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {list.map((member) => (
                    <article
                      key={member.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                            <SafeImage
                              src={member.photoUrl}
                              alt={member.fullName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display font-bold text-lg text-[#0F2442] truncate">
                              {member.fullName}
                            </h3>
                            <p className="text-xs font-semibold text-teal-700">
                              {member.designation}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{member.bio}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center gap-4 text-xs font-medium">
                        {member.linkedinUrl && (
                          <a
                            href={member.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0F2442] hover:text-teal-700 transition-colors"
                          >
                            <span>LinkedIn</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {member.email && (
                          <a
                            href={`mailto:${member.email}`}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-teal-700 transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>Email</span>
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
