// backend/routes/connections.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

router.use(auth);

function cleanSearch(value) {
  return typeof value === 'string'
    ? value.trim().replace(/[%,_]/g, '').slice(0, 80)
    : '';
}

async function namesFor(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds);
  if (error) throw error;
  return new Map((data || []).map(profile => [profile.id, profile.full_name || 'AIConnectPro member']));
}

// GET /api/connections/me — privacy setting, requests, and accepted connections.
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const [profileResult, requestResult] = await Promise.all([
      supabase.from('profiles').select('discoverable').eq('id', userId).maybeSingle(),
      supabase.from('connection_requests')
        .select('id, sender_id, recipient_id, status, created_at, updated_at')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200)
    ]);
    if (profileResult.error || requestResult.error) {
      return res.status(500).json({ error: 'connections_lookup_failed' });
    }

    const requests = requestResult.data || [];
    const ids = requests.map(row => row.sender_id === userId ? row.recipient_id : row.sender_id);
    const names = await namesFor(ids);
    const shaped = requests.map(row => ({
      id: row.id,
      status: row.status,
      direction: row.sender_id === userId ? 'sent' : 'received',
      created_at: row.created_at,
      user: {
        id: row.sender_id === userId ? row.recipient_id : row.sender_id,
        full_name: names.get(row.sender_id === userId ? row.recipient_id : row.sender_id) || 'AIConnectPro member'
      }
    }));
    return res.json({
      discoverable: Boolean(profileResult.data?.discoverable),
      connections: shaped.filter(item => item.status === 'accepted'),
      incoming: shaped.filter(item => item.status === 'pending' && item.direction === 'received'),
      outgoing: shaped.filter(item => item.status === 'pending' && item.direction === 'sent')
    });
  } catch (error) {
    console.error('Connections profile lookup failed', error);
    return res.status(500).json({ error: 'connections_lookup_failed' });
  }
});

// GET /api/connections/discover?q=...
router.get('/discover', async (req, res) => {
  try {
    const userId = req.user.id;
    const term = cleanSearch(req.query.q);
    let query = supabase.from('profiles')
      .select('id, full_name, company_name')
      .eq('discoverable', true)
      .eq('role', 'user')
      .neq('id', userId)
      .order('full_name', { ascending: true })
      .limit(40);
    if (term) query = query.ilike('full_name', `%${term}%`);

    const [profilesResult, requestsResult] = await Promise.all([
      query,
      supabase.from('connection_requests')
        .select('sender_id, recipient_id, status')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .in('status', ['pending', 'accepted'])
    ]);
    if (profilesResult.error || requestsResult.error) {
      return res.status(500).json({ error: 'discovery_lookup_failed' });
    }

    const known = new Set();
    for (const row of requestsResult.data || []) {
      known.add(row.sender_id === userId ? row.recipient_id : row.sender_id);
    }
    const people = (profilesResult.data || [])
      .filter(profile => !known.has(profile.id))
      .map(profile => ({
        id: profile.id,
        full_name: profile.full_name || 'AIConnectPro member',
        company_name: profile.company_name || null
      }));
    return res.json({ people });
  } catch (error) {
    console.error('Profile discovery failed', error);
    return res.status(500).json({ error: 'discovery_lookup_failed' });
  }
});

// PATCH /api/connections/privacy — default is undiscoverable.
router.patch('/privacy', async (req, res) => {
  if (typeof req.body?.discoverable !== 'boolean') {
    return res.status(400).json({ error: 'discoverable_must_be_boolean' });
  }
  const { data, error } = await supabase.from('profiles')
    .upsert({ id: req.user.id, discoverable: req.body.discoverable }, { onConflict: 'id' })
    .select('discoverable')
    .single();
  if (error) return res.status(500).json({ error: 'privacy_update_failed' });
  return res.json({ discoverable: data.discoverable });
});

// POST /api/connections/requests/:userId
router.post('/requests/:userId', async (req, res) => {
  const recipientId = req.params.userId;
  if (recipientId === req.user.id) return res.status(400).json({ error: 'cannot_connect_to_self' });

  const { data: target, error: targetError } = await supabase.from('profiles')
    .select('id, role, discoverable')
    .eq('id', recipientId)
    .maybeSingle();
  if (targetError) return res.status(500).json({ error: 'profile_lookup_failed' });
  if (!target || target.role !== 'user' || !target.discoverable) {
    return res.status(404).json({ error: 'profile_not_discoverable' });
  }

  const { data: prior, error: priorError } = await supabase.from('connection_requests')
    .select('id, status')
    .or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${req.user.id})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();
  if (priorError) return res.status(500).json({ error: 'connection_lookup_failed' });
  if (prior) return res.status(409).json({ error: prior.status === 'accepted' ? 'already_connected' : 'request_already_exists' });

  const { data, error } = await supabase.from('connection_requests')
    .insert({ sender_id: req.user.id, recipient_id: recipientId, status: 'pending' })
    .select('id, status, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'request_already_exists' });
    console.error('Connection request create failed', error);
    return res.status(500).json({ error: 'request_create_failed' });
  }
  return res.status(201).json({ request: data });
});

// PATCH /api/connections/requests/:id — recipient accepts/declines; sender withdraws.
router.patch('/requests/:id', async (req, res) => {
  const action = req.body?.action;
  if (!['accept', 'decline', 'withdraw'].includes(action)) {
    return res.status(400).json({ error: 'invalid_request_action' });
  }
  const { data: request, error: lookupError } = await supabase.from('connection_requests')
    .select('id, sender_id, recipient_id, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: 'request_lookup_failed' });
  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'pending_request_not_found' });

  const recipientAction = action === 'accept' || action === 'decline';
  const authorized = recipientAction
    ? request.recipient_id === req.user.id
    : request.sender_id === req.user.id;
  if (!authorized) return res.status(403).json({ error: 'not_allowed_to_update_request' });

  const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'withdrawn';
  const { data, error } = await supabase.from('connection_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id, status, updated_at')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'request_update_failed' });
  if (!data) return res.status(409).json({ error: 'request_already_updated' });
  return res.json({ request: data });
});

// DELETE /api/connections/:id — either member may end an accepted connection.
router.delete('/:id', async (req, res) => {
  const { data: request, error } = await supabase.from('connection_requests')
    .select('id, sender_id, recipient_id, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'connection_lookup_failed' });
  if (!request || request.status !== 'accepted') return res.status(404).json({ error: 'connection_not_found' });
  if (![request.sender_id, request.recipient_id].includes(req.user.id)) {
    return res.status(403).json({ error: 'not_allowed_to_remove_connection' });
  }
  const { error: updateError } = await supabase.from('connection_requests')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', request.id);
  if (updateError) return res.status(500).json({ error: 'connection_remove_failed' });
  return res.json({ success: true });
});

module.exports = router;
