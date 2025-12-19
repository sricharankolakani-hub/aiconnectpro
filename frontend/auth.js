// frontend/auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 🔴 REPLACE with your values
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  // store token
  localStorage.setItem('token', data.session.access_token);
  return data;
}

// LOGOUT
export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('token');
}

// GET CURRENT USER
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
