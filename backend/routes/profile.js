// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

/**
 * POST /api/profile
 * Body: { role, full_name, company_name }
 * Creates or updates profile for logged-in user.
 * Company privileges must be granted through Supabase app_metadata by an administrator.
 */
router.post('/', auth, async (req, res) => {
  const userId = req.user.id;
  const { role, full_name, company_name } = req.body || {};

  if (!['user', 'company'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Do not let a user grant themselves company privileges; auth metadata is
  // controlled server-side and is verified by authMiddleware.
  const authorizedRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
  if (role === 'company' && !authorizedRoles.includes('company')) {
    return res.status(403).json({ error: 'Company role requires administrator approval' });
  }

  const profile = {
    id: userId,
    role,
    full_name: full_name || null,
    company_name: role === 'company' ? company_name || null : null
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, profile });
});

/**
 * GET /api/profile/me
 * Returns current user's profile
 */
router.get('/me', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Profile not found' });
  res.json(data);
});

module.exports = router;
