import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Technician, Team, ServiceOrder, CommissionResult, UserRole } from '@/src/types';
import { Calculator, TrendingUp, Award, AlertCircle, DollarSign, Info, User, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CommissionsProps {
  technicians: Technician[];
  teams: Team[];
  orders: ServiceOrder[];
  monthlySla: Record<string, Record<string, number>>;
  onUpdateSla: (month: string, techId: string, value: number) => void;
  currentMonth: string; // yyyy-MM
  userRole?: UserRole;
}

export default function Commissions({ technicians, teams, orders, monthlySla, onUpdateSla, currentMonth, userRole }: CommissionsProps) {
  const isAdmin = userRole === 'admin';
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  const commissionData = useMemo(() => {
    const results: CommissionResult[] = [];
    const monthSlas = monthlySla[currentMonth] || {};

    technicians.forEach(tech => {
      // Find teams this tech belongs to
      const techTeams = teams.filter(t => t.memberIds.includes(tech.id)).map(t => t.id);
      
      // Filter ALL orders for this tech/team (not just by openingDate)
      const techOrders = orders.filter(o => 
        o.responsibleId === tech.id || techTeams.includes(o.responsibleId)
      );

      // Group by day to calculate daily productivity using Dashboard logic
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
            
            // Only process dates within the current month
            if (format(date, 'yyyy-MM') === currentMonth) {
              if (!dailyStats[dateStr]) dailyStats[dateStr] = { total: 0, completed: 0 };
              
              const isScheduledDay = dateStr === order.openingDate;
              const isClosingDay = dateStr === order.closingDate && order.status === 'Concluída';
              const isOriginalDay = dateStr === order.originalOpeningDate && dateStr !== order.openingDate;

              // Only count in total if it's the day it was supposed to happen (and not moved without delay)
              // or the day it was actually closed.
              if (isScheduledDay || isClosingDay || (isOriginalDay && order.isDelayed)) {
                dailyStats[dateStr].total++;
              }
              
              // It counts as completed on this day ONLY if it was closed on this specific day
              if (isClosingDay) {
                dailyStats[dateStr].completed++;
              }
            }
          } catch (e) {
            // Skip invalid dates
          }
        });
      });

      const daysWorkedList = Object.keys(dailyStats).sort();
      let totalDailyPercentage = 0;

      daysWorkedList.forEach(day => {
        const { total, completed } = dailyStats[day];
        const dayPercentage = total > 0 ? (completed / total) * 100 : 0;
        totalDailyPercentage += dayPercentage;
      });

      // Unique orders for the month (for display purposes)
      const monthOrders = techOrders.filter(o => {
        const opDate = parseISO(o.openingDate);
        const clDate = o.closingDate ? parseISO(o.closingDate) : null;
        return format(opDate, 'yyyy-MM') === currentMonth || (clDate && format(clDate, 'yyyy-MM') === currentMonth);
      });

      const openOS = monthOrders.length;
      const closedOS = monthOrders.filter(o => o.status === 'Concluída' && o.closingDate && format(parseISO(o.closingDate), 'yyyy-MM') === currentMonth).length;
      const delayedOS = monthOrders.filter(o => o.isDelayed).length;
      const productivity = daysWorkedList.length > 0 ? totalDailyPercentage / daysWorkedList.length : 0;

      let bonusPercentage = 0;
      if (productivity >= 95) bonusPercentage = 50;
      else if (productivity >= 85) bonusPercentage = 35;
      else if (productivity >= 70) bonusPercentage = 20;

      const bonusAmount = (tech.salaryBase * bonusPercentage) / 100;
      const sla = monthSlas[tech.id] ?? 100;
      const finalCommission = bonusAmount * (sla / 100);

      results.push({
        technicianId: tech.id,
        technicianName: tech.name,
        baseSalary: tech.salaryBase,
        openOS,
        closedOS,
        delayedOS,
        daysWorked: daysWorkedList.length,
        productivity,
        bonusPercentage,
        bonusAmount,
        sla,
        finalCommission
      });
    });

    return results;
  }, [technicians, teams, orders, currentMonth, monthlySla]);

  const totals = useMemo(() => {
    return {
      totalCommission: commissionData.reduce((acc, curr) => acc + curr.finalCommission, 0),
      avgProductivity: commissionData.length > 0 
        ? commissionData.reduce((acc, curr) => acc + curr.productivity, 0) / commissionData.length 
        : 0,
      eligibleCount: commissionData.filter(c => c.bonusPercentage > 0).length
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cálculo de Comissões</h2>
          <p className="text-muted-foreground">Resultados financeiros baseados em produtividade e SLA.</p>
        </div>
        <Badge variant="outline" className="px-4 py-1 text-sm font-medium border-purple-200 bg-purple-50 text-purple-700">
          Referência: {currentMonth}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-purple-600 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Total a Pagar (Comissões)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="w-8 h-8" />
              R$ {totals.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de Produtividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              {totals.avgProductivity.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Técnicos Comissionados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-500" />
              {totals.eligibleCount} / {technicians.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" /> Resumo de Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Técnico (Clique para Detalhes)</TableHead>
                  <TableHead className="text-center">Produtividade</TableHead>
                  <TableHead className="text-center">Bônus %</TableHead>
                  <TableHead className="text-center">Atrasos</TableHead>
                  <TableHead className="text-right">Comissão Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionData.map((data) => (
                  <TableRow key={data.technicianId}>
                    <TableCell>
                      <button 
                        onClick={() => setSelectedTechId(data.technicianId)}
                        className="text-left group"
                      >
                        <div className="font-bold text-slate-800 group-hover:text-purple-600 transition-colors uppercase tracking-tight">
                          {data.technicianName}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Search className="w-2 h-2" /> Clique para ver o detalhamento
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={getProductivityColor(data.productivity)}>
                        {data.productivity.toFixed(1)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {data.bonusPercentage > 0 ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          +{data.bonusPercentage}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${data.delayedOS > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {data.delayedOS}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-purple-700">
                      R$ {data.finalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          {selectedData && (
            <div className="overflow-hidden">
              <div className="bg-slate-50 border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <User className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      {selectedData.technicianName}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Detalhamento de Comissão
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6 bg-white">
                {/* Top Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border rounded-2xl flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Salário Base</p>
                    <p className="text-lg font-bold text-slate-700">
                      R$ {selectedData.baseSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border rounded-2xl flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Produtividade</p>
                    <p className={`text-lg font-black ${getProductivityColor(selectedData.productivity)}`}>
                      {selectedData.productivity.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Calculation Memory */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Memória de Cálculo</h4>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground">Total de O.S. no Mês:</span>
                      <span className="font-bold text-slate-700">{selectedData.openOS}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground">O.S. Concluídas:</span>
                      <span className="font-bold text-slate-700">{selectedData.closedOS}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground">O.S. em Atraso:</span>
                      <span className="font-bold text-rose-600">{selectedData.delayedOS}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground">Dias com O.S. Abertas:</span>
                      <span className="font-bold text-slate-700">{selectedData.daysWorked}</span>
                    </div>
                    
                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-muted-foreground">Bônus por Produtividade ({selectedData.bonusPercentage}%):</span>
                      <span className="font-black text-emerald-600">
                        + R$ {selectedData.bonusAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                      <Label className="text-muted-foreground text-sm font-normal">Redutor de SLA (%):</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          min="0" 
                          max="100"
                          value={monthlySla[currentMonth]?.[selectedData.technicianId] ?? 100}
                          onChange={(e) => onUpdateSla(currentMonth, selectedData.technicianId, parseFloat(e.target.value) || 0)}
                          className="h-8 w-20 text-center text-sm font-bold border-amber-200 focus-visible:ring-amber-500"
                          disabled={!isAdmin}
                        />
                        <span className="text-xs font-bold text-amber-600">
                          x {((monthlySla[currentMonth]?.[selectedData.technicianId] ?? 100) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Final Result Box */}
                  <div className="mt-8 p-6 bg-purple-600 text-white rounded-3xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <DollarSign className="w-16 h-16" />
                    </div>
                    <div className="relative z-10 flex justify-between items-center">
                      <span className="text-sm opacity-90 font-black uppercase tracking-widest">Comissão Líquida</span>
                      <span className="text-3xl font-black tracking-tighter">
                        R$ {selectedData.finalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="text-[10px] leading-relaxed text-muted-foreground bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <p>Cálculo baseado na média diária de conclusão. O redutor de SLA é aplicado diretamente sobre o bônus de produtividade atingido.</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-dashed max-w-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Regras de Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-muted-foreground">
            <div className="flex justify-between">
              <span>95% a 100%</span>
              <span className="font-bold text-emerald-600">50% do Salário</span>
            </div>
            <div className="flex justify-between">
              <span>85% a 94.9%</span>
              <span className="font-bold text-purple-600">35% do Salário</span>
            </div>
            <div className="flex justify-between">
              <span>70% a 84.9%</span>
              <span className="font-bold text-amber-600">20% do Salário</span>
            </div>
            <div className="flex justify-between">
              <span>Abaixo de 70%</span>
              <span className="font-bold text-rose-600">0% (Sem Bônus)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
