import type { OptionItem } from '@/types/onboarding';

export interface ParsedQuestion {
  question: string;
  type: 'text' | 'textarea' | 'multiple_choice' | 'yes_no';
  options: OptionItem[] | null;
  allow_other: boolean;
  /** Answer value as it should be saved in form_responses.answers */
  answerValue: string | string[];
  /** Optional follow-up text answered by client */
  followUpAnswer?: string;
  /** Which option label should carry the followUp flag */
  followUpForOption?: string;
  followUpQuestion?: string;
}

export interface ParsedImport {
  clientName: string;
  submittedAt?: string;
  questions: ParsedQuestion[];
}

const SEP_RE = /^━+\s*$/;

function inferType(answer: string, parts: string[]): { type: ParsedQuestion['type']; options: OptionItem[] | null; answerValue: string | string[]; allow_other: boolean } {
  const trimmed = answer.trim();
  // Yes/No
  if (/^(sim|não|nao)$/i.test(trimmed)) {
    return {
      type: 'yes_no',
      options: [
        { label: 'Sim', followUp: false, followUpQuestion: '' },
        { label: 'Não', followUp: false, followUpQuestion: '' },
      ],
      answerValue: [trimmed],
      allow_other: false,
    };
  }
  // Multiple choice (comma-separated, more than one part OR contains "Outro:")
  if (parts.length > 1 || /^Outro:/i.test(trimmed)) {
    const allow_other = parts.some((p) => /^Outro:/i.test(p.trim()));
    const optionLabels = parts
      .map((p) => p.trim())
      .filter((p) => p && !/^Outro:/i.test(p));
    const options: OptionItem[] = optionLabels.map((label) => ({ label, followUp: false, followUpQuestion: '' }));
    return {
      type: 'multiple_choice',
      options,
      answerValue: parts.map((p) => p.trim()),
      allow_other,
    };
  }
  // Long text → textarea, short → text
  const isLong = trimmed.length > 80 || trimmed.includes('\n');
  return {
    type: isLong ? 'textarea' : 'text',
    options: null,
    answerValue: trimmed,
    allow_other: false,
  };
}

export function parseImportFile(content: string): ParsedImport {
  const lines = content.split(/\r?\n/);
  let clientName = 'Importado';
  let submittedAt: string | undefined;

  // Find header
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/RESPOSTAS DE ONBOARDING\s*[—-]\s*(.+)/i);
    if (m) clientName = m[1].trim();
    const d = lines[i].match(/Data de envio:\s*(.+)/i);
    if (d) submittedAt = d[1].trim();
  }

  // Split into question blocks. A block starts with "N. " at start of line.
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const raw of lines) {
    if (SEP_RE.test(raw)) continue;
    if (/^\d+\.\s+/.test(raw)) {
      if (current) blocks.push(current);
      current = [raw];
    } else if (current) {
      current.push(raw);
    }
  }
  if (current) blocks.push(current);

  const questions: ParsedQuestion[] = [];
  for (const block of blocks) {
    // First line: "N. <question text>"
    const first = block[0].replace(/^\d+\.\s+/, '').trim();
    // Find the answer line(s): start with "→" then accumulate following non-arrow non-followup lines until "↳" or end
    let answerLines: string[] = [];
    let followUpLines: string[] = [];
    let inAnswer = false;
    let inFollowUp = false;
    for (let i = 1; i < block.length; i++) {
      const line = block[i];
      if (/^→\s?/.test(line.trim())) {
        inAnswer = true;
        inFollowUp = false;
        answerLines.push(line.trim().replace(/^→\s?/, ''));
        continue;
      }
      if (/^↳\s?/.test(line.trim()) || /^\s+↳/.test(line)) {
        inFollowUp = true;
        inAnswer = false;
        followUpLines.push(line.trim().replace(/^↳\s?/, ''));
        continue;
      }
      if (inFollowUp) {
        followUpLines.push(line);
      } else if (inAnswer) {
        answerLines.push(line);
      }
    }

    const rawAnswer = answerLines.join('\n').replace(/\n+$/g, '').trim();
    if (!rawAnswer && followUpLines.length === 0) {
      // No answer
      questions.push({
        question: first,
        type: 'textarea',
        options: null,
        allow_other: false,
        answerValue: '',
      });
      continue;
    }

    // For multi-choice detection, only split on top-level commas if the answer is a single line
    const singleLine = !rawAnswer.includes('\n');
    const parts = singleLine ? rawAnswer.split(/,\s+/) : [rawAnswer];

    const inferred = inferType(rawAnswer, parts);

    const followUpAnswerRaw = followUpLines.join('\n').trim();
    let followUpAnswer: string | undefined;
    let followUpQuestion: string | undefined;
    let followUpForOption: string | undefined;

    if (followUpAnswerRaw) {
      // Format may be "Label: value" or just "value"
      const m = followUpAnswerRaw.match(/^([^:\n]+):\s*(.+)$/s);
      if (m) {
        followUpQuestion = m[1].trim();
        followUpAnswer = m[2].trim();
      } else {
        followUpQuestion = 'Detalhes';
        followUpAnswer = followUpAnswerRaw;
      }
      // Mark first selected option to require follow-up
      if (inferred.options && inferred.options.length > 0) {
        const selected = Array.isArray(inferred.answerValue) ? inferred.answerValue[0] : inferred.answerValue;
        const match = inferred.options.find((o) => o.label === selected) || inferred.options[0];
        followUpForOption = match.label;
        inferred.options = inferred.options.map((o) =>
          o.label === match.label ? { ...o, followUp: true, followUpQuestion: followUpQuestion! } : o
        );
      }
    }

    questions.push({
      question: first,
      type: inferred.type,
      options: inferred.options,
      allow_other: inferred.allow_other,
      answerValue: inferred.answerValue,
      followUpAnswer,
      followUpForOption,
      followUpQuestion,
    });
  }

  return { clientName, submittedAt, questions };
}
