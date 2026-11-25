import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setApiToken } from '../lib/api';
import type { NotificationItem, ProgramType, User } from '../types';

interface AdminStatus {
  envPasscodeConfigured: boolean;
  hasClaimedAdmin: boolean;
}

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  institution: string;
  course: 'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator';
  semesterOrYear: string;
}

interface UpdateProfileInput {
  fullName: string;
  institution: string;
  course: 'B.Pharm' | 'M.Pharm' | 'Educator' | 'Coordinator';
  semesterOrYear: string;
  bio?: string;
  preferredProgram?: ProgramType | 'All';
  preferredSubjects?: string[];
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  adminStatus: AdminStatus;
  notifications: NotificationItem[];
  unreadCount: number;
  notificationsLoading: boolean;
  refreshAdminStatus: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  adminBootstrap: (input: {
    fullName: string;
    email: string;
    password: string;
    institution: string;
  }) => Promise<User>;
  adminPasscodeLogin: (passcode: string) => Promise<User>;
  updateProfile: (input: UpdateProfileInput) => Promise<User>;
  uploadAvatar: (file: File) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({
    envPasscodeConfigured: false,
    hasClaimedAdmin: false,
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const refreshAdminStatus = useCallback(async () => {
    try {
      const data = await apiRequest<AdminStatus>('/api/auth/admin-status');
      setAdminStatus(data);
    } catch {
      // ignore transient error
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      const data = await apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore transient error
    } finally {
      setNotificationsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshAdminStatus();
  }, [refreshAdminStatus]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const applySession = useCallback((nextToken: string, nextUser: User) => {
    setApiToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const adminBootstrap = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      institution: string;
    }) => {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/admin-bootstrap', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      applySession(res.token, res.user);
      await refreshAdminStatus();
      return res.user;
    },
    [applySession, refreshAdminStatus]
  );

  const adminPasscodeLogin = useCallback(
    async (passcode: string) => {
      const res = await apiRequest<{ token: string; user: User }>(
        '/api/auth/admin-passcode-login',
        {
          method: 'POST',
          body: JSON.stringify({ passcode }),
        }
      );
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const res = await apiRequest<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setUser(res.user);
      await refreshNotifications();
      return res.user;
    },
    [refreshNotifications]
  );

  const uploadAvatar = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiRequest<{ avatarUrl: string; user: User }>('/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });
    setUser(res.user);
    return res.user;
  }, []);

  const markNotificationRead = useCallback(async (id: number) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(next.filter((n) => !n.isRead).length);
      return next;
    });
    try {
      await apiRequest('/api/notifications/' + id + '/read', { method: 'POST' });
    } catch {
      // ignore transient error
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
    } catch {
      // ignore transient error
    }
  }, []);

  const logout = useCallback(() => {
    setApiToken(null);
    setToken(null);
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        adminStatus,
        notifications,
        unreadCount,
        notificationsLoading,
        refreshAdminStatus,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        login,
        register,
        adminBootstrap,
        adminPasscodeLogin,
        updateProfile,
        uploadAvatar,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
