export type Status = 'Aberta' | 'Em Execução' | 'Concluída' | 'Cancelada';

export interface Technician {
  id: string;
  name: string;
  salaryBase: number;
  role: string;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
}

export interface ServiceOrder {
  protocol: string;
  responsibleId: string; // Can be a Technician ID or a Team ID
  isTeam: boolean;
  openingDate: string;
  originalOpeningDate?: string; // To track if it was moved
  isDelayed?: boolean;
  closingDate?: string;
  status: Status;
  description: string;
}

export interface CommissionResult {
  technicianId: string;
  technicianName: string;
  baseSalary: number;
  openOS: number;
  closedOS: number;
  daysWorked: number;
  productivity: number;
  bonusPercentage: number;
  bonusAmount: number;
  sla: number;
  finalCommission: number;
}

export type UserRole = 'admin' | 'viewer';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
}
