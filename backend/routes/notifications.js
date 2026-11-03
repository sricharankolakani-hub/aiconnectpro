const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

router.use(auth);

router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const includeMessages = req.query.type !== 'connections';
    const [notificationResult, conversationResult] = await Promise.all([
      supabase.from('notifications')
        .select('id, type, actor_id, request_id, created_at')
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      includeMessages
        ? supabase.from('direct_conversations')
          .select('id')
          .or('member_a.eq.' + userId + ',member_b.eq.' + userId)
          .limit(100)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (notificationResult.error || conversationResult.error) throw notificationResult.error || conversationResult.error;

    const conversationIds = (conversationResult.data || []).map(row => row.id);
    const unreadResult = conversationIds.length
      ? await supabase.from('direct_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
      : { data: [], error: null };
    if (unreadResult.error) throw unreadResult.error;

    const rows = notificationResult.data || [];
    const unreadBySender = new Map();
    for (const message of unreadResult.data || []) {
      const item = unreadBySender.get(message.sender_id) || {
        id: 'message:' + message.sender_id,
        type: 'message',
        actor_id: message.sender_id,
        body: message.body.slice(0, 160),
        unread_count: 0,
        created_at: message.created_at
      };
      item.unread_count += 1;
      unreadBySender.set(message.sender_id, item);
    }

    const actorIds = [...new Set([
      ...rows.map(row => row.actor_id),
      ...unreadBySender.keys()
    ].filter(Boolean))];
    const { data: profiles, error: profileError } = actorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const names = new Map((profiles || []).map(row => [row.id, row.full_name || 'AIConnectPro member']));

    const connectionNotifications = rows.map(row => {
      const actorName = names.get(row.actor_id) || 'AIConnectPro member';
      const accepted = row.type === 'connection_accepted';
      const declined = row.type === 'connection_declined';
      return {
        id: row.id,
        type: row.type,
        actor_id: row.actor_id,
        request_id: row.request_id,
        actor_name: actorName,
        title: row.type === 'connection_request'
          ? actorName + ' sent you a connection request'
          : actorName + (accepted ? ' accepted your connection request' : declined ? ' declined your connection request' : ' updated a connection request'),
        created_at: row.created_at
      };
    });
    const messageNotifications = [...unreadBySender.values()].map(item => ({
      ...item,
      actor_name: names.get(item.actor_id) || 'AIConnectPro member',
      title: 'New message from ' + (names.get(item.actor_id) || 'AIConnectPro member')
    }));

    const notifications = [...connectionNotifications, ...messageNotifications]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);
    return res.json({
      notifications,
      unread_count: notifications.reduce((sum, item) => sum + (item.type === 'message' ? item.unread_count : 1), 0)
    });
  } catch (error) {
    console.error('Notification lookup failed', error);
    return res.status(500).json({ error: 'notification_lookup_failed' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .is('read_at', null)
      .select('id, read_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'unread_notification_not_found' });
    return res.json({ notification: data });
  } catch (error) {
    console.error('Notification update failed', error);
    return res.status(500).json({ error: 'notification_update_failed' });
  }
});

module.exports = router;
