import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase, SUPABASE_PROJECT_URL } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client, FormQuestion, OptionItem } from '@/types/onboarding';
import { normalizeOptions } from '@/types/onboarding';

const OnboardingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!clientData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setClient(clientData);

      document.title = clientData.tab_title || 'Formulário de Briefing';

      const existingFavicon = document.querySelector("link[rel='icon']");
      if (clientData.favicon_url) {
        if (existingFavicon) {
          (existingFavicon as HTMLLinkElement).href = clientData.favicon_url;
        } else {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.href = clientData.favicon_url;
          document.head.appendChild(link);
        }
      }

      const { data: questionsData } = await supabase
        .from('form_questions')
        .select('*')
        .eq('client_id', clientData.id)
        .order('order_index', { ascending: true });

      const normalized = (questionsData || []).map((q: any) => ({
        ...q,
        options: normalizeOptions(q.options),
      }));
      setQuestions(normalized);
      setLoading(false);
    };
    fetch();
  }, [slug]);

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const setOtherText = (question: string, value: string) => {
    setOtherTexts((prev) => ({ ...prev, [question]: value }));
  };

  /** Check if the currently selected option for a question has followUp */
  const getSelectedOption = (q: FormQuestion): OptionItem | undefined => {
    const selected = answers[q.question];
    if (!selected || !q.options) return undefined;
    return q.options.find(o => o.label === selected);
  };

  const getFinalAnswer = (q: FormQuestion): string => {
    const raw = answers[q.question] || '';
    if (q.type === 'multiple_choice' && q.allow_other && raw === '__other__') {
      const text = otherTexts[q.question]?.trim() || '';
      return text ? `Outro: ${text}` : '';
    }
    return raw;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing: string[] = [];
    questions.forEach(q => {
      if (!q.required) return;
      const final = getFinalAnswer(q);
      if (!final.trim()) {
        missing.push(q.question);
        return;
      }
      // If selected option has followUp, the followup field is also required
      const selectedOpt = getSelectedOption(q);
      if (selectedOpt?.followUp) {
        const followUpVal = answers[`${q.id}_followup`]?.trim();
        if (!followUpVal) {
          missing.push(`${q.question} (detalhes)`);
        }
      }
    });

    if (missing.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const finalAnswers: Record<string, string> = {};
    questions.forEach(q => {
      const val = getFinalAnswer(q);
      if (val) finalAnswers[q.question] = val;
      // Include followup answers
      const followUpVal = answers[`${q.id}_followup`]?.trim();
      if (followUpVal) {
        finalAnswers[`${q.question} (detalhes)`] = followUpVal;
      }
    });

    const { error } = await supabase.from('form_responses').insert({
      client_id: client!.id,
      answers: finalAnswers,
    });

    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          clientName: client!.name,
          answers: finalAnswers,
        },
      });
    } catch {
      // Silently fail
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  /** Render the follow-up text field if the selected option has followUp: true */
  const renderFollowUp = (q: FormQuestion) => {
    const selectedOpt = getSelectedOption(q);
    if (!selectedOpt?.followUp) return null;

    return (
      <div className="overflow-hidden transition-all duration-300 ease-in-out animate-fade-in-up">
        <Input
          value={answers[`${q.id}_followup`] || ''}
          onChange={(e) => setAnswer(`${q.id}_followup`, e.target.value)}
          placeholder="Descreva aqui..."
          className="bg-secondary border-primary/20 mt-2"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="relative z-10 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative z-10 text-center space-y-4 animate-fade-in-up">
          <AlertCircle className="mx-auto h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Formulário não encontrado</h1>
          <p className="text-muted-foreground">O link que você acessou não corresponde a nenhum formulário.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative z-10 text-center space-y-4 animate-fade-in-up">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-gradient-cyan">Obrigado!</h1>
          <p className="text-muted-foreground text-lg">Suas respostas foram enviadas com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-12">
      <div className="relative z-10 w-full max-w-lg space-y-8">
        {client?.lumina_branding && (
          <div className="text-center">
            <span className="text-2xl font-bold tracking-wider text-primary">LUMINA</span>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gradient-cyan">Onboarding</h1>
          <p className="text-muted-foreground text-lg">{client?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-primary/15 bg-card p-6 sm:p-8 glow-cyan">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-foreground">
                {q.question}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {q.type === 'text' && (
                <Input
                  value={answers[q.question] || ''}
                  onChange={(e) => setAnswer(q.question, e.target.value)}
                  placeholder="Sua resposta"
                  className="bg-secondary border-primary/20"
                />
              )}

              {q.type === 'textarea' && (
                <Textarea
                  value={answers[q.question] || ''}
                  onChange={(e) => setAnswer(q.question, e.target.value)}
                  placeholder="Sua resposta"
                  rows={4}
                  className="bg-secondary border-primary/20"
                />
              )}

              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <div key={opt.label}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                          answers[q.question] === opt.label
                            ? 'border-primary bg-primary/10 glow-cyan'
                            : 'border-primary/15 hover:border-primary/40 bg-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.label}
                          checked={answers[q.question] === opt.label}
                          onChange={() => {
                            setAnswer(q.question, opt.label);
                            // Clear followup if switching to non-followup option
                            if (!opt.followUp) {
                              setAnswers(prev => {
                                const next = { ...prev };
                                delete next[`${q.id}_followup`];
                                return next;
                              });
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          answers[q.question] === opt.label ? 'border-primary' : 'border-muted-foreground'
                        }`}>
                          {answers[q.question] === opt.label && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                      {answers[q.question] === opt.label && opt.followUp && (
                        <div className="animate-fade-in-up">
                          <Input
                            value={answers[`${q.id}_followup`] || ''}
                            onChange={(e) => setAnswer(`${q.id}_followup`, e.target.value)}
                            placeholder="Descreva aqui..."
                            className="bg-secondary border-primary/20 mt-2 ml-7"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {q.allow_other && (
                    <>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                          answers[q.question] === '__other__'
                            ? 'border-primary bg-primary/10 glow-cyan'
                            : 'border-primary/15 hover:border-primary/40 bg-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value="__other__"
                          checked={answers[q.question] === '__other__'}
                          onChange={() => setAnswer(q.question, '__other__')}
                          className="sr-only"
                        />
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          answers[q.question] === '__other__' ? 'border-primary' : 'border-muted-foreground'
                        }`}>
                          {answers[q.question] === '__other__' && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm text-foreground">Outro</span>
                      </label>
                      {answers[q.question] === '__other__' && (
                        <Input
                          value={otherTexts[q.question] || ''}
                          onChange={(e) => setOtherText(q.question, e.target.value)}
                          placeholder="Descreva aqui..."
                          className="bg-secondary border-primary/20 ml-7"
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {q.type === 'yes_no' && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    {(q.options || [{ label: 'Sim', followUp: false }, { label: 'Não', followUp: false }]).map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        className={`flex-1 rounded-lg border py-3 px-4 font-medium transition-all ${
                          answers[q.question] === opt.label
                            ? 'border-primary bg-primary text-primary-foreground glow-cyan'
                            : 'border-primary/20 bg-secondary text-foreground hover:border-primary/40'
                        }`}
                        onClick={() => {
                          setAnswer(q.question, opt.label);
                          if (!opt.followUp) {
                            setAnswers(prev => {
                              const next = { ...prev };
                              delete next[`${q.id}_followup`];
                              return next;
                            });
                          }
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {q.allow_other && (
                      <button
                        type="button"
                        className={`flex-1 rounded-lg border py-3 px-4 font-medium transition-all ${
                          answers[q.question]?.startsWith('Outro:') || answers[q.question] === 'Outro'
                            ? 'border-primary bg-primary text-primary-foreground glow-cyan'
                            : 'border-primary/20 bg-secondary text-foreground hover:border-primary/40'
                        }`}
                        onClick={() => setAnswer(q.question, 'Outro')}
                      >
                        Outro
                      </button>
                    )}
                  </div>
                  {/* Follow-up for yes_no */}
                  {renderFollowUp(q)}
                  {q.allow_other && (answers[q.question] === 'Outro' || answers[q.question]?.startsWith('Outro:')) && (
                    <Input
                      placeholder="Descreva aqui..."
                      value={answers[q.question]?.startsWith('Outro: ') ? answers[q.question].slice(7) : ''}
                      onChange={(e) => setAnswer(q.question, e.target.value ? `Outro: ${e.target.value}` : 'Outro')}
                      className="bg-secondary border-primary/20 focus:border-primary"
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {questions.length > 0 && (
            <Button type="submit" className="w-full h-12 font-bold text-lg text-primary-foreground hover:shadow-[0_0_25px_rgba(0,229,255,0.3)] transition-shadow" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Enviar Respostas
            </Button>
          )}

          {questions.length === 0 && (
            <div className="rounded-lg border border-primary/10 bg-secondary p-8 text-center">
              <p className="text-muted-foreground">Este formulário ainda não possui perguntas.</p>
            </div>
          )}
        </form>

        {client?.lumina_branding && (
          <div className="border-t border-primary/10 pt-6 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Powered by</p>
            <p className="text-sm font-bold text-primary">Lumina Company</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
