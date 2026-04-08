import { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileDown, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
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

type AnswerValue = string | string[] | undefined;

const normalizeAnswerMap = (raw: unknown): Record<string, AnswerValue> => {
  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, AnswerValue>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, AnswerValue>)
    : {};
};

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isFollowUpKey = (key: string) => key.endsWith('_followup') || key.endsWith(' (detalhes)');

const getAnswerValue = (
  answers: Record<string, AnswerValue>,
  normalizedAnswers: Map<string, AnswerValue>,
  candidates: string[]
): AnswerValue => {
  for (const candidate of candidates) {
    if (candidate in answers) return answers[candidate];
  }

  for (const candidate of candidates) {
    const normalized = normalizedAnswers.get(normalizeKey(candidate));
    if (normalized !== undefined) return normalized;
  }

  return undefined;
};

const isEmptyAnswer = (value: AnswerValue) => {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === '';
};

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
        const normalized = (resResult.data || []).map(r => ({
          ...r,
          answers: normalizeAnswerMap(r.answers),
        }));
        setResponses(normalized);
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

  /** Parse a stored answer that might be a JSON array, string, or array */
  const parseAnswer = (raw: AnswerValue): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed != null) return [String(parsed)];
    } catch { /* not JSON */ }
    return [raw];
  };

  const exportSingleResponse = (r: FormResponse) => {
    const ans = normalizeAnswerMap(r.answers);
    const normalizedAnswers = new Map(Object.entries(ans).map(([key, value]) => [normalizeKey(key), value] as const));
    const legacyMainEntries = Object.entries(ans).filter(([key]) => !isFollowUpKey(key));
    const hasDirectQuestionMatch = questions.some((q) =>
      getAnswerValue(ans, normalizedAnswers, [q.id, q.question]) !== undefined
    );
    const useLegacyOrderFallback = !hasDirectQuestionMatch && legacyMainEntries.length > 0;

    const dateStr = r.submitted_at ? new Date(r.submitted_at).toLocaleString('pt-BR') : 'N/A';
    const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const lines: string[] = [
      sep,
      '',
      `RESPOSTAS DE ONBOARDING — ${client.name.toUpperCase()}`,
      '',
      `Data de envio: ${dateStr}`,
      '',
      sep,
      '',
    ];

    questions.forEach((q, idx) => {
      const legacyMainKey = useLegacyOrderFallback ? legacyMainEntries[idx]?.[0] : undefined;
      const mainAnswer = getAnswerValue(ans, normalizedAnswers, [
        q.id, q.question, ...(legacyMainKey ? [legacyMainKey] : []),
      ]);
      const followUpAnswer = getAnswerValue(ans, normalizedAnswers, [
        `${q.id}_followup`, `${q.id} (detalhes)`, `${q.question} (detalhes)`,
        ...(legacyMainKey ? [`${legacyMainKey}_followup`, `${legacyMainKey} (detalhes)`] : []),
      ]);
      const isMulti = q.type === 'multiple_choice' || q.type === 'yes_no';
      const values = isMulti ? parseAnswer(mainAnswer) : [];

      lines.push(`${idx + 1}. ${q.question}`);
      lines.push('');

      if (isEmptyAnswer(mainAnswer)) {
        lines.push('→ Não respondido');
      } else if (isMulti) {
        lines.push(`→ ${values.join(', ')}`);
      } else {
        lines.push(`→ ${mainAnswer}`);
      }

      if (followUpAnswer && !isEmptyAnswer(followUpAnswer)) {
        let followUpLabel = '';
        if (q.options) {
          const opt = q.options.find(o => o.followUp && values.includes(o.label));
          followUpLabel = opt?.followUpQuestion || '';
        }
        lines.push('');
        lines.push(`   ↳ ${followUpLabel ? followUpLabel + ': ' : ''}${followUpAnswer}`);
      }

      lines.push('');
    });

    lines.push(sep);

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateFile = r.submitted_at
      ? new Date(r.submitted_at).toLocaleDateString('pt-BR').replace(/\//g, '-')
      : 'sem-data';
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboarding-${client.slug}-${dateFile}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderResponseBody = (r: FormResponse) => {
    const ans = normalizeAnswerMap(r.answers);
    const normalizedAnswers = new Map(Object.entries(ans).map(([key, value]) => [normalizeKey(key), value] as const));
    const legacyMainEntries = Object.entries(ans).filter(([key]) => !isFollowUpKey(key));
    const hasDirectQuestionMatch = questions.some((q) =>
      getAnswerValue(ans, normalizedAnswers, [q.id, q.question]) !== undefined
    );
    const useLegacyOrderFallback = !hasDirectQuestionMatch && legacyMainEntries.length > 0;

    return (
      <div className="border-t border-primary/10 p-4 space-y-5">
        {questions.map((q, idx) => {
          const legacyMainKey = useLegacyOrderFallback ? legacyMainEntries[idx]?.[0] : undefined;
          const mainAnswer = getAnswerValue(ans, normalizedAnswers, [
            q.id,
            q.question,
            ...(legacyMainKey ? [legacyMainKey] : []),
          ]);
          const followUpAnswer = getAnswerValue(ans, normalizedAnswers, [
            `${q.id}_followup`,
            `${q.id} (detalhes)`,
            `${q.question} (detalhes)`,
            ...(legacyMainKey ? [`${legacyMainKey}_followup`, `${legacyMainKey} (detalhes)`] : []),
          ]);
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

              {isEmptyAnswer(mainAnswer) ? (
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); exportSingleResponse(r); }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <FileDown className="mr-1 h-3.5 w-3.5" /> Exportar
                  </Button>
                {expandedId === r.id ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                </div>
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
