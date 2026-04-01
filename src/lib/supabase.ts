import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kyimwbyhdsvktgndjbgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5aW13YnloZHN2a3RnbmRqYmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA0MzQsImV4cCI6MjA5MDYyNjQzNH0.q_NTe67aznJ5Wgd8mi2TbMg1QQEpZ0LubFUQ-ZFo9qI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
