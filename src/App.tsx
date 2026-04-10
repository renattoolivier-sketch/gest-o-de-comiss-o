/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Technician, Team, ServiceOrder, UserProfile } from './types';
import Dashboard from './components/Dashboard';
import TechniciansTeams from './components/TechniciansTeams';
import Commissions from './components/Commissions';
import MonthlySpreadsheet from './components/MonthlySpreadsheet';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import { LayoutDashboard, Users, Calculator, Wifi, CloudOff, Cloud, LogOut, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from './lib/supabase';
import { Button } from '@/components/ui/button';

// Initial Mock Data
const INITIAL_TECHS: Technician[] = [
  { id: 't1', name: 'João Silva', salaryBase: 2000, role: 'Técnico de Campo' },
  { id: 't2', name: 'Maria Oliveira', salaryBase: 1850, role: 'Instaladora' },
  { id: 't3', name: 'Carlos Santos', salaryBase: 2200, role: 'Líder Técnico' },
  { id: 't4', name: 'Ana Costa', salaryBase: 1850, role: 'Reparadora' },
];

const INITIAL_TEAMS: Team[] = [
  { id: 'team1', name: 'Equipe Um', leaderId: 't3', memberIds: ['t1', 't2', 't3'] },
];

const INITIAL_ORDERS: ServiceOrder[] = [
  { protocol: 'OS-0401-01', responsibleId: 't1', isTeam: false, openingDate: '2026-04-01', status: 'Concluída', description: 'Instalação Residencial' },
  { protocol: 'OS-0401-02', responsibleId: 't2', isTeam: false, openingDate: '2026-04-01', status: 'Concluída', description: 'Reparo de Sinal' },
  { protocol: 'OS-0402-01', responsibleId: 'team1', isTeam: true, openingDate: '2026-04-01', closingDate: '2026-04-01', status: 'Concluída', description: 'Manutenção Preventiva' },
];

export default function App() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [monthlySla, setMonthlySla] = useState<Record<string, Record<string, number>>>({});
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('telecom_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Load initial data from Supabase or LocalStorage
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 0. Ensure master admin exists
        try {
          const { data: adminExists, error: adminError } = await supabase
            .from('app_users')
            .select('id')
            .eq('username', 'renato')
            .maybeSingle();

          if (!adminExists && !adminError) {
            await supabase.from('app_users').insert([
              {
                username: 'renato',
                password: 'Rog@32604509',
                role: 'admin'
              }
            ]);
          }
        } catch (e) {
          console.error('Error checking/creating master admin:', e);
        }

        // 1. Try to fetch from Supabase
        const { data: techData, error: techError } = await supabase.from('technicians').select('*');
        const { data: teamData, error: teamError } = await supabase.from('teams').select('*');
        const { data: orderData, error: orderError } = await supabase.from('service_orders').select('*');
        const { data: slaData, error: slaError } = await supabase.from('monthly_sla').select('*');

        if (techError || teamError || orderError || slaError) {
          throw new Error('Supabase fetch failed');
        }

        // 2. If Supabase has data, use it
        if (techData && techData.length > 0) {
          setTechnicians(techData);
          setTeams(teamData || []);
          setOrders(orderData || []);
          
          // Reconstruct SLA object
          const slaObj: Record<string, Record<string, number>> = {};
          slaData?.forEach(item => {
            if (!slaObj[item.month]) slaObj[item.month] = {};
            slaObj[item.month][item.tech_id] = item.value;
          });
          setMonthlySla(slaObj);
          setIsOnline(true);
        } else {
          // 3. If Supabase is empty, check LocalStorage for migration
          const savedTechs = localStorage.getItem('telecom_techs');
          const savedTeams = localStorage.getItem('telecom_teams');
          const savedOrders = localStorage.getItem('telecom_orders');
          const savedSla = localStorage.getItem('telecom_monthly_sla');

          const initialTechs = savedTechs ? JSON.parse(savedTechs) : INITIAL_TECHS;
          const initialTeams = savedTeams ? JSON.parse(savedTeams) : INITIAL_TEAMS;
          const initialOrders = savedOrders ? JSON.parse(savedOrders) : INITIAL_ORDERS;
          const initialSla = savedSla ? JSON.parse(savedSla) : {};

          setTechnicians(initialTechs);
          setTeams(initialTeams);
          setOrders(initialOrders);
          setMonthlySla(initialSla);

          // 4. Migrate to Supabase if we have data
          await migrateToSupabase(initialTechs, initialTeams, initialOrders, initialSla);
        }
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
        setIsOnline(false);
        // Fallback to LocalStorage
        const savedTechs = localStorage.getItem('telecom_techs');
        const savedTeams = localStorage.getItem('telecom_teams');
        const savedOrders = localStorage.getItem('telecom_orders');
        const savedSla = localStorage.getItem('telecom_monthly_sla');

        setTechnicians(savedTechs ? JSON.parse(savedTechs) : INITIAL_TECHS);
        setTeams(savedTeams ? JSON.parse(savedTeams) : INITIAL_TEAMS);
        setOrders(savedOrders ? JSON.parse(savedOrders) : INITIAL_ORDERS);
        setMonthlySla(savedSla ? JSON.parse(savedSla) : {});
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const migrateToSupabase = async (techs: Technician[], teams: Team[], orders: ServiceOrder[], sla: any) => {
    try {
      // Insert technicians
      if (techs.length > 0) {
        await supabase.from('technicians').upsert(techs.map(t => ({
          id: t.id,
          name: t.name,
          salaryBase: t.salaryBase,
          role: t.role
        })));
      }

      // Insert teams
      if (teams.length > 0) {
        await supabase.from('teams').upsert(teams.map(t => ({
          id: t.id,
          name: t.name,
          leaderId: t.leaderId,
          memberIds: t.memberIds
        })));
      }

      // Insert orders
      if (orders.length > 0) {
        await supabase.from('service_orders').upsert(orders.map(o => ({
          protocol: o.protocol,
          responsibleId: o.responsibleId,
          isTeam: o.isTeam,
          openingDate: o.openingDate,
          originalOpeningDate: o.originalOpeningDate,
          isDelayed: o.isDelayed,
          closingDate: o.closingDate,
          status: o.status,
          description: o.description
        })));
      }

      // Insert SLA
      const slaEntries: any[] = [];
      Object.entries(sla).forEach(([month, techs]: [string, any]) => {
        Object.entries(techs).forEach(([techId, value]: [string, any]) => {
          slaEntries.push({ month, tech_id: techId, value });
        });
      });
      if (slaEntries.length > 0) {
        await supabase.from('monthly_sla').upsert(slaEntries);
      }
      
      setIsOnline(true);
    } catch (error) {
      console.error('Migration to Supabase failed:', error);
      setIsOnline(false);
    }
  };

  // Sync with LocalStorage as backup
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('telecom_techs', JSON.stringify(technicians));
      localStorage.setItem('telecom_teams', JSON.stringify(teams));
      localStorage.setItem('telecom_orders', JSON.stringify(orders));
      localStorage.setItem('telecom_monthly_sla', JSON.stringify(monthlySla));
    }
  }, [technicians, teams, orders, monthlySla, isLoading]);

  // Handlers with Supabase Sync
  const handleAddOrder = async (order: ServiceOrder) => {
    setOrders(prev => [...prev, order]);
    await supabase.from('service_orders').insert([{
      protocol: order.protocol,
      responsibleId: order.responsibleId,
      isTeam: order.isTeam,
      openingDate: order.openingDate,
      originalOpeningDate: order.originalOpeningDate,
      isDelayed: order.isDelayed,
      closingDate: order.closingDate,
      status: order.status,
      description: order.description
    }]);
  };

  const handleUpdateOrder = async (order: ServiceOrder) => {
    setOrders(prev => prev.map(o => o.protocol === order.protocol ? order : o));
    await supabase.from('service_orders').update({
      responsibleId: order.responsibleId,
      isTeam: order.isTeam,
      openingDate: order.openingDate,
      originalOpeningDate: order.originalOpeningDate,
      isDelayed: order.isDelayed,
      closingDate: order.closingDate,
      status: order.status,
      description: order.description
    }).eq('protocol', order.protocol);
  };

  const handleDeleteOrder = async (protocol: string) => {
    setOrders(prev => prev.filter(o => o.protocol !== protocol));
    await supabase.from('service_orders').delete().eq('protocol', protocol);
  };

  const handleAddTech = async (tech: Technician) => {
    setTechnicians(prev => [...prev, tech]);
    await supabase.from('technicians').insert([{
      id: tech.id,
      name: tech.name,
      salaryBase: tech.salaryBase,
      role: tech.role
    }]);
  };

  const handleUpdateTech = async (tech: Technician) => {
    setTechnicians(prev => prev.map(t => t.id === tech.id ? tech : t));
    await supabase.from('technicians').update({
      name: tech.name,
      salaryBase: tech.salaryBase,
      role: tech.role
    }).eq('id', tech.id);
  };

  const handleDeleteTech = async (id: string) => {
    setTechnicians(prev => prev.filter(t => t.id !== id));
    await supabase.from('technicians').delete().eq('id', id);
  };

  const handleAddTeam = async (team: Team) => {
    setTeams(prev => [...prev, team]);
    await supabase.from('teams').insert([{
      id: team.id,
      name: team.name,
      leaderId: team.leaderId,
      memberIds: team.memberIds
    }]);
  };

  const handleUpdateTeam = async (team: Team) => {
    setTeams(prev => prev.map(t => t.id === team.id ? team : t));
    await supabase.from('teams').update({
      name: team.name,
      leaderId: team.leaderId,
      memberIds: team.memberIds
    }).eq('id', team.id);
  };

  const handleDeleteTeam = async (id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
    await supabase.from('teams').delete().eq('id', id);
  };

  const handleUpdateSla = async (month: string, techId: string, value: number) => {
    setMonthlySla(prev => ({
      ...prev,
      [month]: {
        ...(prev[month] || {}),
        [techId]: value
      }
    }));
    await supabase.from('monthly_sla').upsert({
      month,
      tech_id: techId,
      value
    }, { onConflict: 'month,tech_id' });
  };

  const handleLogin = (userData: UserProfile) => {
    setUser(userData);
    localStorage.setItem('telecom_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('telecom_user');
  };

  const handleResetData = async () => {
    setIsLoading(true);
    try {
      // Clear Supabase tables
      await supabase.from('monthly_sla').delete().neq('id', 0); // Delete all
      await supabase.from('service_orders').delete().neq('protocol', ''); // Delete all
      await supabase.from('teams').delete().neq('id', ''); // Delete all
      await supabase.from('technicians').delete().neq('id', ''); // Delete all

      // Clear LocalStorage
      localStorage.clear();

      // Reload to restore initial mock data
      window.location.reload();
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('Erro ao resetar dados no Supabase. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-purple-700 font-medium">Sincronizando com Supabase...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-purple-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-bottom border-purple-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600 p-2 rounded-lg relative">
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-cyan-400 rounded-sm border-2 border-white" />
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Infolink <span className="text-purple-600">Ultra Internet</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border text-[10px] font-bold uppercase tracking-wider">
              {isOnline ? (
                <>
                  <Cloud className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600">Supabase Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-rose-500" />
                  <span className="text-rose-600">Modo Offline (Local)</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 border-l pl-4">
              <div className="hidden md:block text-right">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider leading-none mb-1">
                  {user.role === 'admin' ? 'Administrador' : 'Visualizador'}
                </p>
                <p className="text-sm font-bold leading-none">{user.username}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className={`grid w-full ${user.role === 'admin' ? 'max-w-xl grid-cols-4' : 'max-w-md grid-cols-3'} bg-white border shadow-sm`}>
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="technicians" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                <Users className="w-4 h-4 mr-2" /> Equipes
              </TabsTrigger>
              <TabsTrigger value="commissions" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                <Calculator className="w-4 h-4 mr-2" /> Comissões
              </TabsTrigger>
              {user.role === 'admin' && (
                <TabsTrigger value="users" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                  <Shield className="w-4 h-4 mr-2" /> Usuários
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <Dashboard 
              orders={orders} 
              technicians={technicians} 
              teams={teams}
              onAddOrder={handleAddOrder}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              userRole={user.role}
            />
          </TabsContent>

          <TabsContent value="technicians" className="mt-0 focus-visible:outline-none">
            <TechniciansTeams 
              technicians={technicians}
              teams={teams}
              orders={orders}
              onAddTechnician={handleAddTech}
              onUpdateTechnician={handleUpdateTech}
              onDeleteTechnician={handleDeleteTech}
              onAddTeam={handleAddTeam}
              onUpdateTeam={handleUpdateTeam}
              onDeleteTeam={handleDeleteTeam}
              onResetData={handleResetData}
              userRole={user.role}
            />
          </TabsContent>

          <TabsContent value="commissions" className="mt-0 focus-visible:outline-none">
            <Commissions 
              technicians={technicians}
              teams={teams}
              orders={orders}
              monthlySla={monthlySla}
              onUpdateSla={handleUpdateSla}
              currentMonth={format(new Date(), 'yyyy-MM')}
              userRole={user.role}
            />
          </TabsContent>

          {user.role === 'admin' && (
            <TabsContent value="users" className="mt-0 focus-visible:outline-none">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="mt-auto py-6 border-t border-purple-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; 2024 Infolink Ultra Internet - Sistema de Gestão Operacional e Financeira
          </p>
        </div>
      </footer>
    </div>
  );
}

