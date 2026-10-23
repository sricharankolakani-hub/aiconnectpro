const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

// POST /api/company-access-requests
router.post('/', auth, async (req, res) => {
  if (hasRole(req.user, 'company')) {
    return res.status(409).json({ error: 'company_access_already_approved' });
  }

  const companyName = cleanText(req.body?.company_name, 160);
  const gstin = cleanText(req.body?.gstin, 15)?.toUpperCase() || null;
  const registeredAddress = cleanText(req.body?.registered_address, 500);
  const operatingLocation = cleanText(req.body?.operating_location, 200);
  const website = cleanText(req.body?.website, 320);
  const message = cleanText(req.body?.message, 1500);
  if (!companyName || companyName.length < 2) {
    return res.status(400).json({ error: 'company_name_required' });
  }
  if (!gstin || !/^[0-9A-Z]{15}$/.test(gstin)) {
    return res.status(400).json({ error: 'gstin_must_be_15_alphanumeric_characters' });
  }
  if (!registeredAddress || !operatingLocation) {
    return res.status(400).json({ error: 'registered_address_and_operating_location_required' });
  }
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid scheme');
    } catch {
      return res.status(400).json({ error: 'website_must_be_a_valid_url' });
    }
  }

  const { data: existing, error: lookupError } = await supabase
    .from('company_access_requests')
    .select('id')
    .eq('requester_id', req.user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: 'request_lookup_failed' });
  if (existing) return res.status(409).json({ error: 'request_already_pending' });

  const { data, error } = await supabase
    .from('company_access_requests')
    .insert({
      requester_id: req.user.id,
      company_name: companyName,
      gstin,
      registered_address: registeredAddress,
      operating_location: operatingLocation,
      website,
      message
    })
    .select('id, company_name, website, gstin, registered_address, operating_location, message, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'request_already_pending' });
    console.error('Company access request create failed', error);
    return res.status(500).json({ error: 'request_create_failed' });
  }
  return res.status(201).json({ request: data });
});

// GET /api/company-access-requests/me
router.get('/me', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('company_access_requests')
    .select('id, company_name, website, gstin, registered_address, operating_location, message, status, created_at, reviewed_at')
    .eq('requester_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'request_lookup_failed' });
  return res.json({ request: data || null });
});

module.exports = router;
