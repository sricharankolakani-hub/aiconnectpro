const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

// GET /api/organizations/mine
// Returns only organizations this login actively belongs to.
router.get('/mine', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role, status, organization:organizations(id, name, verification_status)')
    .eq('user_id', req.user.id)
    .eq('status', 'active');
  if (error) {
    console.error('Organization membership lookup failed', error);
    return res.status(500).json({ error: 'organization_lookup_failed' });
  }
  return res.json({
    organizations: (data || []).map(row => ({ ...row.organization, membership_role: row.role })).filter(Boolean)
  });
});

module.exports = router;
