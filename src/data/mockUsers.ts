export interface NearbyUser {
  id: string;
  name: string;
  headline: string;
  company: string;
  jobTitle: string;
  profilePhotoUrl: string;
  linkedinProfileUrl: string;
  linkedinId: string;
  distance: number; // meters
  angle: number; // degrees on radar
}

export interface Connection {
  id: string;
  user: NearbyUser;
  connectedAt: Date;
  status: 'sent' | 'connected' | 'pending';
}

export const mockNearbyUsers: NearbyUser[] = [
  {
    id: '1',
    name: 'Gavin Wright',
    headline: 'Investment Banking Summer Analyst',
    company: 'Lincoln International',
    jobTitle: 'Summer Analyst',
    profilePhotoUrl: '',
    linkedinProfileUrl: 'https://linkedin.com/in/gavinwright',
    linkedinId: 'gavinwright',
    distance: 3,
    angle: 45,
  },
  {
    id: '2',
    name: 'Sarah Chen',
    headline: 'Product Manager at Stripe',
    company: 'Stripe',
    jobTitle: 'Product Manager',
    profilePhotoUrl: '',
    linkedinProfileUrl: 'https://linkedin.com/in/sarachen',
    linkedinId: 'sarachen',
    distance: 5,
    angle: 120,
  },
  {
    id: '3',
    name: 'Marcus Johnson',
    headline: 'Senior Software Engineer',
    company: 'Google',
    jobTitle: 'Senior SWE',
    profilePhotoUrl: '',
    linkedinProfileUrl: 'https://linkedin.com/in/marcusj',
    linkedinId: 'marcusj',
    distance: 8,
    angle: 200,
  },
  {
    id: '4',
    name: 'Emily Torres',
    headline: 'Venture Capital Associate',
    company: 'Andreessen Horowitz',
    jobTitle: 'Associate',
    profilePhotoUrl: '',
    linkedinProfileUrl: 'https://linkedin.com/in/emilytorres',
    linkedinId: 'emilytorres',
    distance: 4,
    angle: 310,
  },
  {
    id: '5',
    name: 'Alex Kim',
    headline: 'Founder & CEO',
    company: 'NovaTech',
    jobTitle: 'CEO',
    profilePhotoUrl: '',
    linkedinProfileUrl: 'https://linkedin.com/in/alexkim',
    linkedinId: 'alexkim',
    distance: 6,
    angle: 75,
  },
];

export const mockConnections: Connection[] = [
  {
    id: 'c1',
    user: mockNearbyUsers[0],
    connectedAt: new Date(Date.now() - 1000 * 60 * 30),
    status: 'connected',
  },
  {
    id: 'c2',
    user: mockNearbyUsers[1],
    connectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'sent',
  },
  {
    id: 'c3',
    user: mockNearbyUsers[2],
    connectedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    status: 'connected',
  },
];
