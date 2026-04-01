export interface Client {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'completed';
  tab_title?: string;
  favicon_url?: string;
  created_at: string;
}

export interface FormQuestion {
  id: string;
  client_id: string;
  question: string;
  type: 'text' | 'textarea' | 'multiple_choice' | 'yes_no';
  options: string[] | null;
  required: boolean;
  allow_other: boolean;
  order_index: number;
  created_at: string;
}

export interface FormResponse {
  id: string;
  client_id: string;
  answers: Record<string, string>;
  submitted_at?: string;
}
