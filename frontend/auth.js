// frontend/auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// These are public client settings. Replace them with your Supabase project values.
const SUPABASE_URL = 'https://yrjkkmvrmiieqozuvbqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyamtrbXZybWlpZXFvenV2YnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTE1NzAsImV4cCI6MjA3ODA4NzU3MH0.uITpRtUsm-R9xeYW8R48gDjZILUqtkkLB1-4utarwns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep the token used by API requests in sync with Supabase login, refresh, and logout.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    localStorage.setItem('token', session.access_token);
  } else {
    localStorage.removeItem('token');
  }
});

function authCallbackUrl() {
  return new URL('/auth-callback.html', window.location.origin).toString();
}

// Account type is descriptive profile data only. Authorization continues to
// use server-managed app_metadata roles, never this user-editable metadata.
export function profileIntentMetadata(intent = {}) {
  const allowed = new Set(['professional', 'student', 'founder']);
  const accountType = allowed.has(intent.accountType) ? intent.accountType : 'professional';
  const metadata = { account_type: accountType };
  if (accountType === 'founder') {
    metadata.business_profile = {
      name: String(intent.businessName || '').trim().slice(0, 160),
      summary: String(intent.businessSummary || '').trim().slice(0, 500),
      website: String(intent.businessWebsite || '').trim().slice(0, 320)
    };
  }
  if (accountType === 'student') {
    metadata.student_profile = {
      institution: String(intent.institution || '').trim().slice(0, 160),
      field_of_study: String(intent.fieldOfStudy || '').trim().slice(0, 160)
    };
  }
  return metadata;
}

// SIGN UP
export async function signUp(email, password, consent, profileIntent = {}) {
  if (!consent?.acceptedAt || consent.policyVersion !== '2026-10-17') {
    throw new Error('Please agree to the current Privacy Policy before creating an account.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: {
        privacy_policy_accepted_at: consent.acceptedAt,
        privacy_policy_version: consent.policyVersion,
        ...profileIntentMetadata(profileIntent)
      }
    }
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

export async function beginGoogleEmailSignupVerification() {
  const { error } = await supabase.auth.reauthenticate();
  if (error) throw error;
}

export async function verifyGoogleEmailSignupCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'reauthentication'
  });
  if (error) throw error;
  return data;
}

// Complete the required mobile verification step after email signup or Google signup.
export async function beginPhoneSignup(phone) {
  const normalized = phone.replace(/[^+\d]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Enter a valid mobile number with country code, for example +91 98765 43210.');
  }
  const { data, error } = await supabase.auth.updateUser({ phone: normalized });
  if (error) throw error;
  return data;
}

export async function verifyPhoneSignupCode(phone, token) {
  const normalized = phone.replace(/[^+\d]/g, '');
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalized,
    token: token.trim(),
    type: 'phone_change'
  });
  if (error) throw error;
  if (!data.user?.phone_confirmed_at) throw new Error('Mobile number was not confirmed. Please try again.');
  return data;
}

export async function resendPhoneSignupCode(phone) {
  const normalized = phone.replace(/[^+\d]/g, '');
  const { error } = await supabase.auth.resend({ type: 'phone_change', phone: normalized });
  if (error) throw error;
}

// LOGIN
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
  return (data.totp || []).some(factor => factor.status === 'verified') ? 'challenge' : 'skip';
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
