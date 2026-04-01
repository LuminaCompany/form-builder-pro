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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required
    const missing = questions.filter(q => q.required && !answers[q.question]?.trim());
    if (missing.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missing.map(q => q.question).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('form_responses').insert({
      client_id: client!.id,
      answers,
    });

    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    // Try to send notification (non-blocking)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          clientName: client!.name,
          answers,
        },
      });
    } catch {
      // Silently fail — notification will be configured later
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle className="mx-auto h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Formulário não encontrado</h1>
          <p className="text-muted-foreground">O link que você acessou não corresponde a nenhum formulário.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h1 className="text-2xl font-bold">Obrigado!</h1>
          <p className="text-muted-foreground">Suas respostas foram enviadas com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Onboarding</h1>
          <p className="text-muted-foreground">{client?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>
                {q.question}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {q.type === 'text' && (
                <Input
                  value={answers[q.question] || ''}
                  onChange={(e) => setAnswer(q.question, e.target.value)}
                  placeholder="Sua resposta"
                />
              )}

              {q.type === 'textarea' && (
                <Textarea
                  value={answers[q.question] || ''}
                  onChange={(e) => setAnswer(q.question, e.target.value)}
                  placeholder="Sua resposta"
                  rows={4}
                />
              )}

              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        answers[q.question] === opt
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
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
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        answers[q.question] === opt ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {answers[q.question] === opt && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'yes_no' && (
                <div className="flex gap-3">
                  {['Sim', 'Não'].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={answers[q.question] === opt ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAnswer(q.question, opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {questions.length > 0 && (
            <Button type="submit" className="w-full h-12" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar Respostas
            </Button>
          )}

          {questions.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Este formulário ainda não possui perguntas.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
