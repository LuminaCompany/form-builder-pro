import { useState, useEffect } from 'react';
import { ArrowLeft, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client, FormResponse } from '@/types/onboarding';

interface ResponsesViewerProps {
  client: Client;
  onBack: () => void;
}

const ResponsesViewer = ({ client, onBack }: ResponsesViewerProps) => {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('form_responses')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Erro ao carregar respostas', description: error.message, variant: 'destructive' });
      } else {
        setResponses(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [client.id]);

  const exportCSV = () => {
    if (responses.length === 0) {
      toast({ title: 'Nenhuma resposta para exportar', variant: 'destructive' });
      return;
    }
    const allKeys = new Set<string>();
    responses.forEach(r => Object.keys(r.answers || {}).forEach(k => allKeys.add(k)));
    const keys = Array.from(allKeys);
    const header = ['ID', 'Data', ...keys].join(',');
    const rows = responses.map(r => {
      const date = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '';
      const values = keys.map(k => `"${(r.answers?.[k] || '').replace(/"/g, '""')}"`);
      return [r.id, `"${date}"`, ...values].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respostas-${client.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-primary/10 hover:text-primary">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <h2 className="text-xl font-semibold text-gradient-cyan">Respostas — {client.name}</h2>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={responses.length === 0} className="border-primary/25 hover:bg-primary/10 hover:text-primary">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : responses.length === 0 ? (
        <div className="rounded-lg border border-primary/10 bg-card p-12 text-center">
          <p className="text-muted-foreground">Nenhuma resposta recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((r) => (
            <div key={r.id} className="rounded-lg border border-primary/15 bg-card overflow-hidden transition-all glow-cyan-hover">
              <button
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-primary/5 transition-colors"
              >
                <span className="text-sm text-foreground">
                  Resposta #{r.id.slice(0, 8)}
                </span>
                {expandedId === r.id ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedId === r.id && (
                <div className="border-t border-primary/10 p-4 space-y-3">
                  {Object.entries(r.answers || {}).map(([question, answer]) => (
                    <div key={question} className="space-y-1">
                      <p className="text-sm font-medium text-primary">{question}</p>
                      <p className="text-sm text-foreground">{answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResponsesViewer;
