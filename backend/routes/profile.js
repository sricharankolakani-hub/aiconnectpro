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
  const body = req.body || {};
  const hasName = Object.prototype.hasOwnProperty.call(body, 'full_name');
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  if (hasName && (fullName.length < 2 || fullName.length > 100)) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }

  const allowedDetails = ['date_of_birth', 'location', 'bio'];
  const hasDetails = allowedDetails.some(key => Object.prototype.hasOwnProperty.call(body, key));
  if (!hasName && !hasDetails) return res.status(400).json({ error: 'No profile details were provided.' });

  const dateOfBirth = body.date_of_birth == null || body.date_of_birth === '' ? null : body.date_of_birth;
  if (Object.prototype.hasOwnProperty.call(body, 'date_of_birth') && dateOfBirth !== null) {
    if (typeof dateOfBirth !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(dateOfBirth)) {
      return res.status(400).json({ error: 'Enter a valid date of birth.' });
    }
    const parsedDate = new Date(dateOfBirth + 'T00:00:00Z');
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateOfBirth || parsedDate > new Date()) {
      return res.status(400).json({ error: 'Date of birth must be a valid date that is not in the future.' });
    }
  }
  const location = body.location == null ? '' : body.location;
  const bio = body.bio == null ? '' : body.bio;
  if (Object.prototype.hasOwnProperty.call(body, 'location') && (typeof location !== 'string' || location.trim().length > 120)) {
    return res.status(400).json({ error: 'Place must be 120 characters or fewer.' });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bio') && (typeof bio !== 'string' || bio.trim().length > 500)) {
    return res.status(400).json({ error: 'About you must be 500 characters or fewer.' });
  }

  const userId = req.user.id;
  if (hasName) {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', userId)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!updated) {
      const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
      const role = roles.includes('company') ? 'company' : 'user';
      const { error: createError } = await supabase
        .from('profiles')
        .insert({ id: userId, role, full_name: fullName, company_name: null });
      if (createError) return res.status(500).json({ error: createError.message });
    }
  }

  if (hasDetails) {
    const { data: existing, error: readError } = await supabase
      .from('profile_private_details')
      .select('date_of_birth, location, bio')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) return res.status(500).json({ error: readError.message });
    const details = { user_id: userId };
    if (Object.prototype.hasOwnProperty.call(body, 'date_of_birth')) details.date_of_birth = dateOfBirth;
    else if (existing) details.date_of_birth = existing.date_of_birth;
    if (Object.prototype.hasOwnProperty.call(body, 'location')) details.location = location.trim();
    else if (existing) details.location = existing.location;
    if (Object.prototype.hasOwnProperty.call(body, 'bio')) details.bio = bio.trim();
    else if (existing) details.bio = existing.bio;
    const { error: saveError } = await supabase
      .from('profile_private_details')
      .upsert(details, { onConflict: 'user_id' });
    if (saveError) return res.status(500).json({ error: saveError.message });
  }

  return res.json({ success: true });
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

  if (data) {
    const { data: privateDetails, error: privateError } = await supabase
      .from('profile_private_details')
      .select('date_of_birth, location, bio')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (privateError) return res.status(500).json({ error: privateError.message });
    return res.json({ ...data, ...(privateDetails || {}), email: req.user.email, phone: req.user.phone });
  }

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
  const { data: privateDetails, error: privateError } = await supabase
    .from('profile_private_details')
    .select('date_of_birth, location, bio')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (privateError) return res.status(500).json({ error: privateError.message });
  return res.json({ ...created, ...(privateDetails || {}), email: req.user.email, phone: req.user.phone });
});

module.exports = router;
