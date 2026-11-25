import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateStudentRegistration, type RoutePath } from '../lib/domain';

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'admin';
  onNavigate: (path: RoutePath) => void;
}

export function AuthPage({ initialMode = 'login', onNavigate }: AuthPageProps) {
  const { adminStatus, login, register, adminBootstrap, adminPasscodeLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg('');
  }, [initialMode]);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState<'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator'>('B.Pharm');
  const [semesterOrYear, setSemesterOrYear] = useState('Semester 1');

  // Admin setup / passcode fields
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminInstitution, setAdminInstitution] = useState('');
  const [passcode, setPasscode] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const user = await login(loginEmail, loginPassword);
      onNavigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const err = validateStudentRegistration({
      fullName,
      email,
      password,
      institution,
      course,
      semesterOrYear,
    });
    if (err) {
      setErrorMsg(err);
      return;
    }
    setSubmitting(true);
    try {
      await register({
        fullName,
        email,
        password,
        institution,
        course,
        semesterOrYear,
      });
      onNavigate('/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await adminBootstrap({
        fullName: adminName,
        email: adminEmail,
        password: adminPassword,
        institution: adminInstitution,
      });
      onNavigate('/admin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Admin setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await adminPasscodeLogin(passcode);
      onNavigate('/admin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Passcode verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[560px] mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-200 space-y-4">
          <div className="space-y-3">
            <img
              src="/assets/aistudio/RxOrbit_Pharmacy_Education_Logo__1__9dc97750.png"
              alt="RxOrbit — Connect · Discover · Advance"
              className="h-16 w-auto object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                RxOrbit Member Portal
              </p>
              <h1 className="text-2xl font-display font-bold text-[#0F2442] mt-1">
                {mode === 'login'
                  ? 'Sign in to Your Account'
                  : mode === 'register'
                  ? 'Join RxOrbit Community'
                  : 'Administrator Access'}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                onNavigate('/login');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#0F2442] shadow-sm'
                  : 'text-slate-600 hover:text-[#0F2442]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                onNavigate('/register');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#0F2442] shadow-sm'
                  : 'text-slate-600 hover:text-[#0F2442]'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'admin'
                  ? 'bg-white text-[#0F2442] shadow-sm'
                  : 'text-slate-600 hover:text-[#0F2442]'
              }`}
            >
              Admin Access
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {errorMsg}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Enter your email address"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                <Lock className="h-4 w-4" />
                <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              </button>
              <p className="text-xs text-slate-500 text-center pt-2">
                New to RxOrbit?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    onNavigate('/register');
                  }}
                  className="text-teal-700 font-semibold hover:underline cursor-pointer"
                >
                  Create a student account
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Enter your email address"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (8+ characters, letters &amp; numbers)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Create a strong password"
                />
              </div>
              <div>
                <label htmlFor="reg-inst" className="block text-xs font-semibold text-slate-700 mb-1">
                  Institution / Pharmacy College
                </label>
                <input
                  id="reg-inst"
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  placeholder="Enter institution or college name"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-course" className="block text-xs font-semibold text-slate-700 mb-1">
                    Course / Program
                  </label>
                  <select
                    id="reg-course"
                    value={course}
                    onChange={(e) =>
                      setCourse(
                        e.target.value as 'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator'
                      )
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
                  >
                    <option value="B.Pharm">B.Pharm</option>
                    <option value="M.Pharm">M.Pharm</option>
                    <option value="Educator">Pharmacy Educator</option>
                    <option value="Coordinator">Student Coordinator</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-sem" className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester or Academic Year
                  </label>
                  <input
                    id="reg-sem"
                    type="text"
                    required
                    value={semesterOrYear}
                    onChange={(e) => setSemesterOrYear(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    placeholder="Semester 4 or Year 1"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{submitting ? 'Creating Account...' : 'Create RxOrbit Account'}</span>
              </button>
            </form>
          )}

          {mode === 'admin' && (
            <div className="space-y-5">
              {adminStatus.envPasscodeConfigured ? (
                <form onSubmit={handleAdminPasscode} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter the server administrator passcode configured in your environment to open
                    the RxOrbit Admin Console.
                  </p>
                  <div>
                    <label htmlFor="admin-passcode" className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Passcode
                    </label>
                    <input
                      id="admin-passcode"
                      type="password"
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      placeholder="Enter administrator passcode"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{submitting ? 'Verifying...' : 'Enter Admin Console'}</span>
                  </button>
                </form>
              ) : !adminStatus.hasClaimedAdmin ? (
                <form onSubmit={handleAdminBootstrap} className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-[#0F2442]">First-Run Admin Setup:</span>{' '}
                    No administrator account has been claimed yet. Create the initial RxOrbit
                    administrator credentials below to unlock the Admin Console.
                  </div>
                  <div>
                    <label htmlFor="adm-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Full Name
                    </label>
                    <input
                      id="adm-name"
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      placeholder="Enter administrator full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Email
                    </label>
                    <input
                      id="adm-email"
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      placeholder="Enter administrator email"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Password (8+ chars, letters &amp; numbers)
                    </label>
                    <input
                      id="adm-password"
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      placeholder="Choose a strong admin password"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-inst" className="block text-xs font-semibold text-slate-700 mb-1">
                      Organization / Secretariat
                    </label>
                    <input
                      id="adm-inst"
                      type="text"
                      required
                      value={adminInstitution}
                      onChange={(e) => setAdminInstitution(e.target.value)}
                      placeholder="Enter organization name"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{submitting ? 'Setting up Admin...' : 'Claim Administrator Account'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    An administrator account is active. Sign in with your administrator email and
                    password below.
                  </p>
                  <div>
                    <label htmlFor="adm-login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Email
                    </label>
                    <input
                      id="adm-login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-login-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      id="adm-login-pass"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{submitting ? 'Signing in...' : 'Sign In as Administrator'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
