import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'test2@example.com',
    password: 'password',
    email_confirm: true,
  });
  
  // Wait, I can't get a token from createUser.
  // I need to sign in.
  const supabaseAnon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: { session }, error: signinError } = await supabaseAnon.auth.signInWithPassword({
    email: 'test2@example.com',
    password: 'password'
  });
  
  if (session) {
    const { data, error: getUserError } = await supabaseAdmin.auth.getUser(session.access_token);
    console.log("Valid JWT:", getUserError?.message || "Success");
  } else {
    console.log("SignIn Error:", signinError?.message);
  }
}
test();
