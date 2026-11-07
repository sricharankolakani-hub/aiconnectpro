// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');

const REQUIRED_PRIVACY_POLICY_VERSION = '2026-10-17';

/**
 * POST /api/auth/signup
 * body: { name, email, password, consent: { acceptedAt, policyVersion } }
 */
router.post('/signup', async (req, res) => {
  const { name, email, password, consent } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  const acceptedAt = Date.parse(consent?.acceptedAt || '');
  if (
    consent?.policyVersion !== REQUIRED_PRIVACY_POLICY_VERSION
    || !Number.isFinite(acceptedAt)
    || acceptedAt > Date.now() + 5 * 60 * 1000
  ) {
    return res.status(400).json({
      error: 'privacy_policy_consent_required',
      message: 'Please agree to the current Privacy Policy before creating an account.'
    });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim(),
      password: String(password),
      options: {
        data: {
          name: name ? String(name).trim() : '',
          privacy_policy_accepted_at: new Date().toISOString(),
          privacy_policy_version: REQUIRED_PRIVACY_POLICY_VERSION
        }
      }
    });
    if (error) {
      return res.status(400).json({ error: 'signup_failed', details: error.message });
    }

    const token = data.session?.access_token || null;
    return res.status(201).json({
      token,
      requiresEmailConfirmation: !data.session,
      user: data.user ? { id: data.user.id, email: data.user.email } : null
    });
  } catch (err) {
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password)
    });
    if (error || !data.session) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    return res.json({
      token: data.session.access_token,
      user: { id: data.user.id, email: data.user.email }
    });
  } catch (err) {
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

module.exports = router;
