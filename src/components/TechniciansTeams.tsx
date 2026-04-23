import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Technician, Team, ServiceOrder, UserRole } from '@/src/types';
import { Users, UserPlus, User, Trash2, Shield, History, Plus, CheckCircle2, ListFilter, Calendar, RefreshCcw, AlertCircle, Pencil } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

interface TechniciansTeamsProps {
  technicians: Technician[];
  teams: Team[];
  orders: ServiceOrder[];
  onAddTechnician: (tech: Technician) => void;
  onUpdateTechnician: (tech: Technician) => void;
  onDeleteTechnician: (id: string) => void;
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (id: string) => void;
  onResetData: () => void;
  onSaveBackup: () => void;
  onRestoreBackup: () => void;
  userRole?: UserRole;
}

export default function TechniciansTeams({ 
  technicians, teams, orders,
  onAddTechnician, onUpdateTechnician, onDeleteTechnician,
  onAddTeam, onUpdateTeam, onDeleteTeam, onResetData,
  onSaveBackup, onRestoreBackup,
  userRole
}: TechniciansTeamsProps) {
  const isAdmin = userRole === 'admin';
  const [isTechDialogOpen, setIsTechDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTechHistory, setSelectedTechHistory] = useState<Technician | null>(null);
  const [selectedTechDaily, setSelectedTechDaily] = useState<Technician | null>(null);

  // Tech Form State
  const [techName, setTechName] = useState('');
  const [techSalary, setTechSalary] = useState('');
  const [techRole, setTechRole] = useState('Técnico de Campo');

  // Team Form State
  const [teamName, setTeamName] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);

  const handleAddTech = () => {
    if (editingTechnician) {
      onUpdateTechnician({
        ...editingTechnician,
        name: techName,
        salaryBase: parseFloat(techSalary),
        role: techRole
      });
    } else {
      onAddTechnician({
        id: crypto.randomUUID(),
        name: techName,
        salaryBase: parseFloat(techSalary),
        role: techRole
      });
    }
    setTechName('');
    setTechSalary('');
    setEditingTechnician(null);
    setIsTechDialogOpen(false);
  };

  const handleEditTech = (tech: Technician) => {
    setEditingTechnician(tech);
    setTechName(tech.name);
    setTechSalary(tech.salaryBase.toString());
    setTechRole(tech.role);
    setIsTechDialogOpen(true);
  };

  const handleAddTeam = () => {
    if (editingTeam) {
      onUpdateTeam({
        ...editingTeam,
        name: teamName,
        leaderId: teamLeaderId,
        memberIds: teamMemberIds
      });
    } else {
      onAddTeam({
        id: crypto.randomUUID(),
        name: teamName,
        leaderId: teamLeaderId,
        memberIds: teamMemberIds
      });
    }
    setTeamName('');
    setTeamLeaderId('');
    setTeamMemberIds([]);
    setEditingTeam(null);
    setIsTeamDialogOpen(false);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamLeaderId(team.leaderId);
    setTeamMemberIds(team.memberIds);
    setIsTeamDialogOpen(true);
  };

  const getTechHistory = (techId: string) => {
    // Find teams this tech belongs to
    const techTeams = teams.filter(t => t.memberIds.includes(techId)).map(t => t.id);
    
    return orders.filter(o => 
      o.responsibleId === techId || techTeams.includes(o.responsibleId)
    ).sort((a, b) => parseISO(b.openingDate).getTime() - parseISO(a.openingDate).getTime());
  };

  const getTechDailyOrders = (techId: string) => {
    const techTeams = teams.filter(t => t.memberIds.includes(techId)).map(t => t.id);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return orders.filter(o => 
      (o.responsibleId === techId || techTeams.includes(o.responsibleId)) &&
      o.openingDate === today
    );
  };

  const toggleMember = (id: string) => {
    setTeamMemberIds(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Técnicos e Equipes</h2>
          <p className="text-muted-foreground">Gerencie sua força de trabalho e organize as equipes.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" />}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Configurar Banco
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configuração do Banco de Dados (Supabase)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800 flex gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="font-bold mb-1">Atenção!</p>
                        <p>Se você não está vendo seus dados, certifique-se de que as tabelas foram criadas no Supabase SQL Editor.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Script SQL para Criar Tabelas:</Label>
                      <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-auto max-h-[300px]">
                        <pre>{`
-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Técnicos
CREATE TABLE IF NOT EXISTS technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "salaryBase" NUMERIC NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Equipes
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "leaderId" TEXT REFERENCES technicians(id),
  "memberIds" TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS service_orders (
  protocol TEXT PRIMARY KEY,
  "responsibleId" TEXT NOT NULL,
  "isTeam" BOOLEAN NOT NULL,
  "openingDate" TEXT NOT NULL,
  "originalOpeningDate" TEXT,
  "isDelayed" BOOLEAN DEFAULT FALSE,
  "closingDate" TEXT,
  status TEXT NOT NULL,
  description TEXT,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de SLA Mensal
CREATE TABLE IF NOT EXISTS monthly_sla (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month TEXT NOT NULL,
  tech_id TEXT NOT NULL,
  value NUMERIC NOT NULL,
  UNIQUE(month, tech_id)
);

-- 6. Tabela de Backups do Sistema
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB NOT NULL
);

-- 7. Tabela de Logs do Sistema
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  category TEXT NOT NULL
);

-- 7. Habilitar Realtime (Sincronização em Tempo Real)
-- IMPORTANTE: Execute estas linhas para que todos os usuários vejam as mudanças na hora
BEGIN;
  -- Remove a publicação se já existir para evitar erros
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Cria a publicação para todas as tabelas necessárias
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    technicians, 
    teams, 
    service_orders, 
    monthly_sla, 
    app_users, 
    system_backups,
    system_logs;
COMMIT;
                        `}</pre>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      * Copie o código acima, vá ao seu projeto no Supabase, clique em "SQL Editor" e execute-o.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isTechDialogOpen} onOpenChange={(open) => {
                setIsTechDialogOpen(open);
                if (!open) {
                  setEditingTechnician(null);
                  setTechName('');
                  setTechSalary('');
                }
              }}>
                <DialogTrigger render={<Button variant="outline" />}>
                  <UserPlus className="w-4 h-4 mr-2" /> Novo Técnico
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingTechnician ? 'Editar Técnico' : 'Cadastrar Novo Técnico'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nome Completo</Label>
                      <Input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Ex: João Silva" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Salário Base (R$)</Label>
                      <Input type="number" value={techSalary} onChange={(e) => setTechSalary(e.target.value)} placeholder="1850.00" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Cargo / Função</Label>
                      <Select value={techRole} onValueChange={setTechRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Técnico de Campo">Técnico de Campo</SelectItem>
                          <SelectItem value="Instalador">Instalador</SelectItem>
                          <SelectItem value="Reparador">Reparador</SelectItem>
                          <SelectItem value="Líder Técnico">Líder Técnico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddTech} className="bg-purple-600 hover:bg-purple-700">
                      {editingTechnician ? 'Salvar Alterações' : 'Cadastrar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isTeamDialogOpen} onOpenChange={(open) => {
                setIsTeamDialogOpen(open);
                if (!open) {
                  setEditingTeam(null);
                  setTeamName('');
                  setTeamLeaderId('');
                  setTeamMemberIds([]);
                }
              }}>
                <DialogTrigger render={<Button className="bg-purple-600 hover:bg-purple-700" />}>
                  <Users className="w-4 h-4 mr-2" /> Nova Equipe
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingTeam ? 'Editar Equipe' : 'Formar Nova Equipe'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nome da Equipe</Label>
                      <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Equipe Alpha" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Líder da Equipe</Label>
                      <Select value={teamLeaderId} onValueChange={setTeamLeaderId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o líder" />
                        </SelectTrigger>
                        <SelectContent>
                          {technicians.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Membros da Equipe</Label>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="space-y-2">
                          {technicians.map(t => (
                            <div key={t.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleMember(t.id)}>
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${teamMemberIds.includes(t.id) ? 'bg-purple-600 border-purple-600' : 'border-input'}`}>
                                {teamMemberIds.includes(t.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm">{t.name}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddTeam} className="bg-purple-600 hover:bg-purple-700">
                      {editingTeam ? 'Salvar Alterações' : 'Criar Equipe'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" /> Gestão de Técnicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead className="text-center">O.S. Hoje</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicians.map(tech => (
                  <TableRow key={tech.id}>
                    <TableCell>
                      <div className="font-medium">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.role}</div>
                    </TableCell>
                    <TableCell>R$ {tech.salaryBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedTechDaily(tech)}
                        className="h-8 px-2 text-purple-600 hover:bg-purple-50"
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        {getTechDailyOrders(tech.id).length}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => handleEditTech(tech)} className="h-8 w-8 text-amber-600">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setSelectedTechHistory(tech)} className="h-8 w-8 text-purple-600">
                          <History className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => onDeleteTechnician(tech.id)} className="h-8 w-8 text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Equipes Formadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teams.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-md border-dashed">
                  Nenhuma equipe formada ainda.
                </div>
              ) : (
                teams.map(team => (
                  <div key={team.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-purple-600">{team.name}</h4>
                        <p className="text-xs text-muted-foreground">Líder: {technicians.find(t => t.id === team.leaderId)?.name || 'N/A'}</p>
                      </div>
                      <div className="flex gap-1">
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEditTeam(team)} className="h-8 w-8 text-amber-600">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDeleteTeam(team.id)} className="h-8 w-8 text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {team.memberIds.map(mid => {
                        const member = technicians.find(t => t.id === mid);
                        return member ? (
                          <Badge key={mid} variant="secondary" className="font-normal">
                            {member.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {isAdmin && (
        <Card className="border-rose-100 bg-rose-50/30">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-rose-700">
              <RefreshCcw className="w-5 h-5" /> Zona de Perigo: Redefinição de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-white border border-rose-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-rose-700">Atenção!</p>
                <p className="text-xs text-slate-600">
                  Esta ação apagará **TODOS** os dados salvos (Técnicos, Equipes e Ordens de Serviço) e restaurará os valores iniciais do sistema. 
                  Use esta opção se encontrar duplicidades ou erros nos dados que não consegue corrigir manualmente.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={onSaveBackup}
              >
                <Shield className="w-4 h-4 mr-2" /> Salvar Backup das Configurações
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={onRestoreBackup}
              >
                <History className="w-4 h-4 mr-2" /> Restaurar Último Salvamento
              </Button>
            </div>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => {
                if (confirm("Tem certeza que deseja apagar todos os dados e restaurar o sistema? Esta ação apagará os dados do Supabase e do LocalStorage.")) {
                  onResetData();
                }
              }}
            >
              Restaurar Configurações de Fábrica
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History Dialog */}
      <Dialog open={!!selectedTechHistory} onOpenChange={(open) => !open && setSelectedTechHistory(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Histórico de O.S. - {selectedTechHistory?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTechHistory && getTechHistory(selectedTechHistory.id).map(order => (
                  <TableRow key={order.protocol}>
                    <TableCell className="font-mono text-xs">{order.protocol}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span>{format(parseISO(order.openingDate), 'dd/MM/yyyy')}</span>
                        {order.isDelayed && (
                          <span className="text-[8px] text-rose-500 font-bold">ATRASADA</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                      {order.description}
                    </TableCell>
                    <TableCell>
                      {order.responsibleId === selectedTechHistory.id ? (
                        <Badge variant="secondary" className="text-[10px] h-5">Individual</Badge>
                      ) : (
                        <Badge className="text-[10px] h-5 bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">Equipe</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {selectedTechHistory && getTechHistory(selectedTechHistory.id).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Nenhuma O.S. encontrada para este técnico.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Daily Orders Dialog */}
      <Dialog open={!!selectedTechDaily} onOpenChange={(open) => !open && setSelectedTechDaily(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" /> O.S. de Hoje: {selectedTechDaily?.name}
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
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTechDaily && getTechDailyOrders(selectedTechDaily.id).map(order => (
                    <TableRow key={order.protocol}>
                      <TableCell className="font-mono text-xs">{order.protocol}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                        {order.description}
                      </TableCell>
                      <TableCell>
                        {order.responsibleId === selectedTechDaily.id ? (
                          <Badge variant="secondary" className="text-[10px]">Individual</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-purple-100 text-purple-700">Equipe</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {selectedTechDaily && getTechDailyOrders(selectedTechDaily.id).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground italic text-sm">
                        Nenhuma O.S. atribuída para hoje.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
