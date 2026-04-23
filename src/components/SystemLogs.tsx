import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Search, Clock, User, Info, Filter } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { SystemLog } from '@/src/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Sincronização em tempo real para os logs
    const channel = supabase
      .channel('logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        setLogs(prev => [payload.new as SystemLog, ...prev.slice(0, 199)]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || log.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'O.S.': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">O.S.</Badge>;
      case 'Técnico': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Técnico</Badge>;
      case 'Equipe': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">Equipe</Badge>;
      case 'Usuário': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Usuário</Badge>;
      case 'Sistema': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200">Sistema</Badge>;
      default: return <Badge variant="outline">{category}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logs de Atividade</h2>
          <p className="text-muted-foreground">Rastreador de auditoria: quem fez o quê e quando.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em logs..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white border rounded-md px-3 h-10 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="text-sm bg-transparent outline-none cursor-pointer font-medium"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Todas Categorias</option>
              <option value="O.S.">O.S.</option>
              <option value="Técnico">Técnicos</option>
              <option value="Equipe">Equipes</option>
              <option value="Usuário">Usuários</option>
              <option value="Sistema">Sistema</option>
            </select>
          </div>
        </div>
      </div>

      <Card className="shadow-md border-purple-100">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-600" /> Linha do Tempo de Edições
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {isLoading && logs.length === 0 ? (
              <div className="flex justify-center py-20 text-muted-foreground italic">
                Carregando histórico...
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[180px]"><Clock className="w-4 h-4 mr-1 inline" /> Data/Hora</TableHead>
                    <TableHead className="w-[150px]"><User className="w-4 h-4 mr-1 inline" /> Usuário</TableHead>
                    <TableHead className="w-[120px]"><Info className="w-4 h-4 mr-1 inline" /> Categoria</TableHead>
                    <TableHead>Ação e Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.id || index} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-xs font-mono text-slate-500">
                        {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-slate-700 uppercase tracking-tight text-xs bg-slate-100 px-2 py-1 rounded">
                          {log.username}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(log.category)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-slate-900">{log.action}</div>
                        <div className="text-xs text-slate-500 italic mt-0.5">{log.details}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                        Nenhum registro encontrado para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      <p className="text-[10px] text-center text-muted-foreground italic">
        * Os logs são atualizados em tempo real. Apenas os últimos 200 registros são exibidos.
      </p>
    </div>
  );
}
