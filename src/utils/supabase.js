import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ydnztvfdaixesqzpojbc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkbnp0dmZkYWl4ZXNxenBvamJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzEzMDksImV4cCI6MjA5Njk0NzMwOX0.N8jaQuwbs6IRC3OOEpMr_Oapbvc1DGg7tWGCMqW6-h8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
