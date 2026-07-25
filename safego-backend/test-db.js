import db from './config/supabase.js';
async function test() {
  const { data, error } = await db.from('sos_events').select('*').limit(1);
  if (error) console.error("Error:", error);
  console.log("SOS keys:", data && data[0] ? Object.keys(data[0]) : "no data");
}
test();
