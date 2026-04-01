import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase, SUPABASE_PROJECT_URL } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client, FormQuestion } from '@/types/onboarding';

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

      const { data: questionsData } = await supabase
        .from('form_questions')
        .select('*')
        .eq('client_id', clientData.id)
        .order('order_index', { ascending: true });

      setQuestions(questionsData || []);
      setLoading(false);
    };
    fetch();
  }, [slug]);

  const setAnswer = (question: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [question]: value }));
  };

  const setOtherText = (question: string, value: string) => {
    setOtherTexts((prev) => ({ ...prev, [question]: value }));
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

    const missing = questions.filter(q => {
      if (!q.required) return false;
      const final = getFinalAnswer(q);
      return !final.trim();
    });
    if (missing.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missing.map(q => q.question).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const finalAnswers: Record<string, string> = {};
    questions.forEach(q => {
      const val = getFinalAnswer(q);
      if (val) finalAnswers[q.question] = val;
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

  if (loading) {
    return (
      <div className="particles-bg flex min-h-screen items-center justify-center">
        <Loader2 className="relative z-10 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="particles-bg flex min-h-screen items-center justify-center p-4">
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
      <div className="particles-bg flex min-h-screen items-center justify-center p-4">
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
    <div className="particles-bg flex min-h-screen items-center justify-center p-4 py-12">
      <div className="relative z-10 w-full max-w-lg space-y-8">
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
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                        answers[q.question] === opt
                          ? 'border-primary bg-primary/10 glow-cyan'
                          : 'border-primary/15 hover:border-primary/40 bg-secondary'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.question] === opt}
                        onChange={() => setAnswer(q.question, opt)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        answers[q.question] === opt ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {answers[q.question] === opt && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm text-foreground">{opt}</span>
                    </label>
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
                <div className="flex gap-3">
                  {['Sim', 'Não'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`flex-1 rounded-lg border py-3 px-4 font-medium transition-all ${
                        answers[q.question] === opt
                          ? 'border-primary bg-primary text-primary-foreground glow-cyan'
                          : 'border-primary/20 bg-secondary text-foreground hover:border-primary/40'
                      }`}
                      onClick={() => setAnswer(q.question, opt)}
                    >
                      {opt}
                    </button>
                  ))}
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
      </div>
    </div>
  );
};

export default OnboardingPage;
