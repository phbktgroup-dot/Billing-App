import { supabase } from './src/lib/supabase';

async function checkPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .limit(5);
  
  if (error) {
    console.error('Error fetching purchases:', error);
  } else {
    console.log('Recent purchases:', JSON.stringify(data, null, 2));
  }
}

checkPurchases();
