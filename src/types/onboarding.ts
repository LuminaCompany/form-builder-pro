export interface Client {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'completed';
  created_at: string;
}

export interface FormQuestion {
  id: string;
  client_id: string;
  question: string;
  type: 'text' | 'textarea' | 'multiple_choice' | 'yes_no';
  options: string[] | null;
  required: boolean;
  order_index: number;
  created_at: string;
}

export interface FormResponse {
  id: string;
  client_id: string;
  answers: Record<string, string>;
  created_at: string;
}
