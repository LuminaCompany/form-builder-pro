export interface Client {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'completed';
  tab_title?: string;
  favicon_url?: string;
  lumina_branding?: boolean;
  created_at: string;
}

export interface OptionItem {
  label: string;
  followUp: boolean;
}

export interface FormQuestion {
  id: string;
  client_id: string;
  question: string;
  type: 'text' | 'textarea' | 'multiple_choice' | 'yes_no';
  options: OptionItem[] | null;
  required: boolean;
  allow_other: boolean;
  order_index: number;
  created_at: string;
}

/** Normalize legacy string[] options to OptionItem[] */
export function normalizeOptions(options: any): OptionItem[] | null {
  if (!options) return null;
  if (!Array.isArray(options)) return null;
  return options.map((opt: any) => {
    if (typeof opt === 'string') return { label: opt, followUp: false };
    return { label: opt.label || '', followUp: !!opt.followUp };
  });
}

export interface FormResponse {
  id: string;
  client_id: string;
  answers: Record<string, string>;
  submitted_at?: string;
}
