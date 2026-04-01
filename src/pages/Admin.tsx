import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminLogin from '@/components/admin/AdminLogin';
import ClientsList from '@/components/admin/ClientsList';
import FormEditor from '@/components/admin/FormEditor';
import ResponsesViewer from '@/components/admin/ResponsesViewer';
import type { Client } from '@/types/onboarding';

type View = { type: 'clients' } | { type: 'form'; client: Client } | { type: 'responses'; client: Client };

const AdminPage = () => {
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem('admin_authenticated') === 'true'
  );
  const [view, setView] = useState<View>({ type: 'clients' });

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="particles-bg min-h-screen">
      <header className="sticky top-0 z-10 border-b border-primary/15 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-extrabold tracking-wider text-gradient-cyan">LUMINA</h1>
          <Button variant="outline" size="sm" onClick={handleLogout} className="border-primary/30 text-foreground hover:bg-primary/10 hover:text-primary">
            <LogOut className="mr-1.5 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        {view.type === 'clients' && (
          <ClientsList
            onEditForm={(c) => setView({ type: 'form', client: c })}
            onViewResponses={(c) => setView({ type: 'responses', client: c })}
          />
        )}
        {view.type === 'form' && (
          <FormEditor client={view.client} onBack={() => setView({ type: 'clients' })} />
        )}
        {view.type === 'responses' && (
          <ResponsesViewer client={view.client} onBack={() => setView({ type: 'clients' })} />
        )}
      </main>
    </div>
  );
};

export default AdminPage;
