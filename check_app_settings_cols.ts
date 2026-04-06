import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('app_settings').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in app_settings:', Object.keys(data[0]));
  } else {
    console.log('No data found in app_settings');
    // Try to insert a row to see if it works and what columns it has
    const { data: insertData, error: insertError } = await supabase.from('app_settings').insert({ id: 'global' }).select();
    if (insertError) {
      console.error('Insert Error:', insertError);
    } else {
      console.log('Inserted Data Columns:', Object.keys(insertData[0]));
    }
  }
}
test();
