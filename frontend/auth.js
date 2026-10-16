// frontend/auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// These are public client settings. Replace them with your Supabase project values.
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep the token used by API requests in sync with Supabase login, refresh, and logout.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    localStorage.setItem('token', session.access_token);
  } else {
    localStorage.removeItem('token');
  }
});

// SIGN UP
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) throw error;
  return data;
}

// LOGIN
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  if (!data.session) throw new Error('Login did not return an active session.');
  localStorage.setItem('token', data.session.access_token);
  return data;
}

// GOOGLE LOGIN
export async function signInWithGoogle() {
  const redirectTo = new URL('/auth-callback.html', window.location.origin).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) throw error;
  return data;
}

// LOGOUT
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  localStorage.removeItem('token');
  if (error) throw error;
}

// GET CURRENT USER
export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}
