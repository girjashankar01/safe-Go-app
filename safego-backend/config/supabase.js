import { createClient } from '@supabase/supabase-js';

// Service key bypasses RLS — never use this client anywhere but the backend
export default createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
