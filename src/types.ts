export interface Request {
  id: string;
  source: 'whatsapp' | 'google_form' | 'manual' | 'file' | 'ai_ingestion' | 'voice' | 'csv' | 'text_paste' | 'whatsapp_sim';
  rawContent: string;
  mediaUrl?: string;
  extractedData?: {
    item: string;
    quantity: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    lat: number;
    lng: number;
    value_inr: number;
    contact: string;
    language?: string;
  };
  status: 'pending' | 'processed' | 'duplicate' | 'verified' | 'requires_verification';
  trustScore?: number;
  createdAt: Date | any;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  resourceId: string;
  hash: string; // Simulated cryptographic hash
  details: string;
}

export interface SafePerson {
  id: string;
  name: string;
  age: number;
  location: string;
  status: 'safe' | 'missing' | 'injured';
  contact: string;
  lastSeen: string;
  registeredAt: string;
}

export interface ConsolidatedRequest {
  id: string;
  item: string;
  totalQuantity: number;
  urgency: string;
  pinCode: string;
  lat: number;
  lng: number;
  requests: string[];
  status: 'open' | 'partially_filled' | 'closed' | 'in_transit';
  lastUpdated: string;
  requiredSkills?: string[];
  deliveryMethod?: 'standard' | 'drone' | 'boat';
  isFlooded?: boolean;
}

export interface SupplyPoint {
  id: string;
  name: string;
  type: 'warehouse' | 'distribution_center' | 'medical_hub';
  location: string;
  lat: number;
  lng: number;
  stock: { [item: string]: number };
  inventory: {
    item: string;
    quantity: number;
  }[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'volunteer';
  skills: string[];
  radius: number; // in km
  impactPoints: number;
  tasksCompleted: number;
  trustScore: number; // 0-100
  ngoAffiliation?: string;
  location?: {
    lat: number;
    lng: number;
  };
  monthlyStats?: {
    tasksThisMonth: number;
    pointsThisMonth: number;
    rank?: number;
  };
}

// 5-stage dispatch lifecycle
export type DispatchStatus = 'placed' | 'packed' | 'ready_for_pickup' | 'in_transit' | 'delivered' | 'delayed';

export interface Dispatch {
  id: string;
  requestId: string;
  supplyPointId: string;
  item: string;
  quantity: number;
  from: string;
  to: string;
  toPinCode: string;
  // 5-stage status — backward compatible (old 'preparing' treated as 'placed')
  status: DispatchStatus | 'preparing';
  driver: string;
  driverContact: string;
  vehicle: string;
  dispatchedAt: string;
  deliveredAt?: string;
  eta: string;
  progress: number;
  urgency: 'critical' | 'high' | 'medium';
  verificationToken?: string;
  verifiedAt?: any;
}

export interface TaskMatch {
  id: string;
  taskId: string;
  volunteerId: string;
  score: number;
  distance: number;
  matchedAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'in_transit' | 'completed';
  reasoning?: string;
  qrCode?: string; // Match ID for handshake
  declinedReason?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'critical' | 'success';
  read: boolean;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  impactPoints: number;
  tasksCompleted: number;
  rank: number;
}
