/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Technician, Team, ServiceOrder, UserProfile, SystemLog } from './types';
import Dashboard from './components/Dashboard';
import TechniciansTeams from './components/TechniciansTeams';
import Commissions from './components/Commissions';
import MonthlySpreadsheet from './components/MonthlySpreadsheet';
import UserManagement from './components/UserManagement';
import SystemLogs from './components/SystemLogs';
import Login from './components/Login';
import { LayoutDashboard, Users, Calculator, Wifi, CloudOff, Cloud, LogOut, Shield, AlertCircle, RefreshCcw, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from './lib/supabase';
import { Button } from '@/components/ui/button';

// Initial Mock Data
const INITIAL_TECHS: Technician[] = [
  { id: 't1', name: 'João Silva', role: 'Líder de Rede', category: 'Rede' },
  { id: 't2', name: 'Maria Oliveira', role: 'Técnico de Campo', category: 'Campo' },
  { id: 't3', name: 'Carlos Santos', role: 'Técnico de Rede', category: 'Rede' },
  { id: 't4', name: 'Ana Costa', role: 'Instaladora Campo', category: 'Campo' },
];

const INITIAL_TEAMS: Team[] = [
  { id: 'team1', name: 'Equipe Rede 01', leaderId: 't3', memberIds: ['t1', 't3'] },
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
  const [monthlyConformity, setMonthlyConformity] = useState<Record<string, Record<string, number>>>({});
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('telecom_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return null;
    }
  });

  // Load initial data from Supabase or LocalStorage
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Check if Supabase is configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setDbError('Configuração do Supabase ausente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        setIsOnline(false);
        loadFallbackData();
        if (showLoading) setIsLoading(false);
        return;
      }

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
      const results = await Promise.allSettled([
        supabase.from('technicians').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('service_orders').select('*'),
        supabase.from('monthly_sla').select('*'),
        supabase.from('monthly_conformity').select('*')
      ]);

      const [techRes, teamRes, orderRes, slaRes, confRes] = results;
      
      const fetchErrors = [];
      if (techRes.status === 'fulfilled' && techRes.value.error) fetchErrors.push(techRes.value.error.message);
      if (teamRes.status === 'fulfilled' && teamRes.value.error) fetchErrors.push(teamRes.value.error.message);
      if (orderRes.status === 'fulfilled' && orderRes.value.error) fetchErrors.push(orderRes.value.error.message);
      if (slaRes.status === 'fulfilled' && slaRes.value.error) fetchErrors.push(slaRes.value.error.message);
      if (confRes.status === 'fulfilled' && confRes.value.error) fetchErrors.push(confRes.value.error.message);

      if (fetchErrors.length > 0) {
        console.warn('Supabase fetch failure details:', fetchErrors);
        const mainError = fetchErrors[0];
        
        if (mainError.includes('relation') && mainError.includes('does not exist')) {
          setDbError(`Tabela ausente: ${mainError.split('"')[1] || mainError}`);
        } else {
          setDbError(`Supabase: ${mainError}`);
        }
        
        // Only fallback to local if essential tables fail
        if (techRes.status === 'fulfilled' && techRes.value.error?.message.includes('relation "technicians" does not exist')) {
          setIsOnline(false);
          loadFallbackData();
          return;
        }
      }

      const techData = techRes.status === 'fulfilled' && !techRes.value.error 
        ? techRes.value.data.map((t: any) => ({
            id: t.id,
            name: t.name,
            role: t.role,
            category: t.category,
            fixedCommission: t.fixedCommission !== undefined ? t.fixedCommission : (t.fixed_commission !== undefined ? t.fixed_commission : t.fixedcommission)
          })) 
        : [];

      const teamData = teamRes.status === 'fulfilled' && !teamRes.value.error 
        ? teamRes.value.data.map((t: any) => ({
            id: t.id,
            name: t.name,
            leaderId: t.leaderId || t.leader_id || t.leaderid,
            memberIds: t.memberIds || t.member_ids || t.memberids
          })) 
        : [];

      const orderData = orderRes.status === 'fulfilled' && !orderRes.value.error 
        ? orderRes.value.data.map((o: any) => ({
            protocol: o.protocol,
            responsibleId: o.responsibleId || o.responsible_id || o.responsibleid,
            isTeam: o.isTeam !== undefined ? o.isTeam : (o.is_team !== undefined ? o.is_team : o.isteam),
            openingDate: o.openingDate || o.opening_date || o.openingdate,
            originalOpeningDate: o.originalOpeningDate || o.original_opening_date || o.originalopeningdate,
            isDelayed: o.isDelayed !== undefined ? o.isDelayed : (o.is_delayed !== undefined ? o.is_delayed : o.isdelayed),
            closingDate: o.closingDate || o.closing_date || o.closingdate,
            status: o.status,
            description: o.description,
            observation: o.observation
          })) 
        : [];
      const slaData = slaRes.status === 'fulfilled' && !slaRes.value.error ? slaRes.value.data : [];
      const confData = confRes.status === 'fulfilled' && !confRes.value.error ? confRes.value.data : [];

      // 2. Use Supabase data (even if some tables are empty)
      setTechnicians(techData || []);
      setTeams(teamData || []);
      setOrders(orderData || []);
      
      // Reconstruct SLA object
      const slaObj: Record<string, Record<string, number>> = {};
      slaData?.forEach((item: any) => {
        if (!slaObj[item.month]) slaObj[item.month] = {};
        slaObj[item.month][item.tech_id] = item.value;
      });
      setMonthlySla(slaObj);

      // Reconstruct Conformity object
      const confObj: Record<string, Record<string, number>> = {};
      confData?.forEach((item: any) => {
        if (!confObj[item.month]) confObj[item.month] = {};
        confObj[item.month][item.tech_id] = item.value;
      });
      setMonthlyConformity(confObj);

      setIsOnline(true);
      if (fetchErrors.length === 0) setDbError(null);

      // 3. If everything is empty, it might be a new setup, so we could migrate mock data
      if ((!techData || techData.length === 0) && (!orderData || orderData.length === 0)) {
        const savedTechs = localStorage.getItem('telecom_techs');
        if (savedTechs) {
          try {
            // Migrate existing local data if any
            const initialTechs = JSON.parse(savedTechs);
            const initialTeams = JSON.parse(localStorage.getItem('telecom_teams') || '[]');
            const initialOrders = JSON.parse(localStorage.getItem('telecom_orders') || '[]');
            const initialSla = JSON.parse(localStorage.getItem('telecom_monthly_sla') || '{}');
            
            setTechnicians(initialTechs);
            setTeams(initialTeams);
            setOrders(initialOrders);
            setMonthlySla(initialSla);
            await migrateToSupabase(initialTechs, initialTeams, initialOrders, initialSla);
          } catch (e) {
            console.error('Error migrating local data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
      setIsOnline(false);
      loadFallbackData();
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh when window gains focus
    const handleFocus = () => {
      console.log('Window focused, refreshing data...');
      fetchData(false);
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  const loadFallbackData = () => {
    try {
      const savedTechs = localStorage.getItem('telecom_techs');
      const savedTeams = localStorage.getItem('telecom_teams');
      const savedOrders = localStorage.getItem('telecom_orders');
      const savedSla = localStorage.getItem('telecom_monthly_sla');

      setTechnicians(savedTechs ? JSON.parse(savedTechs) : INITIAL_TECHS);
      setTeams(savedTeams ? JSON.parse(savedTeams) : INITIAL_TEAMS);
      setOrders(savedOrders ? JSON.parse(savedOrders) : INITIAL_ORDERS);
      setMonthlySla(savedSla ? JSON.parse(savedSla) : {});
    } catch (e) {
      console.error('Error loading fallback data:', e);
      setTechnicians(INITIAL_TECHS);
      setTeams(INITIAL_TEAMS);
      setOrders(INITIAL_ORDERS);
      setMonthlySla({});
    }
  };

  const migrateToSupabase = async (techs: Technician[], teams: Team[], orders: ServiceOrder[], sla: any) => {
    try {
      // Insert technicians
      if (techs.length > 0) {
        await supabase.from('technicians').upsert(techs.map(t => ({
          id: t.id,
          name: t.name,
          role: t.role,
          category: t.category,
          fixedCommission: t.fixedCommission || 0
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
          description: o.description,
          observation: o.observation
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

      // Insert Conformity
      const confEntries: any[] = [];
      Object.entries(monthlyConformity).forEach(([month, techs]: [string, any]) => {
        Object.entries(techs).forEach(([techId, value]: [string, any]) => {
          confEntries.push({ month, tech_id: techId, value });
        });
      });
      if (confEntries.length > 0) {
        await supabase.from('monthly_conformity').upsert(confEntries);
      }
      
      setIsOnline(true);
    } catch (error) {
      console.error('Migration to Supabase failed:', error);
      setIsOnline(false);
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!isOnline) return;

    console.log('Iniciando inscrições Realtime...');

    const techniciansChannel = supabase
      .channel('technicians-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, (payload) => {
        console.log('Evento Technicians:', payload.eventType, payload.new);
        const newData = payload.new as any;
        const mapped = newData ? {
          id: newData.id,
          name: newData.name,
          role: newData.role,
          category: newData.category,
          fixedCommission: newData.fixedCommission !== undefined ? newData.fixedCommission : (newData.fixed_commission !== undefined ? newData.fixed_commission : newData.fixedcommission)
        } as Technician : null;

        if (payload.eventType === 'INSERT' && mapped) {
          setTechnicians(prev => {
            if (prev.find(t => t.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        } else if (payload.eventType === 'UPDATE' && mapped) {
          setTechnicians(prev => prev.map(t => t.id === mapped.id ? mapped : t));
        } else if (payload.eventType === 'DELETE') {
          setTechnicians(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        console.log('Status Canal Técnicos:', status);
        if (status === 'SUBSCRIBED') fetchData(false);
      });

    const teamsChannel = supabase
      .channel('teams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload) => {
        const newData = payload.new as any;
        const mapped = newData ? {
          id: newData.id,
          name: newData.name,
          leaderId: newData.leaderId || newData.leader_id || newData.leaderid,
          memberIds: newData.memberIds || newData.member_ids || newData.memberids
        } as Team : null;

        if (payload.eventType === 'INSERT' && mapped) {
          setTeams(prev => {
            if (prev.find(t => t.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        } else if (payload.eventType === 'UPDATE' && mapped) {
          setTeams(prev => prev.map(t => t.id === mapped.id ? mapped : t));
        } else if (payload.eventType === 'DELETE') {
          setTeams(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe((status) => console.log('Status Canal Equipes:', status));

    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, (payload) => {
        const newData = payload.new as any;
        const mapped = newData ? {
          protocol: newData.protocol,
          responsibleId: newData.responsibleId || newData.responsible_id || newData.responsibleid,
          isTeam: newData.isTeam !== undefined ? newData.isTeam : (newData.is_team !== undefined ? newData.is_team : newData.isteam),
          openingDate: newData.openingDate || newData.opening_date || newData.openingdate,
          originalOpeningDate: newData.originalOpeningDate || newData.original_opening_date || newData.originalopeningdate,
          isDelayed: newData.isDelayed !== undefined ? newData.isDelayed : (newData.is_delayed !== undefined ? newData.is_delayed : newData.isdelayed),
          closingDate: newData.closingDate || newData.closing_date || newData.closingdate,
          status: newData.status,
          description: newData.description,
          observation: newData.observation
        } as ServiceOrder : null;

        if (payload.eventType === 'INSERT' && mapped) {
          setOrders(prev => {
            if (prev.find(o => o.protocol === mapped.protocol)) return prev;
            return [...prev, mapped];
          });
        } else if (payload.eventType === 'UPDATE' && mapped) {
          setOrders(prev => prev.map(o => o.protocol === mapped.protocol ? mapped : o));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.protocol !== payload.old.protocol));
        }
      })
      .subscribe((status) => console.log('Status Canal Ordens:', status));

    const slaChannel = supabase
      .channel('sla-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_sla' }, (payload) => {
        console.log('Evento SLA:', payload.eventType, payload.new);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const item = payload.new;
          setMonthlySla(prev => ({
            ...prev,
            [item.month]: {
              ...(prev[item.month] || {}),
              [item.tech_id]: item.value
            }
          }));
        } else if (payload.eventType === 'DELETE') {
          fetchData(false);
        }
      })
      .subscribe((status) => console.log('Status Canal SLA:', status));

    const conformityChannel = supabase
      .channel('conformity-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_conformity' }, (payload) => {
        console.log('Evento Conformity:', payload.eventType, payload.new);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const item = payload.new;
          setMonthlyConformity(prev => ({
            ...prev,
            [item.month]: {
              ...(prev[item.month] || {}),
              [item.tech_id]: item.value
            }
          }));
        } else if (payload.eventType === 'DELETE') {
          fetchData(false);
        }
      })
      .subscribe((status) => console.log('Status Canal Conformidade:', status));

    return () => {
      console.log('Limpando canais Realtime...');
      supabase.removeAllChannels();
    };
  }, [isOnline, fetchData]);

  // Sync with LocalStorage as backup
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('telecom_techs', JSON.stringify(technicians));
      localStorage.setItem('telecom_teams', JSON.stringify(teams));
      localStorage.setItem('telecom_orders', JSON.stringify(orders));
      localStorage.setItem('telecom_monthly_sla', JSON.stringify(monthlySla));
      localStorage.setItem('telecom_monthly_conformity', JSON.stringify(monthlyConformity));
    }
  }, [technicians, teams, orders, monthlySla, monthlyConformity, isLoading]);

  // Handlers with Supabase Sync
  const onAddOrder = async (order: ServiceOrder) => {
    setOrders(prev => [...prev, order]);
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Nova O.S. Criada',
      details: `Protocolo: ${order.protocol} | Responsável: ${order.responsibleId}`,
      category: 'O.S.'
    });
    try {
      const { error } = await supabase.from('service_orders').insert([{
        protocol: order.protocol,
        responsibleId: order.responsibleId,
        isTeam: order.isTeam,
        openingDate: order.openingDate,
        originalOpeningDate: order.originalOpeningDate,
        isDelayed: order.isDelayed,
        closingDate: order.closingDate,
        status: order.status,
        description: order.description,
        observation: order.observation
      }]);
      if (error) throw error;
    } catch (e: any) {
      console.error('Erro ao salvar O.S. no Supabase:', e);
      alert(`Erro Supabase: ${e.message}`);
    }
  };

  const onUpdateOrder = async (order: ServiceOrder) => {
    const oldOrder = orders.find(o => o.protocol === order.protocol);
    const statusChanged = oldOrder && oldOrder.status !== order.status;
    
    setOrders(prev => prev.map(o => o.protocol === order.protocol ? order : o));
    
    saveLog({
      username: user?.username || 'Sistema',
      action: statusChanged ? `O.S. Alterada para ${order.status}` : 'Dados da O.S. Editados',
      details: `Protocolo: ${order.protocol}`,
      category: 'O.S.'
    });
    
    try {
      const { error } = await supabase.from('service_orders').update({
        responsibleId: order.responsibleId,
        isTeam: order.isTeam,
        openingDate: order.openingDate,
        originalOpeningDate: order.originalOpeningDate,
        isDelayed: order.isDelayed,
        closingDate: order.closingDate,
        status: order.status,
        description: order.description,
        observation: order.observation
      }).eq('protocol', order.protocol);
      if (error) throw error;
    } catch (e: any) {
      console.error('Erro ao atualizar O.S. no Supabase:', e);
      alert(`Erro Supabase: ${e.message}`);
    }
  };

  const handleDeleteOrder = async (protocol: string) => {
    setOrders(prev => prev.filter(o => o.protocol !== protocol));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'O.S. Excluída',
      details: `Protocolo: ${protocol}`,
      category: 'O.S.'
    });
    await supabase.from('service_orders').delete().eq('protocol', protocol);
  };

  const handleAddTech = async (tech: Technician) => {
    setTechnicians(prev => [...prev, tech]);
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Técnico Adicionado',
      details: `Nome: ${tech.name} | Categoria: ${tech.category}`,
      category: 'Técnico'
    });
    const { error } = await supabase.from('technicians').insert([{
      id: tech.id,
      name: tech.name,
      role: tech.role,
      category: tech.category,
      fixedCommission: tech.fixedCommission || 0
    }]);
    if (error) alert(`Erro Supabase: ${error.message}`);
  };

  const handleUpdateTech = async (tech: Technician) => {
    setTechnicians(prev => prev.map(t => t.id === tech.id ? tech : t));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Dados do Técnico Editados',
      details: `Nome: ${tech.name} | Função: ${tech.role}`,
      category: 'Técnico'
    });
    const { error } = await supabase.from('technicians').update({
      name: tech.name,
      role: tech.role,
      category: tech.category,
      fixedCommission: tech.fixedCommission || 0
    }).eq('id', tech.id);
    if (error) alert(`Erro Supabase: ${error.message}`);
  };

  const handleDeleteTech = async (id: string) => {
    const tech = technicians.find(t => t.id === id);
    setTechnicians(prev => prev.filter(t => t.id !== id));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Técnico Excluído',
      details: `Nome: ${tech?.name || id}`,
      category: 'Técnico'
    });
    await supabase.from('technicians').delete().eq('id', id);
  };

  const handleAddTeam = async (team: Team) => {
    setTeams(prev => [...prev, team]);
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Equipe Criada',
      details: `Nome: ${team.name}`,
      category: 'Equipe'
    });
    const { error } = await supabase.from('teams').insert([{
      id: team.id,
      name: team.name,
      leaderId: team.leaderId,
      memberIds: team.memberIds
    }]);
    if (error) alert(`Erro Supabase: ${error.message}`);
  };

  const handleUpdateTeam = async (team: Team) => {
    setTeams(prev => prev.map(t => t.id === team.id ? team : t));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Dados da Equipe Editados',
      details: `Nome: ${team.name}`,
      category: 'Equipe'
    });
    const { error } = await supabase.from('teams').update({
      name: team.name,
      leaderId: team.leaderId,
      memberIds: team.memberIds
    }).eq('id', team.id);
    if (error) alert(`Erro Supabase: ${error.message}`);
  };

  const handleDeleteTeam = async (id: string) => {
    const team = teams.find(t => t.id === id);
    setTeams(prev => prev.filter(t => t.id !== id));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Equipe Excluída',
      details: `Nome: ${team?.name || id}`,
      category: 'Equipe'
    });
    await supabase.from('teams').delete().eq('id', id);
  };

  const handleUpdateSla = async (month: string, techId: string, value: number) => {
    const techName = technicians.find(t => t.id === techId)?.name || techId;
    setMonthlySla(prev => ({
      ...prev,
      [month]: {
        ...(prev[month] || {}),
        [techId]: value
      }
    }));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'SLA Atualizado',
      details: `Técnico: ${techName} | Mês: ${month} | Valor: ${value}%`,
      category: 'Sistema'
    });
    await supabase.from('monthly_sla').upsert({
      month,
      tech_id: techId,
      value
    }, { onConflict: 'month,tech_id' });
  };

  const handleUpdateConformity = async (month: string, techId: string, value: number) => {
    const techName = technicians.find(t => t.id === techId)?.name || techId;
    setMonthlyConformity(prev => ({
      ...prev,
      [month]: {
        ...(prev[month] || {}),
        [techId]: value
      }
    }));
    saveLog({
      username: user?.username || 'Sistema',
      action: 'Nota de Conformidade Atualizada',
      details: `Técnico: ${techName} | Mês: ${month} | Nota: ${value}`,
      category: 'Sistema'
    });
    await supabase.from('monthly_conformity').upsert({
      month,
      tech_id: techId,
      value
    }, { onConflict: 'month,tech_id' });
  };

  const saveLog = async (log: Omit<SystemLog, 'id' | 'created_at'>) => {
    try {
      await supabase.from('system_logs').insert([log]);
    } catch (err) {
      console.error('Erro ao salvar log:', err);
    }
  };

  const handleLogin = (userData: UserProfile) => {
    setUser(userData);
    localStorage.setItem('telecom_user', JSON.stringify(userData));
    saveLog({
      username: userData.username,
      action: 'Login no Sistema',
      details: `Usuário realizou login com nível ${userData.role}`,
      category: 'Sistema'
    });
  };

  const handleLogout = () => {
    if (user) {
      saveLog({
        username: user.username,
        action: 'Logout do Sistema',
        details: 'Usuário encerrou a sessão',
        category: 'Sistema'
      });
    }
    setUser(null);
    localStorage.removeItem('telecom_user');
  };

  const handleResetData = async () => {
    setIsLoading(true);
    try {
      await saveLog({
        username: user?.username || 'Sistema',
        action: 'Reset de Fábrica',
        details: 'Usuário solicitou redefinição total dos dados do sistema',
        category: 'Sistema'
      });
      // Clear Supabase tables
      await supabase.from('monthly_sla').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
      await supabase.from('monthly_conformity').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
      await supabase.from('service_orders').delete().neq('protocol', ''); 
      await supabase.from('teams').delete().neq('id', ''); 
      await supabase.from('technicians').delete().neq('id', ''); 

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

  const handleSaveBackup = async () => {
    try {
      const backupData = {
        technicians,
        teams,
        orders,
        monthlySla,
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from('system_backups')
        .insert([{ data: backupData }]);

      if (error) {
        if (error.message.includes('relation "system_backups" does not exist')) {
          alert('A tabela "system_backups" não existe. Por favor, execute o script SQL atualizado no botão "Configurar Banco".');
        } else {
          throw error;
        }
        return;
      }

      saveLog({
        username: user?.username || 'Sistema',
        action: 'Backup Realizado',
        details: 'Novo ponto de restauração criado manualmente',
        category: 'Sistema'
      });

      alert('Backup realizado com sucesso!');
    } catch (error) {
      console.error('Error saving backup:', error);
      alert('Erro ao salvar backup no Supabase.');
    }
  };

  const handleRestoreBackup = async () => {
    if (!confirm('Tem certeza que deseja restaurar o último backup? Isso substituirá todos os dados atuais.')) return;

    setIsLoading(true);
    try {
      const { data: backupList, error: fetchError } = await supabase
        .from('system_backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!backupList || backupList.length === 0) {
        alert('Nenhum backup encontrado.');
        return;
      }

      const backup = backupList[0].data;

      await saveLog({
        username: user?.username || 'Sistema',
        action: 'Restauração de Backup',
        details: `Dados restaurados do ponto: ${backup.timestamp || 'N/A'}`,
        category: 'Sistema'
      });

      // Clear current data first
      await supabase.from('monthly_sla').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('service_orders').delete().neq('protocol', '');
      await supabase.from('teams').delete().neq('id', '');
      await supabase.from('technicians').delete().neq('id', '');

      // Restore data
      if (backup.technicians.length > 0) await supabase.from('technicians').insert(backup.technicians);
      if (backup.teams.length > 0) await supabase.from('teams').insert(backup.teams);
      if (backup.orders.length > 0) await supabase.from('service_orders').insert(backup.orders);
      
      const slaEntries: any[] = [];
      Object.entries(backup.monthlySla).forEach(([month, techs]: [string, any]) => {
        Object.entries(techs).forEach(([techId, value]: [string, any]) => {
          slaEntries.push({ month, tech_id: techId, value });
        });
      });
      if (slaEntries.length > 0) await supabase.from('monthly_sla').insert(slaEntries);

      alert('Backup restaurado com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('Erro ao restaurar backup. Verifique se a tabela "system_backups" existe.');
    } finally {
      setIsLoading(false);
    }
  };

  const onForceSync = async () => {
    setIsLoading(true);
    try {
      const savedTechs = JSON.parse(localStorage.getItem('telecom_techs') || '[]');
      const savedTeams = JSON.parse(localStorage.getItem('telecom_teams') || '[]');
      const savedOrders = JSON.parse(localStorage.getItem('telecom_orders') || '[]');
      const savedSla = JSON.parse(localStorage.getItem('telecom_monthly_sla') || '{}');
      
      await migrateToSupabase(savedTechs, savedTeams, savedOrders, savedSla);
      alert('Sincronização concluída com sucesso!');
      await fetchData(true);
    } catch (e) {
      console.error('Forced sync failed:', e);
      alert('Erro na sincronização forçada.');
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchData(true)}
              className="hidden md:flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 h-8 text-[10px] font-bold uppercase"
            >
              <RefreshCcw className="w-3 h-3" /> Sincronizar
            </Button>
            {dbError && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-600 uppercase">
                <AlertCircle className="w-3 h-3" />
                {dbError.length > 40 ? dbError.substring(0, 40) + '...' : dbError}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border text-[10px] font-bold uppercase tracking-wider">
              {isOnline ? (
                <>
                  <Cloud className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600">Supabase Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-rose-500" />
                  <span className="text-rose-600">Sincronização Offline</span>
                </>
              )}
            </div>
            {isOnline && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-600 uppercase">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Tempo Real OK
              </div>
            )}
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
            <TabsList className={`grid w-full ${user.role === 'admin' ? 'max-w-2xl grid-cols-5' : (user.role === 'operator' ? 'max-w-xl grid-cols-3' : 'max-w-md grid-cols-3')} bg-white border shadow-sm`}>
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
                <>
                  <TabsTrigger value="logs" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                    <ClipboardList className="w-4 h-4 mr-2" /> Logs
                  </TabsTrigger>
                  <TabsTrigger value="users" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                    <Shield className="w-4 h-4 mr-2" /> Usuários
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <Dashboard 
              orders={orders} 
              technicians={technicians} 
              teams={teams}
              onAddOrder={onAddOrder}
              onUpdateOrder={onUpdateOrder}
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
              onSaveBackup={handleSaveBackup}
              onRestoreBackup={handleRestoreBackup}
              onForceSync={onForceSync}
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
              monthlyConformity={monthlyConformity}
              onUpdateConformity={handleUpdateConformity}
              currentMonth={format(new Date(), 'yyyy-MM')}
              userRole={user.role}
            />
          </TabsContent>

          {user.role === 'admin' && (
            <TabsContent value="logs" className="mt-0 focus-visible:outline-none">
              <SystemLogs />
            </TabsContent>
          )}

          {user.role === 'admin' && (
            <TabsContent value="users" className="mt-0 focus-visible:outline-none">
              <UserManagement onLog={saveLog} currentUser={user} />
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

