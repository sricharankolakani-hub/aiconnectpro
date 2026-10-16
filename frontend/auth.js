// frontend/auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// These are public client settings. Never place service-role credentials in this file.
const SUPABASE_URL = 'https://yrjkkmvrmiieqozuvbqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyamtrbXZybWlpZXFvenV2YnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTE1NzAsImV4cCI6MjA3ODA4NzU3MH0.uITpRtUsm-R9xeYW8R48gDjZILUqtkkLB1-4utarwns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) localStorage.setItem('token', session.access_token);
  else localStorage.removeItem('token');
});

function authCallbackUrl() {
  return new URL('/auth-callback.html', window.location.origin).toString();
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: authCallbackUrl() }
  });
  if (error) throw error;
  return data;
}

export async function verifySignupCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'signup'
  });
  if (error) throw error;
  if (!data.session) throw new Error('Email confirmed, but no sign-in session was returned. Please log in.');
  return data;
}

export async function resendSignupCode(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: authCallbackUrl() }
  });
  if (error) throw error;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw error;
  if (!data.session) throw new Error('Login did not return an active session.');
  localStorage.setItem('token', data.session.access_token);
  return data;
}

export async function getMfaStep() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data.totp || []).some(factor => factor.status === 'verified') ? 'challenge' : 'enroll';
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authCallbackUrl() }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  localStorage.removeItem('token');
  if (error) throw error;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}
