import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const ADMIN_PASSWORD = 'Lumina2077';

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem('admin_authenticated', 'true');
        onLogin();
        toast({ title: 'Login realizado com sucesso!' });
      } else {
        toast({ title: 'Senha incorreta', variant: 'destructive' });
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="particles-bg flex min-h-screen items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-primary/15 bg-card p-8 glow-cyan animate-fade-in-up">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-3xl font-extrabold tracking-wider text-gradient-cyan">LUMINA</h1>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <p className="text-muted-foreground">Digite a senha para acessar o painel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-secondary border-primary/20 focus:border-primary"
          />
          <Button type="submit" className="w-full h-12 font-semibold text-primary-foreground" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
