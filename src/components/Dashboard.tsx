import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ServiceOrder, Technician, Team, Status, UserRole } from '@/src/types';
import MonthlySpreadsheet from './MonthlySpreadsheet';
import { Plus, Edit2, Trash2, CheckCircle2, Clock, XCircle, PlayCircle, BarChart3, ArrowRightCircle, AlertTriangle, Lock, CalendarDays } from 'lucide-react';
import { format, parseISO, isSameMonth, addDays, getHours } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  orders: ServiceOrder[];
  technicians: Technician[];
  teams: Team[];
  onAddOrder: (order: ServiceOrder) => void;
  onUpdateOrder: (order: ServiceOrder) => void;
  onDeleteOrder: (protocol: string) => void;
  userRole: UserRole;
}

export default function Dashboard({ orders, technicians, teams, onAddOrder, onUpdateOrder, onDeleteOrder, userRole }: DashboardProps) {
  const isAdmin = userRole === 'admin';
  const canManageOS = isAdmin || userRole === 'operator';
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [selectedResponsible, setSelectedResponsible] = useState<{ id: string, name: string, date?: string } | null>(null);

  // Form State
  const [protocol, setProtocol] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [status, setStatus] = useState<Status>('Aberta');
  const [openingDate, setOpeningDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [closingDate, setClosingDate] = useState('');
  const [description, setDescription] = useState('');
  const [observation, setObservation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const getResponsibleName = (id: string) => {
    const tech = technicians.find(t => t.id === id);
    if (tech) return tech.name;
    const team = teams.find(t => t.id === id);
    if (team) {
      const members = team.memberIds
        .map(mId => technicians.find(t => t.id === mId)?.name)
        .filter(Boolean)
        .join(', ');
      return { name: `Equipe: ${team.name}`, members };
    }
    return { name: 'Não atribuído', members: '' };
  };

  const getStatusBadge = (status: Status) => {
    switch (status) {
      case 'Concluída': return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluída</Badge>;
      case 'Em Execução': return <Badge className="bg-purple-500 hover:bg-purple-600"><PlayCircle className="w-3 h-3 mr-1" /> Em Execução</Badge>;
      case 'Aberta': return <Badge className="bg-amber-500 hover:bg-amber-600"><Clock className="w-3 h-3 mr-1" /> Aberta</Badge>;
      case 'Cancelada': return <Badge className="bg-rose-500 hover:bg-rose-600"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order.openingDate) return false;
      try {
        const date = parseISO(order.openingDate);
        if (isNaN(date.getTime())) return false;
        
        const originalDate = order.originalOpeningDate ? parseISO(order.originalOpeningDate) : null;
        const closingDate = order.closingDate ? parseISO(order.closingDate) : null;
        
        const currentMonthMatch = format(date, 'yyyy-MM') === filterMonth;
        const originalMonthMatch = (originalDate && !isNaN(originalDate.getTime())) ? format(originalDate, 'yyyy-MM') === filterMonth : false;
        const closingMonthMatch = (closingDate && !isNaN(closingDate.getTime())) ? format(closingDate, 'yyyy-MM') === filterMonth : false;
        
        return currentMonthMatch || originalMonthMatch || closingMonthMatch;
      } catch (e) {
        return false;
      }
    });
  }, [orders, filterMonth]);

  const stats = useMemo(() => {
    // For statistical calculation, we only count orders that were either:
    // 1. Scheduled for this month and NOT moved away without delay
    // 2. Closed this month
    const validOrdersForStats = filteredOrders.filter(o => {
      const isOriginalInMonth = o.originalOpeningDate && format(parseISO(o.originalOpeningDate), 'yyyy-MM') === filterMonth;
      const isScheduledInMonth = format(parseISO(o.openingDate), 'yyyy-MM') === filterMonth;
      const isMovedAwayWithoutDelay = isOriginalInMonth && !isScheduledInMonth && !o.isDelayed;
      
      // Also, if moved WITHIN the month but without delay, it shouldn't count in the total twice 
      // but filteredOrders already handles unique orders.
      // The key is: if it's moved from TODAY to TOMORROW (both in April) without delay, 
      // the daily summary handles it (removes from total of today).
      // For the MONTHLY total, it should still count as 1 O.S. (the one it's currently scheduled for).
      
      return !isMovedAwayWithoutDelay;
    });

    const total = validOrdersForStats.length;
    const completed = validOrdersForStats.filter(o => o.status === 'Concluída').length;
    const inProgress = validOrdersForStats.filter(o => o.status === 'Em Execução').length;
    const open = validOrdersForStats.filter(o => o.status === 'Aberta').length;
    const cancelled = validOrdersForStats.filter(o => o.status === 'Cancelada').length;
    const delayed = validOrdersForStats.filter(o => o.isDelayed).length;
    const rate = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, inProgress, open, cancelled, delayed, rate };
  }, [filteredOrders, filterMonth]);

  const responsibleSummary = useMemo(() => {
    const summary: Record<string, Record<string, { total: number, completed: number, remaining: number, moved: number, delayed: number }>> = {};
    
    filteredOrders.forEach(order => {
      const datesToProcess = new Set<string>();
      if (order.openingDate) datesToProcess.add(order.openingDate);
      if (order.originalOpeningDate) datesToProcess.add(order.originalOpeningDate);
      if (order.closingDate && order.status === 'Concluída') datesToProcess.add(order.closingDate);

      datesToProcess.forEach(date => {
        try {
          const parsedDate = parseISO(date);
          if (isNaN(parsedDate.getTime())) return;

          if (format(parsedDate, 'yyyy-MM') === filterMonth) {
            if (!summary[date]) summary[date] = {};
            if (!summary[date][order.responsibleId]) {
              summary[date][order.responsibleId] = { total: 0, completed: 0, remaining: 0, moved: 0, delayed: 0 };
            }

            const isOriginalDay = date === order.originalOpeningDate && date !== order.openingDate;
            const isClosingDay = date === order.closingDate && order.status === 'Concluída';
            const isScheduledDay = date === order.openingDate;

            // Increment total if it's the day it's scheduled OR the day it was finished.
            // If it was MOVED AWAY from this day (isOriginalDay), it only counts in the total
            // if it was a delay (order.isDelayed). If it was an imprevisto/sem prejuízo, 
            // it is removed from this day's workload to keep productivity at 100%.
            const shouldCountInTotal = isScheduledDay || isClosingDay || (isOriginalDay && order.isDelayed);

            if (shouldCountInTotal) {
              summary[date][order.responsibleId].total++;
            }

            if (isClosingDay) {
              summary[date][order.responsibleId].completed++;
            } else if (isScheduledDay && order.status !== 'Concluída' && order.status !== 'Cancelada') {
              summary[date][order.responsibleId].remaining++;
            }

            if (isScheduledDay && order.isDelayed) {
              summary[date][order.responsibleId].delayed++;
            }

            if (isOriginalDay) {
              summary[date][order.responsibleId].moved++;
            }
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
    });

    const result: any[] = [];
    Object.entries(summary).forEach(([date, responsibles]) => {
      Object.entries(responsibles).forEach(([id, data]) => {
        const respInfo = getResponsibleName(id);
        result.push({
          date,
          id,
          name: typeof respInfo === 'string' ? respInfo : respInfo.name,
          members: typeof respInfo === 'string' ? '' : respInfo.members,
          ...data,
          percentage: data.total > 0 ? (data.completed / data.total) * 100 : 0
        });
      });
    });

    return result.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.total - a.total;
    });
  }, [filteredOrders, technicians, teams, filterMonth]);

  const chartData = useMemo(() => {
    return [
      { name: 'Concluídas', value: stats.completed, color: '#10b981' },
      { name: 'Atrasadas', value: stats.delayed, color: '#ef4444' },
      { name: 'Em Execução', value: stats.inProgress, color: '#9333ea' },
      { name: 'Abertas', value: stats.open, color: '#f59e0b' },
      { name: 'Canceladas', value: stats.cancelled, color: '#64748b' },
    ];
  }, [stats]);

  const handleSave = () => {
    // Check for duplicate protocol
    const isDuplicate = orders.some(o => o.protocol === protocol && (!editingOrder || o.protocol !== editingOrder.protocol));
    if (isDuplicate) {
      setFormError(`O protocolo ${protocol} já existe no sistema.`);
      return;
    }

    setFormError(null);
    const isTeam = teams.some(t => t.id === responsibleId);
    let finalOpeningDate = openingDate;
    let isDelayed = editingOrder?.isDelayed || false;
    let originalOpeningDate = editingOrder?.originalOpeningDate;

    const order: ServiceOrder = {
      protocol,
      responsibleId,
      isTeam,
      openingDate: finalOpeningDate,
      originalOpeningDate,
      isDelayed,
      closingDate: status === 'Concluída' ? (closingDate || openingDate) : undefined,
      status,
      description,
      observation
    };

    if (editingOrder) {
      onUpdateOrder(order);
    } else {
      onAddOrder(order);
    }
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setProtocol('');
    setResponsibleId('');
    setStatus('Aberta');
    setOpeningDate(format(new Date(), 'yyyy-MM-dd'));
    setClosingDate('');
    setDescription('');
    setObservation('');
    setEditingOrder(null);
    setFormError(null);
  };

  const handleEdit = (order: ServiceOrder) => {
    setEditingOrder(order);
    setProtocol(order.protocol);
    setResponsibleId(order.responsibleId);
    setStatus(order.status);
    setOpeningDate(order.openingDate);
    setClosingDate(order.closingDate || '');
    setDescription(order.description);
    setObservation(order.observation || '');
    setIsDialogOpen(true);
  };

  const handleQuickClose = (order: ServiceOrder) => {
    const updatedOrder: ServiceOrder = {
      ...order,
      status: 'Concluída',
      closingDate: order.openingDate
    };

    onUpdateOrder(updatedOrder);
  };

  const handleMoveToNextDay = (order: ServiceOrder) => {
    const nextDay = format(addDays(parseISO(order.openingDate), 1), 'yyyy-MM-dd');
    onUpdateOrder({
      ...order,
      openingDate: nextDay,
      originalOpeningDate: order.originalOpeningDate || order.openingDate,
      isDelayed: true
    });
  };

  const handleMoveWithoutPrejudice = (order: ServiceOrder) => {
    const nextDay = format(addDays(parseISO(order.openingDate), 1), 'yyyy-MM-dd');
    onUpdateOrder({
      ...order,
      openingDate: nextDay,
      originalOpeningDate: order.originalOpeningDate || order.openingDate,
      isDelayed: false
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Operacional</h2>
          <p className="text-muted-foreground">Gerencie suas ordens de serviço e acompanhe a performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-40"
          />
          {canManageOS ? (
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
              <DialogTrigger render={<Button className="bg-purple-600 hover:bg-purple-700" />}>
                <Plus className="w-4 h-4 mr-2" /> Nova O.S.
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
                <DialogHeader className="bg-purple-600 text-white p-6">
                  <DialogTitle className="text-white">{editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 p-6">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="protocol" className="text-right">Protocolo</Label>
                    <Input id="protocol" value={protocol} onChange={(e) => setProtocol(e.target.value)} className="col-span-3" placeholder="Ex: OS-2024-001" disabled={!!editingOrder} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="responsible" className="text-right">Responsável</Label>
                    <Select value={responsibleId} onValueChange={setResponsibleId}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione um técnico ou equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Técnicos</div>
                        {technicians.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Equipes</div>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>Equipe: {t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Select value={status} onValueChange={(v: Status) => setStatus(v)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aberta">Aberta</SelectItem>
                        <SelectItem value="Em Execução">Em Execução</SelectItem>
                        <SelectItem value="Concluída">Concluída</SelectItem>
                        <SelectItem value="Cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="openingDate" className="text-right">Abertura</Label>
                    <Input id="openingDate" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="col-span-3" />
                  </div>
                  {status === 'Concluída' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="closingDate" className="text-right">Fechamento</Label>
                      <Input id="closingDate" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="col-span-3" />
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Descrição</Label>
                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="Detalhes do serviço..." />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="observation" className="text-right">Observação</Label>
                    <Input id="observation" value={observation} onChange={(e) => setObservation(e.target.value)} className="col-span-3" placeholder="Observações adicionais..." />
                  </div>
                  {formError && (
                    <div className="col-span-4 flex items-center gap-2 p-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded">
                      <AlertTriangle className="w-4 h-4" />
                      {formError}
                    </div>
                  )}
                </div>
                <DialogFooter className="p-6 pt-0">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium border border-slate-200">
              <Lock className="w-3 h-3" /> Somente Visualização
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de O.S.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">O.S. Atrasadas (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{stats.delayed}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-purple-100 bg-purple-100/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-purple-700">
              <Plus className="w-5 h-5" /> Abertura de O.S.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManageOS && (
              <div className="p-3 bg-white border border-purple-100 text-purple-600 rounded-lg text-xs flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4" /> Acesso restrito.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quick-protocol" className="text-xs font-bold uppercase text-slate-500">Protocolo</Label>
              <Input 
                id="quick-protocol" 
                value={protocol} 
                onChange={(e) => setProtocol(e.target.value)} 
                placeholder="Ex: OS-2024-001" 
                className="bg-white"
                disabled={!canManageOS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-responsible" className="text-xs font-bold uppercase text-slate-500">Responsável</Label>
              <Select value={responsibleId} onValueChange={setResponsibleId} disabled={!canManageOS}>
                <SelectTrigger id="quick-responsible" className="bg-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Técnicos</div>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Equipes</div>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>Equipe: {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-date" className="text-xs font-bold uppercase text-slate-500">Data de Abertura</Label>
              <Input 
                id="quick-date" 
                type="date"
                value={openingDate} 
                onChange={(e) => setOpeningDate(e.target.value)} 
                className="bg-white"
                disabled={!canManageOS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-desc" className="text-xs font-bold uppercase text-slate-500">Descrição</Label>
              <Input 
                id="quick-desc" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Detalhes..." 
                className="bg-white"
                disabled={!canManageOS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-obs" className="text-xs font-bold uppercase text-slate-500">Observação</Label>
              <Input 
                id="quick-obs" 
                value={observation} 
                onChange={(e) => setObservation(e.target.value)} 
                placeholder="Obs..." 
                className="bg-white"
                disabled={!canManageOS}
              />
            </div>
            {formError && (
              <div className="flex items-center gap-2 p-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded">
                <AlertTriangle className="w-3 h-3" />
                {formError}
              </div>
            )}
            <Button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-700 mt-2" disabled={!canManageOS}>
              Abrir Ordem de Serviço
            </Button>
            <p className="text-[10px] text-center text-slate-400 italic">
              A O.S. será aberta com status "Aberta" e data de hoje por padrão.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" /> Resumo por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[100px] bg-muted/50">Data</TableHead>
                    <TableHead className="bg-muted/50">Responsável / Membros</TableHead>
                    <TableHead className="text-center bg-muted/50">Total O.S.</TableHead>
                    <TableHead className="text-center bg-muted/50">Concluídas</TableHead>
                    <TableHead className="text-center bg-muted/50">Movidas</TableHead>
                    <TableHead className="text-center bg-muted/50">Atrasos</TableHead>
                    <TableHead className="text-center bg-muted/50">Restantes</TableHead>
                    <TableHead className="text-center bg-muted/50">% Prod.</TableHead>
                    <TableHead className="text-right bg-muted/50">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsibleSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhuma atividade registrada para este mês.
                      </TableCell>
                    </TableRow>
                  ) : (
                    responsibleSummary.map((item, index) => (
                      <TableRow 
                        key={`${item.date}-${item.id}-${index}`} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedResponsible({ id: item.id, name: item.name, date: item.date })}
                      >
                        <TableCell className="text-xs font-medium">
                          {(() => {
                            try {
                              const d = parseISO(item.date);
                              return isNaN(d.getTime()) ? item.date : format(d, 'dd/MM');
                            } catch (e) {
                              return item.date;
                            }
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{item.name}</span>
                            {item.members && (
                              <span className="text-[10px] text-muted-foreground italic">
                                Membros: {item.members}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold">{item.total}</TableCell>
                        <TableCell className="text-center text-emerald-600 font-bold">{item.completed}</TableCell>
                        <TableCell className="text-center text-indigo-600 font-bold">{item.moved}</TableCell>
                        <TableCell className="text-center text-rose-600 font-bold">{item.delayed}</TableCell>
                        <TableCell className="text-center text-amber-600 font-bold">{item.remaining}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-bold ${item.percentage >= 100 ? 'text-emerald-600' : item.percentage > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
                              {Math.round(item.percentage)}%
                            </span>
                            <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${item.percentage >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-purple-600">
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Responsible Details Dialog */}
      <Dialog open={!!selectedResponsible} onOpenChange={(open) => !open && setSelectedResponsible(null)}>
        <DialogContent className="sm:max-w-[1000px] max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" /> Detalhes: {selectedResponsible?.name} 
              {selectedResponsible?.date && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({(() => {
                    try {
                      const d = parseISO(selectedResponsible.date);
                      return isNaN(d.getTime()) ? selectedResponsible.date : format(d, 'dd/MM/yyyy');
                    } catch (e) {
                      return selectedResponsible.date;
                    }
                  })()})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedResponsible && (
            <div className="grid grid-cols-3 gap-4 mb-2">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center">
                <p className="text-[10px] text-purple-600 uppercase font-bold">{selectedResponsible.date ? 'Total (Dia)' : 'Total (Mês)'}</p>
                <p className="text-xl font-bold text-purple-700">
                  {filteredOrders.filter(o => o.responsibleId === selectedResponsible.id && (!selectedResponsible.date || o.openingDate === selectedResponsible.date)).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                <p className="text-[10px] text-emerald-600 uppercase font-bold">Concluídas</p>
                <p className="text-xl font-bold text-emerald-700">
                  {filteredOrders.filter(o => 
                    o.responsibleId === selectedResponsible.id && 
                    o.status === 'Concluída' && 
                    (!selectedResponsible.date || o.closingDate === selectedResponsible.date)
                  ).length}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-center">
                <p className="text-[10px] text-indigo-600 uppercase font-bold">Movidas</p>
                <p className="text-xl font-bold text-indigo-700">
                  {selectedResponsible.date ? 
                    filteredOrders.filter(o => o.responsibleId === selectedResponsible.id && o.originalOpeningDate === selectedResponsible.date && o.openingDate !== selectedResponsible.date).length : 
                    filteredOrders.filter(o => o.responsibleId === selectedResponsible.id && o.originalOpeningDate && o.originalOpeningDate !== o.openingDate).length
                  }
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
                <p className="text-[10px] text-amber-600 uppercase font-bold">Restantes</p>
                <p className="text-xl font-bold text-amber-700">
                  {filteredOrders.filter(o => o.responsibleId === selectedResponsible.id && o.status !== 'Concluída' && o.status !== 'Cancelada' && (!selectedResponsible.date || o.openingDate === selectedResponsible.date)).length}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-auto py-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedResponsible && filteredOrders
                    .filter(o => o.responsibleId === selectedResponsible.id && (
                      !selectedResponsible.date || 
                      o.openingDate === selectedResponsible.date || 
                      o.originalOpeningDate === selectedResponsible.date ||
                      (o.status === 'Concluída' && o.closingDate === selectedResponsible.date)
                    ))
                    .map((order) => {
                      const isMovedFromThisDay = selectedResponsible.date && 
                                               order.originalOpeningDate === selectedResponsible.date && 
                                               order.openingDate !== selectedResponsible.date;
                      
                      return (
                        <TableRow key={order.protocol} className={isMovedFromThisDay ? "bg-indigo-50/50" : ""}>
                          <TableCell className="font-mono text-xs font-medium">
                            <div className="flex items-center gap-2">
                              {order.protocol}
                              {isMovedFromThisDay && <Badge variant="outline" className="text-[8px] h-4 bg-indigo-100 text-indigo-700 border-indigo-200">MOVIDA</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className={isMovedFromThisDay ? "text-indigo-600 font-bold" : ""}>
                                {(() => {
                                  try {
                                    const d = parseISO(order.openingDate);
                                    return isNaN(d.getTime()) ? order.openingDate : format(d, 'dd/MM/yyyy');
                                  } catch (e) {
                                    return order.openingDate;
                                  }
                                })()}
                              </span>
                              {order.isDelayed && (
                                <span className="text-[8px] text-rose-500 font-bold">ATRASADA</span>
                              )}
                              {isMovedFromThisDay && order.originalOpeningDate && (
                                <span className="text-[8px] text-indigo-500 font-medium italic">
                                  Original: {(() => {
                                    try {
                                      const d = parseISO(order.originalOpeningDate);
                                      return isNaN(d.getTime()) ? order.originalOpeningDate : format(d, 'dd/MM');
                                    } catch (e) {
                                      return order.originalOpeningDate;
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                            {order.description}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-[250px] whitespace-normal">
                            {order.observation || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5 min-w-[160px]">
                              {canManageOS && (
                                <>
                                  {isAdmin && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.protocol); }} 
                                      className="h-8 w-8 text-rose-600"
                                      title="Excluir O.S."
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {order.status !== 'Concluída' && !isMovedFromThisDay && (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={(e) => { e.stopPropagation(); handleQuickClose(order); }} 
                                        className="h-8 w-8 text-emerald-600"
                                        title="Concluir O.S."
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={(e) => { e.stopPropagation(); handleMoveWithoutPrejudice(order); }} 
                                        className="h-8 w-8 text-blue-600"
                                        title="Remarcar p/ amanhã (SEM ATRASO - Imprevisto)"
                                      >
                                        <CalendarDays className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={(e) => { e.stopPropagation(); handleMoveToNextDay(order); }} 
                                        className="h-8 w-8 text-amber-600"
                                        title="Mover para amanhã (COM ATRASO)"
                                      >
                                        <ArrowRightCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(order); }} className="h-8 w-8 text-purple-600">
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6">
        <MonthlySpreadsheet 
          technicians={technicians}
          teams={teams}
          orders={orders}
          onUpdateOrder={onUpdateOrder}
          onDeleteOrder={onDeleteOrder}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Performance Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aproveitamento da Operação</span>
                <span className="font-medium">{stats.rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${stats.rate >= 95 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(stats.rate, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
