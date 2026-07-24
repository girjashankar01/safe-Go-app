import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.from('sos_events').select('identity_snapshot').limit(1);
  if (error) {
    console.log('Error querying identity_snapshot:', error.message);
  } else {
    console.log('Column identity_snapshot exists!');
  }
}
check();
