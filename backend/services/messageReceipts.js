'use strict';

async function markIncomingMessagesDeliveredAndRead(supabase, conversationId, userId, now = () => new Date()) {
  const deliveredAt = now().toISOString();
  const readAt = now().toISOString();
  const [deliveryResult, readResult] = await Promise.all([
    supabase.from('direct_messages')
      .update({ delivered_at: deliveredAt })
      .eq('conversation_id', conversationId).neq('sender_id', userId).is('delivered_at', null),
    supabase.from('direct_messages')
      .update({ read_at: readAt })
      .eq('conversation_id', conversationId).neq('sender_id', userId).is('read_at', null)
  ]);
  if (deliveryResult.error) throw deliveryResult.error;
  if (readResult.error) throw readResult.error;
}

module.exports = { markIncomingMessagesDeliveredAndRead };
