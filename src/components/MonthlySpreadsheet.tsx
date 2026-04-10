import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Technician, Team, ServiceOrder, Status } from '@/src/types';
import { 
  format, 
  parseISO, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  getDay,
  getDaysInMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileSpreadsheet, Info, CheckCircle2, Clock, PlayCircle, XCircle, Trash2 } from 'lucide-react';

interface MonthlySpreadsheetProps {
  technicians: Technician[];
  teams: Team[];
  orders: ServiceOrder[];
  onUpdateOrder: (order: ServiceOrder) => void;
  onDeleteOrder: (protocol: string) => void;
}

export default function MonthlySpreadsheet({ technicians, teams, orders, onUpdateOrder, onDeleteOrder }: MonthlySpreadsheetProps) {
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ techId: string, techName: string, date: Date } | null>(null);

  const monthDate = useMemo(() => parseISO(`${filterMonth}-01`), [filterMonth]);
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const getDayName = (date: Date) => {
    const name = format(date, 'EEEE', { locale: ptBR });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const isWeekend = (date: Date) => {
    const day = getDay(date);
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  const techData = useMemo(() => {
    return technicians.map(tech => {
      const techTeams = teams.filter(t => t.memberIds.includes(tech.id)).map(t => t.id);
      
      const dailyStats = daysInMonth.map(day => {
        const dayOrders = orders.filter(o => {
          if (!o.openingDate) return false;
          try {
            const orderDate = parseISO(o.openingDate);
            if (isNaN(orderDate.getTime())) return false;
            
            const originalDate = o.originalOpeningDate ? parseISO(o.originalOpeningDate) : null;
            const closingDate = (o.status === 'Concluída' && o.closingDate) ? parseISO(o.closingDate) : null;
            
            const isCurrentDay = isSameDay(orderDate, day);
            const isOriginalDay = (originalDate && !isNaN(originalDate.getTime())) ? isSameDay(originalDate, day) : false;
            const isClosingDay = (closingDate && !isNaN(closingDate.getTime())) ? isSameDay(closingDate, day) : false;
            
            return (isCurrentDay || isOriginalDay || isClosingDay) && (o.responsibleId === tech.id || techTeams.includes(o.responsibleId));
          } catch (e) {
            return false;
          }
        });

        const total = dayOrders.length;
        const completed = dayOrders.filter(o => {
          if (o.status !== 'Concluída') return false;
          try {
            const closeDate = o.closingDate ? parseISO(o.closingDate) : (o.openingDate ? parseISO(o.openingDate) : null);
            if (!closeDate || isNaN(closeDate.getTime())) return false;
            return isSameDay(closeDate, day);
          } catch (e) {
            return false;
          }
        }).length;
        const moved = dayOrders.filter(o => {
          if (!o.originalOpeningDate) return false;
          try {
            const origDate = parseISO(o.originalOpeningDate);
            const currDate = o.openingDate ? parseISO(o.openingDate) : null;
            if (isNaN(origDate.getTime())) return false;
            return isSameDay(origDate, day) && (!currDate || isNaN(currDate.getTime()) || !isSameDay(currDate, day));
          } catch (e) {
            return false;
          }
        }).length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;

        return {
          date: day,
          total,
          completed,
          moved,
          percentage,
          orders: dayOrders
        };
      });

      return {
        ...tech,
        dailyStats
      };
    });
  }, [technicians, teams, orders, daysInMonth]);

  const getCellColor = (completed: number, total: number, moved: number) => {
    if (total === 0) return 'bg-slate-50 text-slate-300';
    if (moved > 0 && completed === 0) return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    if (completed === 0) return 'bg-purple-50 text-purple-600 border-purple-100';
    if (completed < total) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  };

  const getStatusBadge = (status: Status) => {
    switch (status) {
      case 'Concluída': return <Badge className="bg-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluída</Badge>;
      case 'Em Execução': return <Badge className="bg-purple-500"><PlayCircle className="w-3 h-3 mr-1" /> Em Execução</Badge>;
      case 'Aberta': return <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" /> Aberta</Badge>;
      case 'Cancelada': return <Badge className="bg-rose-500"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-purple-600" /> Planilha Mensal
          </h2>
          <p className="text-muted-foreground">Acompanhamento diário de produtividade por técnico.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-40 bg-white"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="bg-white border-b py-4">
          <CardTitle className="text-lg font-semibold text-slate-700">
            Detalhamento — {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-slate-50 border-r min-w-[200px] font-bold text-slate-700">
                    Técnico
                  </TableHead>
                  {daysInMonth.map(day => (
                    <TableHead key={day.toISOString()} className={`text-center min-w-[80px] p-2 border-r ${isWeekend(day) ? 'bg-slate-100/50' : ''}`}>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-medium text-slate-500">{format(day, 'd')}</span>
                        <span className={`text-[10px] uppercase font-bold ${isWeekend(day) ? 'text-rose-500' : 'text-slate-400'}`}>
                          {format(day, 'EEE', { locale: ptBR })}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {techData.map(tech => (
                  <TableRow key={tech.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="sticky left-0 z-10 bg-white border-r font-bold text-slate-700 uppercase text-[10px]">
                      {tech.name}
                    </TableCell>
                    {tech.dailyStats.map(stat => (
                      <TableCell 
                        key={stat.date.toISOString()} 
                        className={`text-center p-1 border-r cursor-pointer transition-all hover:brightness-95 ${isWeekend(stat.date) ? 'bg-slate-50/30' : ''}`}
                        onClick={() => stat.total > 0 && setSelectedDayDetail({ techId: tech.id, techName: tech.name, date: stat.date })}
                      >
                        <div className={`rounded-md py-1.5 px-1 border flex flex-col items-center justify-center min-h-[45px] ${getCellColor(stat.completed, stat.total, stat.moved)}`}>
                          {stat.total > 0 ? (
                            <>
                              <span className="text-[11px] font-black leading-none">{stat.completed}/{stat.total}</span>
                              {stat.moved > 0 && <span className="text-[8px] font-bold text-indigo-600 mt-0.5">M:{stat.moved}</span>}
                              <span className="text-[9px] font-bold mt-1 opacity-80">{Math.round(stat.percentage)}%</span>
                            </>
                          ) : (
                            <span className="text-[10px] opacity-40">—</span>
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-50 border border-purple-100"></div>
          <span>Nenhuma fechada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-50 border border-amber-100"></div>
          <span>Parcial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100"></div>
          <span>Todas fechadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200"></div>
          <span>Contém Movidas</span>
        </div>
        <div className="ml-auto flex items-center gap-2 italic">
          <Info className="w-3 h-3 text-purple-500" />
          <span>Clique numa célula para ver e gerenciar as O.S. do dia</span>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDayDetail} onOpenChange={(open) => !open && setSelectedDayDetail(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-purple-600" /> 
              O.S. do Dia {selectedDayDetail && format(selectedDayDetail.date, 'dd/MM/yyyy')} — {selectedDayDetail?.techName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDayDetail && orders
                    .filter(o => {
                      if (!o.openingDate) return false;
                      try {
                        const orderDate = parseISO(o.openingDate);
                        if (isNaN(orderDate.getTime())) return false;
                        const originalDate = o.originalOpeningDate ? parseISO(o.originalOpeningDate) : null;
                        const closingDate = (o.status === 'Concluída' && o.closingDate) ? parseISO(o.closingDate) : null;
                        const techTeams = teams.filter(t => t.memberIds.includes(selectedDayDetail.techId)).map(t => t.id);
                        
                        const isCurrentDay = isSameDay(orderDate, selectedDayDetail.date);
                        const isOriginalDay = (originalDate && !isNaN(originalDate.getTime())) ? isSameDay(originalDate, selectedDayDetail.date) : false;
                        const isClosingDay = (closingDate && !isNaN(closingDate.getTime())) ? isSameDay(closingDate, selectedDayDetail.date) : false;
                        
                        return (isCurrentDay || isOriginalDay || isClosingDay) && 
                               (o.responsibleId === selectedDayDetail.techId || techTeams.includes(o.responsibleId));
                      } catch (e) {
                        return false;
                      }
                    })
                    .map(order => {
                      let isMovedFromThisDay = false;
                      try {
                        if (selectedDayDetail && order.originalOpeningDate) {
                          const origDate = parseISO(order.originalOpeningDate);
                          const currDate = order.openingDate ? parseISO(order.openingDate) : null;
                          isMovedFromThisDay = !isNaN(origDate.getTime()) && 
                                             isSameDay(origDate, selectedDayDetail.date) && 
                                             (!currDate || isNaN(currDate.getTime()) || !isSameDay(currDate, selectedDayDetail.date));
                        }
                      } catch (e) {
                        isMovedFromThisDay = false;
                      }
                      
                      return (
                        <TableRow key={order.protocol} className={isMovedFromThisDay ? "bg-indigo-50/50" : ""}>
                          <TableCell className="font-mono text-xs font-bold">
                            <div className="flex items-center gap-2">
                              {order.protocol}
                              {isMovedFromThisDay && <Badge variant="outline" className="text-[8px] h-4 bg-indigo-100 text-indigo-700 border-indigo-200">MOVIDA</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{order.description}</span>
                              {isMovedFromThisDay && order.openingDate && (
                                <span className="text-[9px] text-indigo-600 font-bold mt-1">
                                  Movida para: {(() => {
                                    try {
                                      const d = parseISO(order.openingDate);
                                      return isNaN(d.getTime()) ? order.openingDate : format(d, 'dd/MM/yyyy');
                                    } catch (e) {
                                      return order.openingDate;
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                onDeleteOrder(order.protocol);
                              }}
                              className="h-8 w-8 text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
    </div>
  );
}
