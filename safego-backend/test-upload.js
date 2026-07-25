import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.storage.getBucket('avatars');
  if (error) {
    console.error("Bucket Error:", error.message);
    if (error.message.includes('not found')) {
       console.log("Creating bucket...");
       const { data: bData, error: bErr } = await supabase.storage.createBucket('avatars', { public: true });
       console.log("Created:", bData, bErr);
    }
  } else {
    console.log("Bucket exists:", data);
  }
}
check();
