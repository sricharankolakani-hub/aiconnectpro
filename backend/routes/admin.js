const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');

router.use(auth, requireAdmin);

// GET /api/admin/company-access-requests?status=pending
router.get('/company-access-requests', async (req, res) => {
  const status = req.query.status || 'pending';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status_filter' });
  }

  let query = supabase
    .from('company_access_requests')
    .select('id, requester_id, company_name, website, gstin, registered_address, operating_location, message, status, created_at, reviewed_at, reviewed_by')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status !== 'all') query = query.eq('status', status);

  const { data: requests, error } = await query;
  if (error) {
    console.error('Admin request queue lookup failed', error);
    return res.status(500).json({ error: 'request_queue_failed' });
  }

  const rows = requests || [];
  const ids = [...new Set(rows.map(row => row.requester_id))];
  const [profileResult, userResults] = await Promise.all([
    ids.length
      ? supabase.from('profiles').select('id, full_name').in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(ids.map(id => supabase.auth.admin.getUserById(id)))
  ]);
  if (profileResult.error) return res.status(500).json({ error: 'request_queue_failed' });

  const profiles = new Map((profileResult.data || []).map(profile => [profile.id, profile]));
  const emails = new Map();
  for (let index = 0; index < ids.length; index += 1) {
    const result = userResults[index];
    if (!result.error && result.data?.user?.email) emails.set(ids[index], result.data.user.email);
  }

  return res.json({
    requests: rows.map(row => ({
      id: row.id,
      requester_id: row.requester_id,
      requester_name: profiles.get(row.requester_id)?.full_name || 'AIConnectPro user',
      requester_email: emails.get(row.requester_id) || null,
      company_name: row.company_name,
      website: row.website,
      gstin: row.gstin,
      registered_address: row.registered_address,
      operating_location: row.operating_location,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at
    }))
  });
});

// PATCH /api/admin/company-access-requests/:id
router.patch('/company-access-requests/:id', async (req, res) => {
  const decision = req.body?.decision;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision_must_be_approved_or_rejected' });
  }

  const { data: request, error: lookupError } = await supabase
    .from('company_access_requests')
    .select('id, requester_id, company_name, gstin, registered_address, operating_location, website, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: 'request_lookup_failed' });
  if (!request) return res.status(404).json({ error: 'request_not_found' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'request_already_reviewed' });
  if (request.requester_id === req.user.id) {
    return res.status(403).json({ error: 'cannot_review_own_request' });
  }

  let organizationId = null;
  if (decision === 'approved') {
    const { data: organization, error: organizationError } = await supabase
      .from('organizations')
      .insert({
        name: request.company_name,
        website: request.website,
        gstin: request.gstin,
        registered_address: request.registered_address,
        operating_location: request.operating_location,
        verification_status: 'verified',
        verification_provider: 'manual_review',
        verification_result: { method: 'manual_admin_review' },
        created_by: request.requester_id,
        verified_at: new Date().toISOString(),
        verified_by: req.user.id
      })
      .select('id')
      .single();
    if (organizationError) {
      console.error('Organization creation after manual review failed', organizationError);
      return res.status(500).json({ error: 'organization_create_failed' });
    }
    organizationId = organization.id;

    const { error: membershipError } = await supabase
      .from('organization_memberships')
      .insert({
        organization_id: organizationId,
        user_id: request.requester_id,
        role: 'owner',
        status: 'active'
      });
    if (membershipError) {
      console.error('Organization owner membership create failed', membershipError);
      return res.status(500).json({ error: 'organization_membership_create_failed' });
    }

    const { data: authData, error: userError } = await supabase.auth.admin.getUserById(request.requester_id);
    if (userError || !authData?.user) return res.status(404).json({ error: 'requester_not_found' });

    const user = authData.user;
    const metadata = user.app_metadata || {};
    const roles = Array.isArray(metadata.roles) ? metadata.roles : [];
    const nextRoles = [...new Set([...roles, 'company'])];
    const { error: roleError } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...metadata, roles: nextRoles }
    });
    if (roleError) {
      console.error('Company role grant failed', roleError);
      return res.status(500).json({ error: 'company_access_grant_failed' });
    }

    const { data: currentProfile, error: profileReadError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileReadError) return res.status(500).json({ error: 'company_profile_update_failed' });

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        role: 'company',
        full_name: currentProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
        company_name: request.company_name
      }, { onConflict: 'id' });
    if (profileError) {
      console.error('Approved company profile update failed', profileError);
      return res.status(500).json({ error: 'company_profile_update_failed' });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('company_access_requests')
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
      organization_id: organizationId
    })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id, status, reviewed_at')
    .maybeSingle();

  if (updateError) return res.status(500).json({ error: 'request_review_failed' });
  if (!updated) return res.status(409).json({ error: 'request_already_reviewed' });
  return res.json({ request: updated });
});

module.exports = router;
