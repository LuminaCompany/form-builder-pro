import { useState, useEffect } from 'react';
import { Plus, Copy, Edit, Eye, Trash2, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/types/onboarding';

interface ClientsListProps {
  onEditForm: (client: Client) => void;
  onViewResponses: (client: Client) => void;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const ClientsList = ({ onEditForm, onViewResponses }: ClientsListProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tabTitle, setTabTitle] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [luminaBranding, setLuminaBranding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar clientes', description: error.message, variant: 'destructive' });
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(slugify(value));
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('clients').insert({
      name,
      slug,
      status: 'pending',
      tab_title: tabTitle.trim() || null,
      favicon_url: faviconUrl.trim() || null,
      lumina_branding: luminaBranding,
    });
    if (error) {
      toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cliente criado com sucesso!' });
      setModalOpen(false);
      setName('');
      setSlug('');
      setTabTitle('');
      setFaviconUrl('');
      setLuminaBranding(false);
      fetchClients();
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Erro ao excluir cliente', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cliente excluído com sucesso' });
      fetchClients();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const copyLink = (clientSlug: string) => {
    const link = `${window.location.origin}/onboarding/${clientSlug}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    completed: 'bg-primary/15 text-primary border-primary/25',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    active: 'Ativo',
    completed: 'Concluído',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gradient-cyan">Clientes</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="font-semibold"><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="border-primary/20 bg-popover">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Nome do cliente" className="bg-secondary border-primary/20" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-do-cliente" className="bg-secondary border-primary/20" />
              </div>
              <div className="space-y-2">
                <Label>Nome da aba (título da página)</Label>
                <Input value={tabTitle} onChange={(e) => setTabTitle(e.target.value)} placeholder="ex: Briefing – Empresa X" className="bg-secondary border-primary/20" />
              </div>
              <div className="space-y-2">
                <Label>Favicon (URL da imagem)</Label>
                <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="Cole a URL de uma imagem .png ou .ico (32x32)" className="bg-secondary border-primary/20" />
                <p className="text-xs text-muted-foreground">Use uma imagem quadrada de 32x32px. Sugestão: converta em <a href="https://favicon.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">favicon.io</a></p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="lumina-branding">Branding Lumina</Label>
                <Switch id="lumina-branding" checked={luminaBranding} onCheckedChange={setLuminaBranding} />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full font-semibold">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-primary/10 bg-card p-12 text-center">
          <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="flex flex-col gap-3 rounded-lg border border-primary/15 bg-card p-4 transition-all glow-cyan-hover sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{client.name}</span>
                  <Badge variant="outline" className={statusColors[client.status]}>
                    {statusLabels[client.status] || client.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">/{client.slug} · {new Date(client.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copyLink(client.slug)} className="border-primary/25 hover:bg-primary/10 hover:text-primary">
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEditForm(client)} className="border-primary/25 hover:bg-primary/10 hover:text-primary">
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Editar Formulário
                </Button>
                <Button variant="outline" size="sm" onClick={() => onViewResponses(client)} className="border-primary/25 hover:bg-primary/10 hover:text-primary">
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver Respostas
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(client)} className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-primary/20 bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o cliente <strong className="text-foreground">{deleteTarget?.name}</strong>? Esta ação também removerá todas as perguntas e respostas vinculadas e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/25 hover:bg-primary/10 hover:text-primary" disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsList;
