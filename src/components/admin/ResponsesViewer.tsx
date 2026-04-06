import { useState, useEffect } from 'react';
import { ArrowLeft, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client, FormResponse, FormQuestion } from '@/types/onboarding';
import { normalizeOptions } from '@/types/onboarding';

interface ResponsesViewerProps {
  client: Client;
  onBack: () => void;
}

const ResponsesViewer = ({ client, onBack }: ResponsesViewerProps) => {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [resResult, qResult] = await Promise.all([
        supabase.from('form_responses').select('*').eq('client_id', client.id).order('submitted_at', { ascending: false }),
        supabase.from('form_questions').select('*').eq('client_id', client.id).order('order_index', { ascending: true }),
      ]);
      if (resResult.error) {
        toast({ title: 'Erro ao carregar respostas', description: resResult.error.message, variant: 'destructive' });
      } else {
        setResponses(resResult.data || []);
      }
      setQuestions((qResult.data || []).map(q => ({ ...q, options: normalizeOptions(q.options) })));
      setLoading(false);
    };
    load();
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
      const date = r.submitted_at ? new Date(r.submitted_at).toLocaleString('pt-BR') : '';
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

  /** Parse a stored answer that might be a JSON array or plain string */
  const parseAnswer = (raw: string | undefined): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not JSON */ }
    return [raw];
  };

  const renderResponseBody = (r: FormResponse) => {
    const ans = r.answers || {};

    return (
      <div className="border-t border-primary/10 p-4 space-y-5">
        {questions.map((q, idx) => {
          const mainAnswer = ans[q.id];
          const followUpAnswer = ans[`${q.id} (detalhes)`];
          const isMulti = q.type === 'multiple_choice' || q.type === 'yes_no';
          const values = isMulti ? parseAnswer(mainAnswer) : [];

          // Find the followUp question text from selected options
          let followUpLabel = '';
          if (followUpAnswer && q.options) {
            const selectedWithFollowUp = q.options.find(
              o => o.followUp && values.includes(o.label)
            );
            followUpLabel = selectedWithFollowUp?.followUpQuestion || '';
          }

          return (
            <div key={q.id} className="space-y-1.5">
              <p className="text-sm font-medium text-primary">
                {idx + 1}. {q.question}
              </p>

              {!mainAnswer ? (
                <p className="text-sm text-muted-foreground italic">Não respondido</p>
              ) : isMulti ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => (
                      <Badge key={v} className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/15">
                        {v}
                      </Badge>
                    ))}
                  </div>
                  {followUpAnswer && (
                    <div className="ml-3 border-l-2 border-primary/20 pl-3 space-y-0.5">
                      {followUpLabel && (
                        <p className="text-xs font-medium text-muted-foreground">{followUpLabel}</p>
                      )}
                      <p className="text-sm text-foreground">{followUpAnswer}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{mainAnswer}</p>
              )}
            </div>
          );
        })}
      </div>
    );
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
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Resposta #{r.id.slice(0, 8)}</span>
                  {r.submitted_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.submitted_at).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
                {expandedId === r.id ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedId === r.id && renderResponseBody(r)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResponsesViewer;
