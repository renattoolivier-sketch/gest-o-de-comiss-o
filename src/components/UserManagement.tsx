import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UserPlus, User, Trash2, Shield, ShieldCheck, AlertCircle, Loader2, Edit2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { UserProfile, UserRole, SystemLog } from '@/src/types';

interface UserManagementProps {
  onLog: (log: Omit<SystemLog, 'id' | 'created_at'>) => void;
  currentUser: UserProfile;
}

export default function UserManagement({ onLog, currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, role')
        .order('username');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Erro ao carregar usuários.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Real-time synchronization for users
    const channel = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddUser = async () => {
    if (!username || !password) {
      setError('Usuário e senha são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('app_users')
        .insert([{ username, password, role }]);

      if (insertError) throw insertError;

      await fetchUsers();
      
      onLog({
        username: currentUser.username,
        action: 'Novo Usuário Criado',
        details: `Usuário: ${username} | Nível: ${role}`,
        category: 'Usuário'
      });

      setIsDialogOpen(false);
      setUsername('');
      setPassword('');
      setRole('viewer');
    } catch (err: any) {
      console.error('Error adding user:', err);
      setError(err.message || 'Erro ao adicionar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!username || !editingUserId) {
      setError('Usuário é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: any = { username, role };
      if (password) {
        updateData.password = password; // Only update password if provided
      }

      const { error: updateError } = await supabase
        .from('app_users')
        .update(updateData)
        .eq('id', editingUserId);

      if (updateError) throw updateError;

      await fetchUsers();
      
      onLog({
        username: currentUser.username,
        action: 'Usuário Editado',
        details: `Usuário ID: ${editingUserId} novo nome: ${username} | Nível: ${role}`,
        category: 'Usuário'
      });

      setIsDialogOpen(false);
      setEditingUserId(null);
      setUsername('');
      setPassword('');
      setRole('viewer');
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'Erro ao atualizar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setPassword(''); // Don't show old password
    setRole(user.role);
    setError(null);
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingUserId(null);
    setUsername('');
    setPassword('');
    setRole('viewer');
    setError(null);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (name === 'renato') {
      alert('O administrador master não pode ser excluído.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      onLog({
        username: currentUser.username,
        action: 'Usuário Excluído',
        details: `Usuário removido: ${name}`,
        category: 'Usuário'
      });

      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Erro ao excluir usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h2>
          <p className="text-muted-foreground">Gerencie quem tem acesso ao sistema e suas permissões.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingUserId(null);
            setUsername('');
            setPassword('');
            setRole('viewer');
          }
        }}>
          <DialogTrigger render={<Button className="bg-purple-600 hover:bg-purple-700" onClick={openAddDialog} />}>
            <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUserId ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="new-username">Usuário</Label>
                <Input 
                  id="new-username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Ex: joao.silva" 
                  disabled={username === 'renato'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">Senha {editingUserId && '(Deixe vazio para não alterar)'}</Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder={editingUserId ? "Nova senha (opcional)" : "Senha de acesso"} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Nível de Acesso</Label>
                <Select value={role} onValueChange={(v: UserRole) => setRole(v)} disabled={username === 'renato'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                    <SelectItem value="operator">Operador (Adicionar/Editar O.S.)</SelectItem>
                    <SelectItem value="viewer">Visualizador (Somente Leitura)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">
                  * Administradores: Acesso total. Operadores: Abrem e editam O.S. Visualizadores: Somente leitura.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button 
                onClick={editingUserId ? handleEditUser : handleAddUser} 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" /> Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      {u.role === 'admin' ? (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Administrador
                        </Badge>
                      ) : u.role === 'operator' ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Operador
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Shield className="w-3 h-3 mr-1" /> Visualizador
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(u)} 
                        className="h-8 w-8 text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteUser(u.id, u.username)} 
                        className="h-8 w-8 text-rose-600"
                        disabled={u.username === 'renato'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
