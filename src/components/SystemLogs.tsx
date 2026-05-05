import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Search, Clock, User, Info, Filter, AlertCircle, RefreshCcw } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { SystemLog } from '@/src/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar logs:', err);
      if (err.message?.includes('relation "system_logs" does not exist')) {
        setError('A tabela de logs ainda não foi criada no Supabase. Use o botão "Configurar Banco" na aba Técnicos.');
      } else {
        setError('Ocorreu um erro ao carregar os registros de atividade.');
      }
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
      case 'O.S.': return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800">O.S.</Badge>;
      case 'Técnico': return <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800">Técnico</Badge>;
      case 'Equipe': return <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800">Equipe</Badge>;
      case 'Usuário': return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800">Usuário</Badge>;
      case 'Sistema': return <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-700">Sistema</Badge>;
      default: return <Badge variant="outline" className="dark:text-slate-400 dark:border-slate-700">{category}</Badge>;
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
              className="pl-9 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-md px-3 h-10 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="text-sm bg-transparent outline-none cursor-pointer font-medium dark:text-white"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all" className="dark:bg-slate-900">Todas Categorias</option>
              <option value="O.S." className="dark:bg-slate-900">O.S.</option>
              <option value="Técnico" className="dark:bg-slate-900">Técnicos</option>
              <option value="Equipe" className="dark:bg-slate-900">Equipes</option>
              <option value="Usuário" className="dark:bg-slate-900">Usuários</option>
              <option value="Sistema" className="dark:bg-slate-900">Sistema</option>
            </select>
          </div>
        </div>
      </div>

      <Card className="shadow-md border-purple-100 dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Linha do Tempo de Edições
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchLogs} 
            disabled={isLoading}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-8 text-center space-y-4">
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 flex items-center gap-3 justify-center max-w-lg mx-auto">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: Verifique se você executou o item 7 do script SQL em Configurar Banco.
              </p>
            </div>
          )}
          <ScrollArea className="h-[600px]">
            {isLoading && logs.length === 0 ? (
              <div className="flex justify-center py-20 text-muted-foreground italic">
                Carregando histórico...
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                  <TableRow className="dark:border-slate-800">
                    <TableHead className="w-[180px] dark:text-slate-300"><Clock className="w-4 h-4 mr-1 inline" /> Data/Hora</TableHead>
                    <TableHead className="w-[150px] dark:text-slate-300"><User className="w-4 h-4 mr-1 inline" /> Usuário</TableHead>
                    <TableHead className="w-[120px] dark:text-slate-300"><Info className="w-4 h-4 mr-1 inline" /> Categoria</TableHead>
                    <TableHead className="dark:text-slate-300">Ação e Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors dark:border-slate-800">
                      <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {log.username}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(log.category)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{log.action}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">{log.details}</div>
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
