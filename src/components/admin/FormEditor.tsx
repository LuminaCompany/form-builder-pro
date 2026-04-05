import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowLeft, Loader2, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Client, FormQuestion, OptionItem, normalizeOptions } from '@/types/onboarding';
import { normalizeOptions as normalize } from '@/types/onboarding';

interface FormEditorProps {
  client: Client;
  onBack: () => void;
}

const typeLabels: Record<string, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  multiple_choice: 'Múltipla escolha',
  yes_no: 'Sim/Não',
};

const FormEditor = ({ client, onBack }: FormEditorProps) => {
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newType, setNewType] = useState<FormQuestion['type']>('text');
  const [newRequired, setNewRequired] = useState(true);
  const [newAllowOther, setNewAllowOther] = useState(false);
  const [newOptions, setNewOptions] = useState<OptionItem[]>([{ label: '', followUp: false, followUpQuestion: '' }]);
  const { toast } = useToast();

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('form_questions')
      .select('*')
      .eq('client_id', client.id)
      .order('order_index', { ascending: true });
    if (error) {
      toast({ title: 'Erro ao carregar perguntas', description: error.message, variant: 'destructive' });
    } else {
      // Normalize options from DB
      const normalized = (data || []).map((q: any) => ({
        ...q,
        options: normalize(q.options),
      }));
      setQuestions(normalized);
    }
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, [client.id]);

  const resetForm = () => {
    setNewQuestion('');
    setNewType('text');
    setNewRequired(true);
    setNewAllowOther(false);
    setNewOptions([{ label: '', followUp: false, followUpQuestion: '' }]);
    setEditingQuestion(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (q: FormQuestion) => {
    setEditingQuestion(q);
    setNewQuestion(q.question);
    setNewType(q.type);
    setNewRequired(q.required);
    setNewAllowOther(q.allow_other);
    if (q.type === 'yes_no') {
      // For yes_no, use stored options or default
      const opts = q.options && q.options.length > 0 ? [...q.options] : [
        { label: 'Sim', followUp: false },
        { label: 'Não', followUp: false },
      ];
      setNewOptions(opts);
    } else {
      setNewOptions(q.options && q.options.length > 0 ? [...q.options] : [{ label: '', followUp: false }]);
    }
    setModalOpen(true);
  };

  const handleTypeChange = (v: FormQuestion['type']) => {
    setNewType(v);
    if (v !== 'multiple_choice' && v !== 'yes_no') setNewAllowOther(false);
    if (v === 'yes_no') {
      setNewOptions([
        { label: 'Sim', followUp: false, followUpQuestion: '' },
        { label: 'Não', followUp: false, followUpQuestion: '' },
      ]);
    } else if (v === 'multiple_choice') {
      // Keep existing or reset
      if (newOptions.length === 0 || (newOptions.length === 2 && newOptions[0].label === 'Sim')) {
        setNewOptions([{ label: '', followUp: false, followUpQuestion: '' }]);
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (!newQuestion.trim()) {
      toast({ title: 'Digite a pergunta', variant: 'destructive' });
      return;
    }

    let filteredOptions: OptionItem[] | null = null;
    if (newType === 'multiple_choice') {
      filteredOptions = newOptions.filter(o => o.label.trim());
      if (filteredOptions.length < 2) {
        toast({ title: 'Adicione pelo menos 2 opções', variant: 'destructive' });
        return;
      }
    } else if (newType === 'yes_no') {
      filteredOptions = newOptions;
    }

    setSaving(true);

    const payload = {
      question: newQuestion,
      type: newType,
      options: filteredOptions,
      required: newRequired,
      allow_other: (newType === 'multiple_choice' || newType === 'yes_no') ? newAllowOther : false,
    };

    if (editingQuestion) {
      const { error } = await supabase.from('form_questions').update(payload).eq('id', editingQuestion.id);
      if (error) {
        toast({ title: 'Erro ao atualizar pergunta', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Pergunta atualizada!' });
        setModalOpen(false);
        resetForm();
        fetchQuestions();
      }
    } else {
      const { error } = await supabase.from('form_questions').insert({
        ...payload,
        client_id: client.id,
        order_index: questions.length,
      });
      if (error) {
        toast({ title: 'Erro ao adicionar pergunta', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Pergunta adicionada!' });
        setModalOpen(false);
        resetForm();
        fetchQuestions();
      }
    }
    setSaving(false);
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from('form_questions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pergunta removida' });
      fetchQuestions();
    }
  };

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const updated = [...questions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    await Promise.all([
      supabase.from('form_questions').update({ order_index: newIndex }).eq('id', updated[newIndex].id),
      supabase.from('form_questions').update({ order_index: index }).eq('id', updated[index].id),
    ]);
    fetchQuestions();
  };

  const updateOption = (index: number, fields: Partial<OptionItem>) => {
    const updated = [...newOptions];
    updated[index] = { ...updated[index], ...fields };
    setNewOptions(updated);
  };

  const getOptionLabels = (options: OptionItem[] | null) => {
    if (!options) return '';
    return options.map(o => o.label + (o.followUp ? ' (📝)' : '')).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-primary/10 hover:text-primary">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <h2 className="text-xl font-semibold text-gradient-cyan">Formulário — {client.name}</h2>
      </div>

      <Button onClick={openAddModal} className="font-semibold">
        <Plus className="mr-2 h-4 w-4" /> Adicionar Pergunta
      </Button>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-lg border border-primary/10 bg-card p-12 text-center">
          <p className="text-muted-foreground">Nenhuma pergunta cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 rounded-lg border border-primary/15 bg-card p-4 transition-all glow-cyan-hover">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => moveQuestion(i, 'up')} disabled={i === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => moveQuestion(i, 'down')} disabled={i === questions.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 space-y-1 cursor-pointer" onClick={() => openEditModal(q)}>
                <p className="font-medium text-foreground">{q.question}</p>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{typeLabels[q.type]}</span>
                  {q.required && <span className="text-primary">• Obrigatório</span>}
                  {q.allow_other && <span className="text-primary">• Outro</span>}
                  {q.options && <span>• Opções: {getOptionLabels(q.options)}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary" onClick={() => openEditModal(q)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteQuestion(q.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="border-primary/20 bg-popover max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Digite a pergunta" className="bg-secondary border-primary/20" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newType} onValueChange={(v) => handleTypeChange(v as FormQuestion['type'])}>
                <SelectTrigger className="bg-secondary border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent className="border-primary/20 bg-popover">
                  <SelectItem value="text">Texto curto</SelectItem>
                  <SelectItem value="textarea">Texto longo</SelectItem>
                  <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                  <SelectItem value="yes_no">Sim/Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newType === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Opções</Label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(i, 'label', e.target.value)}
                      placeholder={`Opção ${i + 1}`}
                      className="bg-secondary border-primary/20 flex-1"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={opt.followUp}
                        onCheckedChange={(v) => {
                          updateOption(i, 'followUp', v);
                          if (!v) updateOption(i, 'followUpQuestion', '');
                        }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Detalhes</span>
                    </div>
                    {opt.followUp && (
                      <Input
                        value={opt.followUpQuestion || ''}
                        onChange={(e) => updateOption(i, 'followUpQuestion', e.target.value)}
                        placeholder="Qual pergunta deve aparecer? Ex: Qual o nome da IA?"
                        className="bg-secondary border-primary/20 flex-1 text-xs"
                      />
                    )}
                    {newOptions.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))} className="hover:bg-destructive/10 hover:text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewOptions([...newOptions, { label: '', followUp: false, followUpQuestion: '' }])} className="border-primary/25 hover:bg-primary/10 hover:text-primary">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar opção
                </Button>
              </div>
            )}

            {newType === 'yes_no' && (
              <div className="space-y-2">
                <Label>Pedir detalhes</Label>
                {newOptions.map((opt, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-secondary p-3">
                      <span className="text-sm text-foreground font-medium">{opt.label}</span>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={opt.followUp}
                          onCheckedChange={(v) => {
                            updateOption(i, 'followUp', v);
                            if (!v) updateOption(i, 'followUpQuestion', '');
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Detalhes</span>
                      </div>
                    </div>
                    {opt.followUp && (
                      <Input
                        value={opt.followUpQuestion || ''}
                        onChange={(e) => updateOption(i, 'followUpQuestion', e.target.value)}
                        placeholder="Qual pergunta deve aparecer? Ex: Qual o nome da IA?"
                        className="bg-secondary border-primary/20 text-xs mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={newRequired} onCheckedChange={setNewRequired} />
                <Label>Obrigatório</Label>
              </div>
              {(newType === 'multiple_choice' || newType === 'yes_no') && (
                <div className="flex items-center gap-2">
                  <Switch checked={newAllowOther} onCheckedChange={setNewAllowOther} />
                  <Label>Outro?</Label>
                </div>
              )}
            </div>
            <Button onClick={handleSaveQuestion} disabled={saving} className="w-full font-semibold">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingQuestion ? 'Atualizar Pergunta' : 'Salvar Pergunta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormEditor;
