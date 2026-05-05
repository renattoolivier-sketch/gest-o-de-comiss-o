import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Technician, Team, ServiceOrder, CommissionResult, UserRole, TechCategory } from '@/src/types';
import { Calculator, TrendingUp, Award, AlertCircle, DollarSign, Info, User, Search } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommissionsProps {
  technicians: Technician[];
  teams: Team[];
  orders: ServiceOrder[];
  monthlySla: Record<string, Record<string, number>>;
  onUpdateSla: (month: string, techId: string, value: number) => void;
  monthlyConformity: Record<string, Record<string, number>>;
  onUpdateConformity: (month: string, techId: string, value: number) => void;
  currentMonth: string; // yyyy-MM
  userRole?: UserRole;
}

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: ptBR })
    });
  }
  return options;
};

export default function Commissions({ 
  technicians, teams, orders, 
  monthlySla, onUpdateSla, 
  monthlyConformity, onUpdateConformity,
  currentMonth: initialMonth, userRole 
}: CommissionsProps) {
  const isAdmin = userRole === 'admin';
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const commissionData = useMemo(() => {
    const results: CommissionResult[] = [];
    const monthSlas = monthlySla[selectedMonth] || {};
    const monthConfs = monthlyConformity[selectedMonth] || {};

    technicians.forEach(tech => {
      // Find teams this tech belongs to
      const techTeamsDetailed = teams.filter(t => t.memberIds.includes(tech.id));
      const techTeamsIds = techTeamsDetailed.map(t => t.id);
      
      // Filter ALL orders for this tech/team
      const techOrders = orders.filter(o => 
        o.responsibleId === tech.id || techTeamsIds.includes(o.responsibleId)
      );

      // Group by day to calculate daily productivity
      const dailyStats: Record<string, { total: number, completed: number }> = {};
      
      techOrders.forEach(order => {
        const datesToProcess = new Set<string>();
        if (order.openingDate) datesToProcess.add(order.openingDate);
        if (order.originalOpeningDate) datesToProcess.add(order.originalOpeningDate);
        if (order.closingDate && order.status === 'Concluída') datesToProcess.add(order.closingDate);

        datesToProcess.forEach(dateStr => {
          try {
            const date = parseISO(dateStr);
            if (isNaN(date.getTime())) return;
            if (format(date, 'yyyy-MM') === selectedMonth) {
              if (!dailyStats[dateStr]) dailyStats[dateStr] = { total: 0, completed: 0 };
              const isScheduledDay = dateStr === order.openingDate;
              const isClosingDay = dateStr === order.closingDate && order.status === 'Concluída';
              const isOriginalDay = dateStr === order.originalOpeningDate && dateStr !== order.openingDate;
              if (isScheduledDay || isClosingDay || (isOriginalDay && order.isDelayed)) {
                dailyStats[dateStr].total++;
              }
              if (isClosingDay) dailyStats[dateStr].completed++;
            }
          } catch (e) {}
        });
      });

      const daysWorkedList = Object.keys(dailyStats).sort();
      let totalDailyPercentage = 0;
      daysWorkedList.forEach(day => {
        const { total, completed } = dailyStats[day];
        totalDailyPercentage += total > 0 ? (completed / total) * 100 : 0;
      });

      const monthOrders = techOrders.filter(o => {
        const opDate = parseISO(o.openingDate);
        const clDate = o.closingDate ? parseISO(o.closingDate) : null;
        return format(opDate, 'yyyy-MM') === selectedMonth || (clDate && format(clDate, 'yyyy-MM') === selectedMonth);
      });

      const openOS = monthOrders.length;
      const closedOS = monthOrders.filter(o => o.status === 'Concluída' && o.closingDate && format(parseISO(o.closingDate), 'yyyy-MM') === selectedMonth).length;
      const delayedOS = monthOrders.filter(o => o.isDelayed).length;
      const productivity = daysWorkedList.length > 0 ? totalDailyPercentage / daysWorkedList.length : 0;
      const sla = monthSlas[tech.id] ?? 100;
      const conformity = monthConfs[tech.id] ?? 10;
// ... (rest remains similar but use selectedMonth)

      // NEW CALCULATION LOGIC
      if (tech.category === 'Manutenção') {
        const fixed = tech.fixedCommission || 400;
        results.push({
          technicianId: tech.id,
          technicianName: tech.name,
          category: tech.category,
          openOS,
          closedOS,
          delayedOS,
          daysWorked: daysWorkedList.length,
          productivity: 0,
          sla: 0,
          conformity: 0,
          osBonus: fixed,
          slaBonus: 0,
          conformityBonus: 0,
          weightedOS: fixed,
          weightedSLA: 0,
          weightedConformity: 0,
          totalTeamCommission: fixed,
          finalCommission: fixed
        });
        return;
      }

      const getTierValue = (val: number, type: 'OS' | 'SLA' | 'CONF', cat: TechCategory) => {
        // Updated tiers based on category
        const tiers = cat === 'Rede' ? [500, 1000, 1500] : [250, 450, 650];
        
        if (type === 'OS') {
          if (val < 80) return 0;
          if (val < 85) return tiers[0];
          if (val < 95) return tiers[1];
          return tiers[2];
        }
        if (type === 'SLA') {
          if (val < 90) return 0;
          if (val < 94) return tiers[0];
          if (val < 98) return tiers[1];
          return tiers[2];
        }
        if (type === 'CONF') {
          if (val < 8) return 0;
          if (val < 8.5) return tiers[0];
          if (val < 9) return tiers[1];
          return tiers[2];
        }
        return 0;
      };

      const osBonus = getTierValue(productivity, 'OS', tech.category);
      const slaBonus = getTierValue(sla, 'SLA', tech.category);
      const conformityBonus = getTierValue(conformity, 'CONF', tech.category);

      const weightedOS = osBonus * 0.6;
      const weightedSLA = slaBonus * 0.25;
      const weightedConformity = conformityBonus * 0.15;
      
      const totalTeamCommission = weightedOS + weightedSLA + weightedConformity;
      
      // If in team, check if result is shared? 
      // User says: "Essa seria a comissão da equipe, divide por dois e seria 475 reais para cada."
      // We assume tech primarily works in their main team if assigned.
      const currentTeam = techTeamsDetailed[0];
      const divisor = currentTeam ? currentTeam.memberIds.length : 1;
      const finalCommission = totalTeamCommission / divisor;

      results.push({
        technicianId: tech.id,
        technicianName: tech.name,
        category: tech.category,
        openOS,
        closedOS,
        delayedOS,
        daysWorked: daysWorkedList.length,
        productivity,
        sla,
        conformity,
        osBonus,
        slaBonus,
        conformityBonus,
        weightedOS,
        weightedSLA,
        weightedConformity,
        totalTeamCommission,
        finalCommission
      });
    });

    return results;
  }, [technicians, teams, orders, selectedMonth, monthlySla, monthlyConformity]);

  const totals = useMemo(() => {
    const comDataForAvg = commissionData.filter(c => c.category !== 'Manutenção');
    return {
      totalCommission: commissionData.reduce((acc, curr) => acc + curr.finalCommission, 0),
      avgProductivity: comDataForAvg.length > 0 
        ? comDataForAvg.reduce((acc, curr) => acc + curr.productivity, 0) / comDataForAvg.length 
        : 0,
      eligibleCount: commissionData.filter(c => c.finalCommission > 0).length
    };
  }, [commissionData]);

  const selectedData = useMemo(() => {
    return commissionData.find(d => d.technicianId === selectedTechId) || null;
  }, [commissionData, selectedTechId]);

  const getProductivityColor = (prod: number) => {
    if (prod >= 95) return 'text-emerald-600 font-bold';
    if (prod >= 85) return 'text-purple-600 font-bold';
    if (prod >= 70) return 'text-amber-600 font-bold';
    return 'text-rose-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cálculo de Comissões</h2>
          <p className="text-muted-foreground">Resultados financeiros baseados em produtividade e SLA.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1 rounded-lg border dark:border-slate-800 shadow-sm">
          {monthOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedMonth(opt.value)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                selectedMonth === opt.value 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-purple-600 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Total a Pagar (Comissões)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="w-8 h-8" />
              R$ {(totals.totalCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Média de Produtividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 dark:text-white">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              {totals.avgProductivity.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Técnicos Comissionados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 dark:text-white">
              <Award className="w-6 h-6 text-amber-500" />
              {totals.eligibleCount} / {technicians.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Resumo de Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50 dark:bg-slate-800">
                <TableRow className="dark:border-slate-800">
                  <TableHead className="dark:text-slate-300">Técnico</TableHead>
                  <TableHead className="text-center dark:text-slate-300">Categoria</TableHead>
                  <TableHead className="text-center dark:text-slate-300">Produtividade (60%)</TableHead>
                  <TableHead className="text-center dark:text-slate-300">SLA (25%)</TableHead>
                  <TableHead className="text-center dark:text-slate-300">Conf (15%)</TableHead>
                  <TableHead className="text-right dark:text-slate-300">Comissão Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionData.map((data) => (
                  <TableRow key={data.technicianId} className="dark:border-slate-800">
                    <TableCell>
                      <button 
                        onClick={() => setSelectedTechId(data.technicianId)}
                        className="text-left group"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                          {data.technicianName}
                        </div>
                        <div className="text-[10px] text-muted-foreground dark:text-slate-500 flex items-center gap-1">
                          <Search className="w-2 h-2" /> Clique para ver o detalhamento
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase dark:text-slate-400 dark:border-slate-700">{data.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {data.category === 'Manutenção' ? (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-600">-</div>
                      ) : (
                        <>
                          <div className={`text-xs font-bold ${getProductivityColor(data.productivity)}`}>
                            {data.productivity.toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-muted-foreground dark:text-slate-500">R$ {data.osBonus}</div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {data.category === 'Manutenção' ? (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-600">-</div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              value={monthlySla[selectedMonth]?.[data.technicianId] ?? 100}
                              onChange={(e) => onUpdateSla(selectedMonth, data.technicianId, parseFloat(e.target.value) || 0)}
                              className="h-7 w-16 text-center text-[10px] font-bold border-amber-200 dark:border-amber-900/50 p-1 dark:bg-slate-800 dark:text-white"
                              disabled={!isAdmin}
                            />
                            <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold">%</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground dark:text-slate-500 font-medium">Bônus: R$ {data.slaBonus}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {data.category === 'Manutenção' ? (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-600">-</div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              step="0.1"
                              value={monthlyConformity[selectedMonth]?.[data.technicianId] ?? 10}
                              onChange={(e) => onUpdateConformity(selectedMonth, data.technicianId, parseFloat(e.target.value) || 0)}
                              className="h-7 w-16 text-center text-[10px] font-bold border-blue-200 dark:border-blue-900/50 p-1 dark:bg-slate-800 dark:text-white"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div className="text-[9px] text-muted-foreground dark:text-slate-500 font-medium">Bônus: R$ {data.conformityBonus}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-purple-700 dark:text-purple-400">
                      R$ {(data.finalCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Commission Dialog */}
      <Dialog open={!!selectedTechId} onOpenChange={(open) => !open && setSelectedTechId(null)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl dark:bg-slate-950">
          {selectedData && (
            <div className="overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                    <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      {selectedData.technicianName}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-muted-foreground dark:text-slate-500 uppercase tracking-widest">
                      Detalhamento de Comissão
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6 bg-white dark:bg-slate-950">
                {/* Top Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground dark:text-slate-500 uppercase font-black mb-1">Categoria</p>
                    <Badge variant="outline" className="text-xs font-bold uppercase py-0 dark:text-slate-400 dark:border-slate-700">{(selectedData?.category || 'N/A')}</Badge>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground dark:text-slate-500 uppercase font-black mb-1">Produtividade OS</p>
                    <p className={`text-lg font-black ${selectedData?.category === 'Manutenção' ? 'text-slate-400 dark:text-slate-600' : getProductivityColor(selectedData?.productivity || 0)}`}>
                      {selectedData?.category === 'Manutenção' ? '-' : `${(selectedData?.productivity || 0).toFixed(1)}%`}
                    </p>
                  </div>
                </div>

                {/* Calculation Memory */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Memória de Cálculo (Pesos)</h4>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    {selectedData?.category !== 'Manutenção' ? (
                      <>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-400">O.S. (Peso 60%)</span>
                            <span className="text-muted-foreground dark:text-slate-500">Range {(selectedData?.productivity || 0).toFixed(1)}% -&gt; R$ {selectedData?.osBonus || 0}</span>
                          </div>
                          <div className="flex justify-between items-center font-black">
                            <span className="dark:text-slate-300">Crédito OS:</span>
                            <span className="text-purple-600 dark:text-purple-400">R$ {(selectedData?.weightedOS || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center gap-4">
                            <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">SLA (Peso 25%)</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                min="0" 
                                max="100"
                                value={monthlySla[selectedMonth]?.[selectedData?.technicianId || ''] ?? 100}
                                onChange={(e) => selectedData && onUpdateSla(selectedMonth, selectedData.technicianId, parseFloat(e.target.value) || 0)}
                                className="h-7 w-16 text-center text-xs font-bold border-amber-200 dark:border-amber-900/50 dark:bg-slate-800 dark:text-white"
                                disabled={!isAdmin}
                              />
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500">%</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground dark:text-slate-500">
                            <span>Range {(selectedData?.sla || 0).toFixed(0)}% -&gt; R$ {selectedData?.slaBonus || 0}</span>
                          </div>
                          <div className="flex justify-between items-center font-black">
                            <span className="dark:text-slate-300">Crédito SLA:</span>
                            <span className="text-amber-600 dark:text-amber-500">R$ {(selectedData?.weightedSLA || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center gap-4">
                            <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">CONFORMIDADE (Peso 15%)</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                min="0" 
                                max="10"
                                step="0.1"
                                value={monthlyConformity[selectedMonth]?.[selectedData?.technicianId || ''] ?? 10}
                                onChange={(e) => selectedData && onUpdateConformity(selectedMonth, selectedData.technicianId, parseFloat(e.target.value) || 0)}
                                className="h-7 w-16 text-center text-xs font-bold border-blue-200 dark:border-blue-900/50 dark:bg-slate-800 dark:text-white"
                                disabled={!isAdmin}
                              />
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-500">Nota</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground dark:text-slate-500">
                            <span>Range {(selectedData?.conformity || 0).toFixed(1)} -&gt; R$ {selectedData?.conformityBonus || 0}</span>
                          </div>
                          <div className="flex justify-between items-center font-black">
                            <span className="dark:text-slate-300">Crédito Conf:</span>
                            <span className="text-blue-600 dark:text-blue-500">R$ {(selectedData?.weightedConformity || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="py-2 flex justify-between items-center border-t border-dashed dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Potencial da Equipe:</span>
                          <span className="font-black text-slate-700 dark:text-slate-300">R$ {(selectedData?.totalTeamCommission || 0).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl space-y-2">
                         <div className="flex justify-between items-center font-black">
                          <span className="text-purple-700 dark:text-purple-400">Comissão Fixa (Manutenção):</span>
                          <span className="text-purple-700 dark:text-purple-400 text-lg">R$ {(selectedData?.finalCommission || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Final Result Box */}
                  <div className="mt-8 p-6 bg-purple-600 dark:bg-purple-700 text-white rounded-3xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <DollarSign className="w-16 h-16" />
                    </div>
                    <div className="relative z-10 flex justify-between items-center">
                      <span className="text-sm opacity-90 font-black uppercase tracking-widest">Comissão Líquida</span>
                      <span className="text-3xl font-black tracking-tighter">
                        R$ {(selectedData?.finalCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="text-[10px] leading-relaxed text-muted-foreground bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <p>Cálculo baseado na média diária de conclusão. O redutor de SLA é aplicado diretamente sobre o bônus de produtividade atingido.</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
