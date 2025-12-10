
export enum Role {
  ADMIN = 'ADMIN',
  STAGING_SUPERVISOR = 'STAGING_SUPERVISOR',
  LOADING_SUPERVISOR = 'LOADING_SUPERVISOR',
  SHIFT_LEAD = 'SHIFT_LEAD',
  VIEWER = 'VIEWER'
}

export enum Department {
  MAINTENANCE = 'MAINTENANCE',
  IT = 'IT',
  HR = 'HR',
  LOGISTICS = 'LOGISTICS',
  OPERATIONS = 'OPERATIONS',
  QUALITY = 'QUALITY',
  OTHER = 'OTHER'
}

export enum SheetStatus {
  DRAFT = 'DRAFT',
  STAGING_VERIFICATION_PENDING = 'STAGING_VERIFICATION_PENDING',
  LOCKED = 'LOCKED', // Ready for loading
  LOADING_VERIFICATION_PENDING = 'LOADING_VERIFICATION_PENDING',
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
  type?: 'remark' | 'rejection'; // Enhanced comment type
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

  // Approval Metadata
  stagingApprovedBy?: string;
  stagingApprovedAt?: string;
  loadingApprovedBy?: string;
  loadingApprovedAt?: string;
  rejectionReason?: string;

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

export const EMPTY_STAGING_ITEMS: StagingItem[] = Array.from({ length: 15 }, (_, i) => ({
  srNo: i + 1,
  skuName: '',
  casesPerPlt: 0,
  fullPlt: 0,
  loose: 0,
  ttlCases: 0
}));

export type IncidentType = 'DAMAGE' | 'SHORTAGE' | 'QUALITY' | 'SAFETY' | 'OTHER';
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED';

export interface Incident {
  id: string;
  sheetId: string;
  type: IncidentType;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdBy: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  assignedDepartment?: Department;
  occurredAt?: string; // User-reported time of incident
}
