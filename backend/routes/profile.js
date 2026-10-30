// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

function isPrivateDetailsTableMissing(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

const DEFAULT_VISIBILITY = Object.freeze({
  date_of_birth: 'private',
  location: 'private',
  bio: 'private',
  email: 'private',
  phone: 'private',
  avatar: 'private'
});
const VISIBILITY_FIELDS = new Set(Object.keys(DEFAULT_VISIBILITY));
const VISIBILITY_LEVELS = new Set(['private', 'connections', 'everyone']);

function normalizeVisibility(value) {
  const result = { ...DEFAULT_VISIBILITY };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [field, level] of Object.entries(value)) {
    if (VISIBILITY_FIELDS.has(field) && VISIBILITY_LEVELS.has(level)) result[field] = level;
  }
  return result;
}

function canViewField(level, isOwner, isConnected) {
  return isOwner || level === 'everyone' || (level === 'connections' && isConnected);
}

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
  const hasVisibility = Object.prototype.hasOwnProperty.call(body, 'visibility');
  const hasDetails = allowedDetails.some(key => Object.prototype.hasOwnProperty.call(body, key)) || hasVisibility;
  if (!hasName && !hasDetails) return res.status(400).json({ error: 'No profile details were provided.' });
  if (hasVisibility) {
    const submitted = body.visibility;
    if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted) || !Object.keys(submitted).length) {
      return res.status(400).json({ error: 'Visibility settings must be an object with at least one field.' });
    }
    for (const [field, level] of Object.entries(submitted)) {
      if (!VISIBILITY_FIELDS.has(field) || !VISIBILITY_LEVELS.has(level)) {
        return res.status(400).json({ error: 'Choose a valid audience for each profile detail.' });
      }
    }
  }

  const dateOfBirth = body.date_of_birth == null || body.date_of_birth === '' ? null : body.date_of_birth;
  if (Object.prototype.hasOwnProperty.call(body, 'date_of_birth') && dateOfBirth !== null) {
    if (typeof dateOfBirth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
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
      .select('date_of_birth, location, bio, visibility')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) {
      if (isPrivateDetailsTableMissing(readError)) {
        return res.status(503).json({ error: 'Private profile details are not enabled yet. Apply the profile details migration first.' });
      }
      return res.status(500).json({ error: readError.message });
    }
    const details = { user_id: userId };
    if (Object.prototype.hasOwnProperty.call(body, 'date_of_birth')) details.date_of_birth = dateOfBirth;
    else if (existing) details.date_of_birth = existing.date_of_birth;
    if (Object.prototype.hasOwnProperty.call(body, 'location')) details.location = location.trim();
    else if (existing) details.location = existing.location;
    if (Object.prototype.hasOwnProperty.call(body, 'bio')) details.bio = bio.trim();
    else if (existing) details.bio = existing.bio;
    details.visibility = normalizeVisibility({
      ...(existing?.visibility || {}),
      ...(hasVisibility ? body.visibility : {})
    });
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
      .select('date_of_birth, location, bio, visibility')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (privateError && !isPrivateDetailsTableMissing(privateError)) {
      return res.status(500).json({ error: privateError.message });
    }
    return res.json({
      ...data,
      ...(privateDetails || {}),
      visibility: normalizeVisibility(privateDetails?.visibility),
      email: req.user.email,
      phone: req.user.phone
    });
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
    .select('date_of_birth, location, bio, visibility')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (privateError && !isPrivateDetailsTableMissing(privateError)) {
    return res.status(500).json({ error: privateError.message });
  }
  return res.json({
    ...created,
    ...(privateDetails || {}),
    visibility: normalizeVisibility(privateDetails?.visibility),
    email: req.user.email,
    phone: req.user.phone
  });
});

// GET /api/profile/:userId — signed-in members see only details their owner shared.
router.get('/:userId', auth, async (req, res) => {
  const targetId = req.params.userId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    return res.status(404).json({ error: 'profile_not_found' });
  }

  try {
    const isOwner = targetId === req.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, discoverable')
      .eq('id', targetId)
      .maybeSingle();
    if (profileError) return res.status(500).json({ error: 'profile_lookup_failed' });
    if (!profile) return res.status(404).json({ error: 'profile_not_found' });

    let isConnected = false;
    if (!isOwner) {
      const { data: relationship, error: relationshipError } = await supabase
        .from('connection_requests')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${targetId}),and(sender_id.eq.${targetId},recipient_id.eq.${req.user.id})`)
        .maybeSingle();
      if (relationshipError) return res.status(500).json({ error: 'profile_access_check_failed' });
      isConnected = Boolean(relationship);
      if (!isConnected && !profile.discoverable) return res.status(404).json({ error: 'profile_not_found' });
    }

    let details = null;
    const { data: privateDetails, error: detailsError } = await supabase
      .from('profile_private_details')
      .select('date_of_birth, location, bio, visibility')
      .eq('user_id', targetId)
      .maybeSingle();
    if (detailsError && !isPrivateDetailsTableMissing(detailsError)) {
      return res.status(500).json({ error: 'profile_details_lookup_failed' });
    }
    details = privateDetails || {};
    const visibility = normalizeVisibility(details.visibility);
    const result = {
      id: profile.id,
      full_name: profile.full_name || 'AIConnectPro member',
      company_name: profile.company_name || null,
      is_connected: isConnected
    };

    for (const field of ['date_of_birth', 'location', 'bio']) {
      if (details[field] && canViewField(visibility[field], isOwner, isConnected)) result[field] = details[field];
    }

    let authUser = null;
    const sharedContactOrPhoto = ['email', 'phone', 'avatar'].some(field =>
      canViewField(visibility[field], isOwner, isConnected)
    );
    if (sharedContactOrPhoto) {
      const { data, error } = await supabase.auth.admin.getUserById(targetId);
      if (error) return res.status(500).json({ error: 'profile_account_lookup_failed' });
      authUser = data.user;
    }
    if (authUser?.email && canViewField(visibility.email, isOwner, isConnected)) result.email = authUser.email;
    if (authUser?.phone && canViewField(visibility.phone, isOwner, isConnected)) result.phone = authUser.phone;

    if (authUser && canViewField(visibility.avatar, isOwner, isConnected)) {
      const avatarPath = authUser.user_metadata?.avatar_path;
      if (avatarPath) {
        const { data: signed, error } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(avatarPath, 600);
        if (!error) result.avatar_url = signed.signedUrl;
      } else if (authUser.user_metadata?.avatar_url) {
        result.avatar_url = authUser.user_metadata.avatar_url;
      }
    }
    return res.json(result);
  } catch (error) {
    console.error('Shared profile lookup failed', error);
    return res.status(500).json({ error: 'profile_lookup_failed' });
  }
});

module.exports = router;
