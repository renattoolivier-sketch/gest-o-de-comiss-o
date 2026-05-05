import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Wifi, Lock, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { UserProfile } from '@/src/types';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Check in app_users table
      const { data, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Usuário ou senha incorretos.');
        } else if (fetchError.message.includes('relation "app_users" does not exist')) {
          setError('A tabela "app_users" não foi encontrada no Supabase. Por favor, crie-a no SQL Editor.');
        } else {
          setError(`Erro: ${fetchError.message}`);
        }
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError('Usuário ou senha incorretos.');
        setIsLoading(false);
        return;
      }

      onLogin({
        id: data.id,
        username: data.username,
        role: data.role as any
      });
    } catch (err) {
      setError('Erro ao conectar ao servidor.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-200 dark:shadow-purple-900/20 relative">
              <div className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-400 rounded-md border-2 border-white dark:border-slate-900" />
              <Wifi className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
              Infolink <span className="text-purple-600 dark:text-purple-400">Ultra Internet</span>
            </h1>
          </div>
        </div>

        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold dark:text-white">Bem-vindo de volta</CardTitle>
            <CardDescription className="dark:text-slate-400">
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username" className="dark:text-slate-300">Usuário</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="username"
                    placeholder="Seu usuário"
                    className="pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="dark:text-slate-300">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 h-11 text-base font-semibold transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center mt-6 text-slate-500 text-sm">
          &copy; 2024 Infolink Ultra Internet - Acesso Restrito
        </p>
      </div>
    </div>
  );
}
