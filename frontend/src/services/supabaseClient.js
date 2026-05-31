import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://huxrjhtfmjqxdfsfchti.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eHJqaHRmbWpxeGRmc2ZjaHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODk0MzksImV4cCI6MjA5MTY2NTQzOX0.Z3hUgQIZGF2gl4odfH4h9BDtWgAQjbvgVsI66hTXUy4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
