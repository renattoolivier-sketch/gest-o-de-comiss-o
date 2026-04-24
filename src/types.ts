export type Status = 'Aberta' | 'Em Execução' | 'Concluída' | 'Cancelada';
export type TechCategory = 'Rede' | 'Campo' | 'Manutenção';

export interface Technician {
  id: string;
  name: string;
  role: string;
  category: TechCategory;
  fixedCommission?: number; // Only for Manutenção category
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
  observation?: string;
}

export interface CommissionResult {
  technicianId: string;
  technicianName: string;
  category: TechCategory;
  openOS: number;
  closedOS: number;
  delayedOS: number;
  daysWorked: number;
  productivity: number;
  sla: number;
  conformity: number;
  // Computed values
  osBonus: number; // The tier value (e.g., 1000)
  slaBonus: number; // The tier value (e.g., 500)
  conformityBonus: number; // The tier value (e.g., 1500)
  weightedOS: number; // osBonus * 0.6
  weightedSLA: number; // slaBonus * 0.25
  weightedConformity: number; // conformityBonus * 0.15
  totalTeamCommission: number; // Sum of weighted values
  finalCommission: number; // totalTeamCommission / members (if applicable)
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
}

export interface SystemLog {
  id?: string;
  created_at?: string;
  username: string;
  action: string;
  details: string;
  category: 'O.S.' | 'Técnico' | 'Equipe' | 'Usuário' | 'Sistema';
}
