import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://lfbnabpbookkgtzjhedi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmYm5hYnBib29ra2d0empoZWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDc3NDYsImV4cCI6MjA4ODM4Mzc0Nn0.VdwrNSdhbzbYX38Qk0BsEO_R37W1skV3AydnhcU094A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});