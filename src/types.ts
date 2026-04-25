export enum ReportStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved'
}

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ReportCategory {
  POTHOLE = 'pothole',
  GARBAGE = 'garbage',
  SEWAGE = 'sewage',
  LIGHTING = 'lighting',
  OTHER = 'other'
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Report {
  id: string;
  userId: string;
  category: ReportCategory;
  description: string;
  voiceUrl?: string;
  imageUrl?: string;
  resolvedImageUrl?: string;
  status: ReportStatus;
  priority: ReportPriority;
  location: Location;
  neighborhoodId: string;
  supportCount: number;
  createdAt: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: 'citizen' | 'authority';
  neighborhoodId?: string;
}
