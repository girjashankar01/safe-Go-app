import db from './config/supabase.js';

async function check() {
  const { data, error } = await db.from('trips').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}
check();
