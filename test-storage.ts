import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabaseAdmin.storage.from('logos').list('', { limit: 100 });
  console.log(JSON.stringify(data, null, 2), error);
}
test();
