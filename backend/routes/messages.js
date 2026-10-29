const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

router.use(auth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pairFor = (one, two) => [one, two].sort();

async function acceptedConnection(userId, peerId) {
  const { data, error } = await supabase.from('connection_requests')
    .select('id')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function getConversation(userId, peerId, create = false) {
  const [member_a, member_b] = pairFor(userId, peerId);
  let query = supabase.from('direct_conversations').select('id, member_a, member_b')
    .eq('member_a', member_a).eq('member_b', member_b);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data || !create) return data;
  const created = await supabase.from('direct_conversations')
    .upsert({ member_a, member_b }, { onConflict: 'member_a,member_b' })
    .select('id, member_a, member_b').single();
  if (created.error) throw created.error;
  return created.data;
}

async function peerName(peerId) {
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name').eq('id', peerId).maybeSingle();
  if (error) throw error;
  return data?.full_name || 'AIConnectPro member';
}

function validatePeer(req, res) {
  const peerId = req.params.peerId;
  if (!UUID.test(peerId) || peerId === req.user.id) {
    res.status(400).json({ error: 'invalid_recipient' });
    return null;
  }
  return peerId;
}

// GET /api/messages — existing conversations with accepted connections.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: links, error: linksError } = await supabase.from('connection_requests')
      .select('sender_id, recipient_id')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'accepted');
    if (linksError) throw linksError;
    const peers = (links || []).map(row => row.sender_id === userId ? row.recipient_id : row.sender_id);
    if (!peers.length) return res.json({ conversations: [] });

    const { data: all, error } = await supabase.from('direct_conversations')
      .select('id, member_a, member_b, created_at')
      .or(`member_a.eq.${userId},member_b.eq.${userId}`)
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const allowed = new Set(peers);
    const conversations = (all || []).filter(row => allowed.has(row.member_a === userId ? row.member_b : row.member_a));
    if (!conversations.length) return res.json({ conversations: [] });

    const ids = conversations.map(row => row.id);
    const { data: messages, error: messagesError } = await supabase.from('direct_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .in('conversation_id', ids).order('created_at', { ascending: false }).limit(500);
    if (messagesError) throw messagesError;

    const latest = new Map();
    for (const message of messages || []) if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
    const peerIds = conversations.map(row => row.member_a === userId ? row.member_b : row.member_a);
    const { data: profiles, error: profileError } = await supabase.from('profiles')
      .select('id, full_name').in('id', peerIds);
    if (profileError) throw profileError;
    const names = new Map((profiles || []).map(profile => [profile.id, profile.full_name || 'AIConnectPro member']));
    return res.json({ conversations: conversations.map(row => ({
      id: row.id,
      peer: { id: row.member_a === userId ? row.member_b : row.member_a, full_name: names.get(row.member_a === userId ? row.member_b : row.member_a) || 'AIConnectPro member' },
      latest_message: latest.get(row.id) || null
    })) });
  } catch (error) {
    console.error('Message inbox lookup failed', error);
    return res.status(500).json({ error: 'messages_lookup_failed' });
  }
});

// GET /api/messages/:peerId — fetch the latest 100 messages in a connected pair.
router.get('/:peerId', async (req, res) => {
  const peerId = validatePeer(req, res);
  if (!peerId) return;
  try {
    if (!await acceptedConnection(req.user.id, peerId)) return res.status(403).json({ error: 'accepted_connection_required' });
    const [conversation, peer] = await Promise.all([
      getConversation(req.user.id, peerId),
      peerName(peerId)
    ]);
    if (!conversation) return res.json({ conversation: null, peer: { id: peerId, full_name: peer }, messages: [] });
    const { data, error } = await supabase.from('direct_messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    return res.json({ conversation: { id: conversation.id }, peer: { id: peerId, full_name: peer }, messages: data || [] });
  } catch (error) {
    console.error('Message thread lookup failed', error);
    return res.status(500).json({ error: 'message_thread_failed' });
  }
});

// POST /api/messages/:peerId — send only to an accepted connection.
router.post('/:peerId', async (req, res) => {
  const peerId = validatePeer(req, res);
  if (!peerId) return;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) return res.status(400).json({ error: 'message_must_be_1_to_4000_characters' });
  try {
    if (!await acceptedConnection(req.user.id, peerId)) return res.status(403).json({ error: 'accepted_connection_required' });
    const conversation = await getConversation(req.user.id, peerId, true);
    const { data, error } = await supabase.from('direct_messages')
      .insert({ conversation_id: conversation.id, sender_id: req.user.id, body })
      .select('id, sender_id, body, created_at').single();
    if (error) throw error;
    return res.status(201).json({ message: data });
  } catch (error) {
    console.error('Message send failed', error);
    return res.status(500).json({ error: 'message_send_failed' });
  }
});

module.exports = router;
