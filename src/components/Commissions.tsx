import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Technician, Team, ServiceOrder, CommissionResult, UserRole } from '@/src/types';
import { Calculator, TrendingUp, Award, AlertCircle, DollarSign, Info, Search } from 'lucide-react';
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

export default function Commissions({ technicians, teams, orders, monthlySla, onUpdateSla, currentMonth }: CommissionsProps) {
  const [selectedTechDetail, setSelectedTechDetail] = useState<CommissionResult | null>(null);

  const commissionData = useMemo(() => {
    const results: CommissionResult[] = [];
    const monthSlas = monthlySla[currentMonth] || {};

    technicians.forEach(tech => {
      // Find teams this tech belongs to
      const techTeams = teams.filter(t => t.memberIds.includes(tech.id)).map(t => t.id);
      
      // Filter orders for the current month
      const monthOrders = orders.filter(o => {
        const date = parseISO(o.openingDate);
        return format(date, 'yyyy-MM') === currentMonth;
      });

      // Count OS for this tech (Individual + Team)
      const techOrders = monthOrders.filter(o => 
        o.responsibleId === tech.id || techTeams.includes(o.responsibleId)
      );

      const openOS = techOrders.length;
      const closedOS = techOrders.filter(o => o.status === 'Concluída').length;
      const productivity = openOS > 0 ? (closedOS / openOS) * 100 : 0;

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
            <Calculator className="w-5 h-5 text-purple-600" /> Detalhamento de Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead className="text-center">Produtividade</TableHead>
                  <TableHead className="text-center">Bônus %</TableHead>
                  <TableHead className="text-center w-[150px]">SLA Mensal (%)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionData.map((data) => (
                  <TableRow key={data.technicianId}>
                    <TableCell>
                      <div className="font-medium">{data.technicianName}</div>
                      <div className="text-[10px] text-muted-foreground">Salário: R$ {data.baseSalary.toLocaleString('pt-BR')}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={getProductivityColor(data.productivity)}>
                        {data.productivity.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">({data.closedOS}/{data.openOS} O.S.)</div>
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
                      <Input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={monthlySla[currentMonth]?.[data.technicianId] ?? 100}
                        onChange={(e) => onUpdateSla(currentMonth, data.technicianId, parseFloat(e.target.value) || 0)}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        onClick={() => setSelectedTechDetail(data)}
                      >
                        <Search className="w-4 h-4 mr-1" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Commission Dialog */}
      <Dialog open={!!selectedTechDetail} onOpenChange={(open) => !open && setSelectedTechDetail(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-purple-600" /> Detalhamento: {selectedTechDetail?.technicianName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTechDetail && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Salário Base</p>
                  <p className="text-lg font-bold">R$ {selectedTechDetail.baseSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Produtividade</p>
                  <p className={`text-lg font-bold ${getProductivityColor(selectedTechDetail.productivity)}`}>
                    {selectedTechDetail.productivity.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold border-b pb-1">Memória de Cálculo</h4>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de O.S. no Mês:</span>
                  <span className="font-medium">{selectedTechDetail.openOS}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">O.S. Concluídas:</span>
                  <span className="font-medium">{selectedTechDetail.closedOS}</span>
                </div>
                
                <div className="pt-2 flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Bônus por Produtividade ({selectedTechDetail.bonusPercentage}%):</span>
                  <span className="font-bold text-emerald-600">
                    + R$ {selectedTechDetail.bonusAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Redutor de SLA ({selectedTechDetail.sla}%):</span>
                  <span className="font-bold text-amber-600">
                    x {selectedTechDetail.sla / 100}
                  </span>
                </div>

                <div className="mt-4 p-4 bg-purple-600 text-white rounded-xl shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-90 font-medium">Comissão Líquida Final</span>
                    <span className="text-2xl font-black">
                      R$ {selectedTechDetail.finalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground bg-amber-50 p-2 rounded border border-amber-100 flex gap-2">
                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                <p>O cálculo considera O.S. individuais e participações em equipes. O redutor de SLA é aplicado sobre o valor bruto do bônus atingido.</p>
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
