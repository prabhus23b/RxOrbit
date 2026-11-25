export type UserRole = 'student' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type ProgramType = 'B.Pharm' | 'M.Pharm';

export interface User {
  id: number;
  fullName: string;
  email: string;
  institution: string;
  course: ProgramType | 'Educator' | 'Coordinator';
  semesterOrYear: string;
  avatarUrl?: string;
  bio?: string;
  preferredProgram?: ProgramType | 'All';
  preferredSubjects?: string[];
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export type NotificationCategory = 'event' | 'material' | 'announcement';

export interface NotificationItem {
  id: number;
  category: NotificationCategory;
  title: string;
  message: string;
  linkPath: string;
  targetProgram: string;
  isRead: boolean;
  createdAt: string;
}

export type MaterialType =
  | 'Study Notes'
  | 'PDF Material'
  | 'Question Paper'
  | 'Important Questions'
  | 'Reference Material';

export interface StudyMaterial {
  id: number;
  title: string;
  program: ProgramType;
  semesterOrSpec: string;
  subject: string;
  materialType: MaterialType;
  description: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  downloads: number;
  createdAt: string;
}

export interface CurriculumSubject {
  id: number;
  unitId: number;
  name: string;
  code: string;
  displayOrder: number;
}

export interface CurriculumUnit {
  id: number;
  program: ProgramType;
  name: string;
  displayOrder: number;
  subjects: CurriculumSubject[];
}

export type EventType =
  | 'Webinar'
  | 'Workshop'
  | 'Seminar'
  | 'Conference'
  | 'Competition'
  | 'Guest Lecture';

export type EventStatus = 'upcoming' | 'past' | 'draft';

export interface RxEvent {
  id: number;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  eventDate: string;
  eventTime: string;
  venueOrMode: string;
  posterUrl: string;
  maxSeats: number;
  registrationCount?: number;
  createdAt: string;
}

export interface EventRegistration {
  id: number;
  eventId: number;
  eventTitle?: string;
  eventDate?: string;
  userId: number | null;
  fullName: string;
  email: string;
  institution: string;
  course: string;
  semesterOrYear: string;
  attendanceStatus: 'registered' | 'attended' | 'cancelled';
  registrationCode: string;
  createdAt: string;
}

export type GalleryCategory =
  | 'Webinar Photographs'
  | 'Workshop Photographs'
  | 'Seminar Photographs'
  | 'Conference Memories'
  | 'Student Activities'
  | 'Competition Highlights'
  | 'Community Achievements';

export interface GalleryAlbum {
  id: number;
  title: string;
  category: GalleryCategory;
  eventDate: string;
  description: string;
  coverUrl: string;
  photoCount?: number;
  createdAt: string;
}

export interface GalleryPhoto {
  id: number;
  albumId: number;
  albumTitle?: string;
  imageUrl: string;
  caption: string;
  eventDate: string;
  category: GalleryCategory;
  createdAt: string;
}

export type TeamSection =
  | 'Founder'
  | 'Leadership Team'
  | 'Core Team'
  | 'Student Coordinators';

export interface TeamMember {
  id: number;
  fullName: string;
  designation: string;
  section: TeamSection;
  bio: string;
  photoUrl: string;
  linkedinUrl: string;
  email: string;
  displayOrder: number;
  createdAt: string;
}

export interface VoiceEntry {
  id: number;
  userId: number | null;
  authorName: string;
  institution: string;
  courseDetails: string;
  experienceType: string;
  quote: string;
  story: string;
  photoUrl: string;
  allowPhoto: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Certificate {
  id: number;
  certificateCode: string;
  participantName: string;
  participantEmail: string;
  eventId: number | null;
  eventName: string;
  eventDate: string;
  organizationName: string;
  templateTitle: string;
  templateSubtitle: string;
  signatoryName: string;
  signatoryRole: string;
  accentColor: string;
  issuedAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  category: string;
  linkPath: string;
  isActive: boolean;
  createdAt: string;
}

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  heroTagline: string;
  aboutSummary: string;
  vision: string;
  mission: string;
  objectives: string;
  whyRxOrbit: string;
  commitment: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  linkedinUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
}
