
export enum Role {
  ADMIN = 'ADMIN',
  STAGING_SUPERVISOR = 'STAGING_SUPERVISOR',
  LOADING_SUPERVISOR = 'LOADING_SUPERVISOR',
  VIEWER = 'VIEWER'
}

export enum SheetStatus {
  DRAFT = 'DRAFT',
  LOCKED = 'LOCKED', // Ready for loading
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  empCode: string; // New Field
  password?: string; // In a real app, never store plain text
  role: Role;
  email?: string;
  isApproved: boolean;
}

export interface StagingItem {
  srNo: number;
  skuName: string;
  casesPerPlt: number;
  fullPlt: number;
  loose: number;
  ttlCases: number;
}

export interface LoadingCell {
  row: number;
  col: number;
  value: number; // usually cases per pallet
}

export interface LoadingItemData {
  skuSrNo: number;
  cells: LoadingCell[];
  looseInput: number;
  total: number;
  balance: number;
}

export interface AdditionalItem {
  id: number;
  skuName: string;
  counts: number[];
  total: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface HistoryLog {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  details: string;
}

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface SheetData {
  id: string;
  status: SheetStatus;
  version: number;

  // Header Info
  shift: string;
  date: string;
  destination: string;
  supervisorName: string;
  empCode: string;
  loadingDoc: string;

  // Staging Data
  stagingItems: StagingItem[];

  // Loading Data (Optional until Locked)
  transporter?: string;
  loadingDockNo?: string;
  loadingStartTime?: string;
  loadingEndTime?: string;

  // Picking & Logistics Info (Added for Loading Sheet)
  pickingBy?: string;
  pickingCrosscheckedBy?: string;
  sealNo?: string;
  vehicleNo?: string;
  driverName?: string;
  regSerialNo?: string;

  loadingItems?: LoadingItemData[];
  additionalItems?: AdditionalItem[];

  // Signatures / Auth
  loadingSvName?: string;
  loadingSupervisorSign?: string;
  slSign?: string;
  deoSign?: string;

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  completedBy?: string;
  completedAt?: string;

  capturedImages?: string[]; // Base64 strings
  comments?: Comment[];
  history?: HistoryLog[];
}
