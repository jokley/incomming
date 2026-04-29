export type ComplianceStatus = 'ok' | 'over' | 'missing';

export interface OfficialQuotaUsage {
  nationCode: string;
  discipline: string;
  gender: string;
  athletesEntered: number;
  officialQuota: number;
  singleRoomsAllowed: number;
  assignedOfficials: number;
  singleRoomsUsed: number;
}

export function getComplianceStatus(assigned: number, quota: number): ComplianceStatus {
  if (assigned === quota) return 'ok';
  if (assigned > quota) return 'over';
  return 'missing';
}
