import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Regular client for normal operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: true // Enable debug mode for local development
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-my-custom-header': 'my-app-name',
    },
  },
});

// Admin client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Listen for auth state changes and errors
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    console.log('User signed out')
  } else if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user?.email)
  } else if (event === 'USER_DELETED') {
    console.log('User was deleted!')
  } else if (event === 'USER_UPDATED') {
    console.log('User was updated:', session?.user?.email)
  } else if (event === 'PASSWORD_RECOVERY') {
    console.log('Password recovery requested')
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Token was refreshed')
  } else if (event === 'ERROR') {
    console.error('Auth error occurred:', session)
  }
});
