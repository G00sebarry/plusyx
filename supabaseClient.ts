import { createClient } from '@supabase/supabase-js';

// Твой URL (я его уже вставил)
const supabaseUrl = 'https://gkpmtysnionkfutnybkp.supabase.co';

// Твой ключ (Вставь сюда тот длинный, который ты скопировал)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrcG10eXNuaW9ua2Z1dG55YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjAyNTAsImV4cCI6MjA4MzczNjI1MH0.0mb1ls5BiRaHQO6RayvaH5vlwUg0E_kEu8KcbRECQVw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
