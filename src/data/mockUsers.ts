export interface NearbyUser {
  id: string;
  name: string;
  headline: string;
  company: string;
  jobTitle: string;
  profilePhotoUrl: string;
  linkedinProfileUrl: string;
  linkedinId: string;
  distance: number;
  angle: number;
  bio?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  school?: string;
  almaMater?: string;
  schoolId?: string | null;
  graduationYear?: string | null;
  pastCompanies?: string[];
  career?: string;
  industry?: string;
  interests?: string[];
}

export interface Connection {
  id: string;
  user: NearbyUser;
  connectedAt: Date;
  status: 'sent' | 'connected' | 'pending';
}

/** No demo/placeholder users — app shows only real users from backend */
export const mockNearbyUsers: NearbyUser[] = [];

/** @deprecated — kept for type reference only; use real connections from context */
export const mockConnections: Connection[] = [];
