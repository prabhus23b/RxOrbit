import { Mail, MapPin, Phone } from 'lucide-react';
import type { SiteContent } from '../types';
import type { RoutePath } from './Navbar';

interface FooterProps {
  content: SiteContent;
  onNavigate: (path: RoutePath) => void;
}

export function Footer({ content, onNavigate }: FooterProps) {
  const heroTagline =
    typeof content?.heroTagline === 'string' && content.heroTagline
      ? content.heroTagline
      : 'Connect · Discover · Advance';
  const contactEmail = typeof content?.contactEmail === 'string' ? content.contactEmail.trim() : '';
  const contactPhone = typeof content?.contactPhone === 'string' ? content.contactPhone.trim() : '';
  const contactAddress =
    typeof content?.contactAddress === 'string' ? content.contactAddress.trim() : '';
  const linkedinUrl = typeof content?.linkedinUrl === 'string' ? content.linkedinUrl.trim() : '';
  const instagramUrl = typeof content?.instagramUrl === 'string' ? content.instagramUrl.trim() : '';
  const youtubeUrl = typeof content?.youtubeUrl === 'string' ? content.youtubeUrl.trim() : '';

  return (
    <footer className="bg-[#0F2442] text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-3">
          <div className="inline-flex items-center bg-white rounded-xl px-3.5 py-2">
            <img
              src="/assets/aistudio/RxOrbit_Pharmacy_Education_Logo__1__9dc97750.png"
              alt="RxOrbit — Connect · Discover · Advance"
              className="h-14 w-auto object-contain"
            />
          </div>
          <p className="text-sm font-medium text-teal-300">{heroTagline}</p>
          <p className="text-sm text-slate-300 leading-relaxed max-w-xs">
            A pharmacy student educational community connecting B.Pharm and M.Pharm learners,
            educators, and student coordinators.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Academic Community</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/study-hub')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Study Hub Overview
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/study-hub/bpharm')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                B.Pharm Semesters 1–8
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/study-hub/mpharm')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                M.Pharm Specializations
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/events')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Events &amp; Workshops
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/gallery')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Community Gallery
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/voices')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Voices of RxOrbit
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Organization &amp; Portal</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/team')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Our Team
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/about')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                About Us
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/verify')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Verify a Certificate
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Member Login
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Contact &amp; Connect</h3>
          {!contactEmail &&
          !contactPhone &&
          !contactAddress &&
          !linkedinUrl &&
          !instagramUrl &&
          !youtubeUrl ? (
            <p className="text-xs text-slate-400">Contact details will be updated soon.</p>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                {contactEmail && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                    <a
                      href={`mailto:${contactEmail}`}
                      className="hover:text-white transition-colors break-all"
                    >
                      {contactEmail}
                    </a>
                  </div>
                )}
                {contactPhone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                    <span className="tabular-nums">{contactPhone}</span>
                  </div>
                )}
                {contactAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>{contactAddress}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 pt-2 text-xs font-medium">
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-300 hover:text-white transition-colors"
                  >
                    LinkedIn
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-300 hover:text-white transition-colors"
                  >
                    Instagram
                  </a>
                )}
                {youtubeUrl && (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-300 hover:text-white transition-colors"
                  >
                    YouTube
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800/80 py-5 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} RxOrbit Pharmacy Student Educational Community.</span>
          <span>Connect · Discover · Advance</span>
        </div>
      </div>
    </footer>
  );
}
