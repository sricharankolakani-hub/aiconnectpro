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
 * PATCH /api/profile/me
 * Update the editable name on the signed-in user's profile only.
 */
router.patch('/me', auth, async (req, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  if (fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }

  const userId = req.user.id;
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (data) return res.json({ success: true, profile: data });

  // A minimal profile may not exist yet. Derive its role only from verified,
  // server-managed claims; profile edit requests cannot grant privileges.
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
  const role = roles.includes('company') ? 'company' : 'user';
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({ id: userId, role, full_name: fullName, company_name: null })
    .select()
    .single();

  if (createError) return res.status(500).json({ error: createError.message });
  return res.json({ success: true, profile: created });
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
