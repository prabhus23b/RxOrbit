import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  Megaphone,
  Menu,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { parseLinkPath, type RoutePath } from '../lib/domain';
import type { NotificationCategory } from '../types';

export type { RoutePath };

interface NavbarProps {
  currentPath: RoutePath;
  onNavigate: (path: RoutePath, search?: string) => void;
}

const NAV_LINKS: Array<{ label: string; path: RoutePath }> = [
  { label: 'Home', path: '/' },
  { label: 'Study Hub', path: '/study-hub' },
  { label: 'B.Pharm', path: '/study-hub/bpharm' },
  { label: 'M.Pharm', path: '/study-hub/mpharm' },
  { label: 'Events', path: '/events' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Our Team', path: '/team' },
  { label: 'Voices of RxOrbit', path: '/voices' },
  { label: 'About Us', path: '/about' },
];

function splitLinkPath(raw: string): { path: RoutePath; search: string } {
  return parseLinkPath(raw);
}

function categoryIcon(category: NotificationCategory) {
  if (category === 'event') return <Calendar className="h-3.5 w-3.5 text-teal-700 shrink-0" />;
  if (category === 'material') return <BookOpen className="h-3.5 w-3.5 text-[#0F2442] shrink-0" />;
  return <Megaphone className="h-3.5 w-3.5 text-amber-700 shrink-0" />;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const {
    user,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    logout,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [notifOpen]);

  const go = (path: RoutePath, search = '') => {
    setMobileOpen(false);
    setNotifOpen(false);
    onNavigate(path, search);
  };

  const handleOpenNotification = (id: number, linkPath: string, isRead: boolean) => {
    if (!isRead) {
      void markNotificationRead(id);
    }
    const target = splitLinkPath(linkPath);
    go(target.path, target.search);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Official RxOrbit Brand Logo */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go('/');
          }}
          className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 rounded"
        >
          <img
            src="/assets/aistudio/RxOrbit_Pharmacy_Education_Logo__1__9dc97750.png"
            alt="RxOrbit"
            className="h-12 w-auto object-contain shrink-0"
          />
        </a>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-2.5 xl:gap-4"
        >
          {NAV_LINKS.map((item) => {
            const active = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.path);
                }}
                className={`text-xs xl:text-[13px] font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'text-[#0F2442] border-teal-600'
                    : 'text-slate-600 border-transparent hover:text-[#0F2442] hover:border-slate-300'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Account & Notifications */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {/* In-App Notification Bell */}
              <div className="relative" ref={notifContainerRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  aria-label={
                    unreadCount > 0
                      ? `Notifications (${unreadCount} unread)`
                      : 'Notifications'
                  }
                  aria-expanded={notifOpen}
                  className={`relative p-2 rounded-lg border transition-colors cursor-pointer ${
                    notifOpen
                      ? 'bg-slate-100 border-slate-300 text-[#0F2442]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#0F2442]'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-700 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    role="dialog"
                    aria-label="Recent notifications"
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-[#0F2442]">
                          Notifications
                        </span>
                        <span className="text-xs font-semibold text-teal-700 tabular-nums">
                          {unreadCount} unread
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

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No academic alerts right now.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleOpenNotification(n.id, n.linkPath, n.isRead)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer ${
                              n.isRead ? 'bg-white' : 'bg-teal-50/40'
                            }`}
                          >
                            <div className="mt-0.5">{categoryIcon(n.category)}</div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                  {n.category}
                                </span>
                                {!n.isRead && (
                                  <span className="text-[10px] font-bold text-teal-700">
                                    Unread
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-[#0F2442] line-clamp-1">
                                {n.title}
                              </p>
                              <p className="text-xs text-slate-600 line-clamp-2">{n.message}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => go('/dashboard')}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        View all in Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => go('/profile')}
                        className="text-xs font-medium text-slate-600 hover:text-[#0F2442] cursor-pointer"
                      >
                        Alert Preferences
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => go('/admin')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    currentPath === '/admin'
                      ? 'bg-[#0F2442] text-white border-[#0F2442]'
                      : 'bg-white text-[#0F2442] border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  <span>Admin</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => go('/profile')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentPath === '/profile'
                    ? 'bg-teal-50 text-teal-800 border-teal-300'
                    : 'bg-white text-[#0F2442] border-slate-300 hover:bg-slate-50'
                }`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <UserIcon className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                )}
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => go('/dashboard')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentPath === '/dashboard'
                    ? 'bg-[#0F2442] text-white'
                    : 'bg-teal-700 hover:bg-teal-800 text-white'
                }`}
              >
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  go('/');
                }}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-[#0F2442] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  go('/login');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  currentPath === '/login'
                    ? 'bg-slate-100 text-[#0F2442] border-slate-300'
                    : 'bg-white text-[#0F2442] border-slate-300 hover:bg-slate-50'
                }`}
              >
                Login
              </a>
              <a
                href="/register"
                onClick={(e) => {
                  e.preventDefault();
                  go('/register');
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentPath === '/register'
                    ? 'bg-teal-800'
                    : 'bg-[#0F2442] hover:bg-slate-800'
                }`}
              >
                Register
              </a>
            </div>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden flex items-center gap-1.5">
          {user && (
            <button
              type="button"
              onClick={() => go('/dashboard')}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative p-2 text-[#0F2442] hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-teal-700 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="p-2.5 text-[#0F2442] hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-3 mt-2 border-t border-slate-200 flex flex-col gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => go('/dashboard')}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                >
                  Student Dashboard ({unreadCount} unread alerts)
                </button>
                <button
                  type="button"
                  onClick={() => go('/profile')}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-[#0F2442] border border-slate-300 rounded-lg cursor-pointer"
                >
                  My Profile &amp; Preferences
                </button>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => go('/admin')}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-[#0F2442] border border-slate-300 rounded-lg cursor-pointer"
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    go('/');
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F2442] cursor-pointer"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    go('/login');
                  }}
                  className="text-center px-4 py-2.5 text-sm font-semibold text-[#0F2442] border border-slate-300 rounded-lg"
                >
                  Login
                </a>
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    go('/register');
                  }}
                  className="text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#0F2442] rounded-lg"
                >
                  Register
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
