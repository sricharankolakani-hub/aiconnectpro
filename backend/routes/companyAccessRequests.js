const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');
const { verifyGstin } = require('../services/gstVerification');

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

// POST /api/company-access-requests
// Creates a distinct Organization and pending owner membership for this login.
router.post('/', auth, async (req, res) => {
  const companyName = cleanText(req.body?.company_name, 160);
  const website = cleanText(req.body?.website, 320);
  const gstin = cleanText(req.body?.gstin, 15)?.toUpperCase() || null;
  const registeredAddress = cleanText(req.body?.registered_address, 500);
  const operatingLocation = cleanText(req.body?.operating_location, 200);
  const message = cleanText(req.body?.message, 1500);

  if (!companyName || companyName.length < 2) return res.status(400).json({ error: 'company_name_required' });
  if (!operatingLocation || operatingLocation.length < 2) return res.status(400).json({ error: 'operating_location_required' });
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) return res.status(400).json({ error: 'invalid_gstin_format' });
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

  const verification = gstin
    ? await verifyGstin({ gstin, organizationName: companyName, registeredAddress })
    : { status: 'manual_review', provider: null, reference: null, result: { reason: 'gstin_not_provided' } };

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .insert({
      name: companyName,
      website,
      gstin,
      registered_address: registeredAddress,
      operating_location: operatingLocation,
      verification_status: verification.status,
      verification_provider: verification.provider,
      provider_reference: verification.reference,
      verification_result: verification.result,
      created_by: req.user.id
    })
    .select('id, name, verification_status')
    .single();

  if (organizationError) {
    if (organizationError.code === '23505') return res.status(409).json({ error: 'gstin_already_registered' });
    console.error('Organization registration failed', organizationError);
    return res.status(500).json({ error: 'organization_create_failed' });
  }

  const { error: membershipError } = await supabase.from('organization_memberships').insert({
    organization_id: organization.id,
    user_id: req.user.id,
    role: 'owner',
    status: 'pending'
  });
  if (membershipError) {
    await supabase.from('organizations').delete().eq('id', organization.id);
    console.error('Organization membership create failed', membershipError);
    return res.status(500).json({ error: 'membership_create_failed' });
  }

  const { data: request, error: requestError } = await supabase
    .from('company_access_requests')
    .insert({
      requester_id: req.user.id,
      organization_id: organization.id,
      company_name: companyName,
      website,
      message
    })
    .select('id, organization_id, company_name, website, message, status, created_at')
    .single();

  if (requestError) {
    await supabase.from('organization_memberships').delete().eq('organization_id', organization.id);
    await supabase.from('organizations').delete().eq('id', organization.id);
    if (requestError.code === '23505') return res.status(409).json({ error: 'request_already_pending' });
    console.error('Company access request create failed', requestError);
    return res.status(500).json({ error: 'request_create_failed' });
  }

  return res.status(201).json({ request, organization });
});

// GET /api/company-access-requests/me
router.get('/me', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('company_access_requests')
    .select('id, organization_id, company_name, website, message, status, created_at, reviewed_at, organization:organizations(verification_status, operating_location)')
    .eq('requester_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'request_lookup_failed' });
  return res.json({ request: data || null });
});

module.exports = router;
