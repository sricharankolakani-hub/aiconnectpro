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
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (data) return res.json(data);

  // OAuth and email signup do not necessarily create an app profile. Create a
  // minimal user profile on first access; company access still requires the
  // administrator-managed app_metadata claim.
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
  const role = roles.includes('company') ? 'company' : 'user';
  const profile = {
    id: req.user.id,
    role,
    full_name: req.user.name || null,
    company_name: null
  };
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (createError) return res.status(500).json({ error: createError.message });
  return res.json(created);
});

module.exports = router;
