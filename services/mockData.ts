
import { SheetData, SheetStatus, Role, User, StagingItem } from '../types';

export const MOCK_USERS: User[] = [
  { id: '1', username: 'admin', fullName: 'System Administrator', empCode: 'ADM001', password: '123', role: Role.ADMIN, isApproved: true, email: 'admin@unicharm.com' }
];

export const EMPTY_STAGING_ITEMS: StagingItem[] = Array.from({ length: 15 }, (_, i) => ({
  srNo: i + 1,
  skuName: '',
  casesPerPlt: 0,
  fullPlt: 0,
  loose: 0,
  ttlCases: 0
}));

export const MOCK_SHEETS: SheetData[] = [];
