// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

const POST_TYPES = new Set(['update', 'milestone', 'business', 'learning']);
const POST_VISIBILITY = new Set(['private', 'connections']);
const MAX_POSTS = 30;

router.use(auth);

router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const [ownResult, connectionsResult] = await Promise.all([
      supabase.from('posts')
        .select('id, author_id, type, title, body, visibility, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_POSTS),
      supabase.from('connection_requests')
        .select('sender_id, recipient_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .limit(5000)
    ]);

    if (ownResult.error || connectionsResult.error) {
      console.error('Professional feed lookup failed', ownResult.error || connectionsResult.error);
      return res.status(500).json({ error: 'feed_lookup_failed' });
    }

    const connectionIds = [...new Set((connectionsResult.data || []).map(row =>
      row.sender_id === userId ? row.recipient_id : row.sender_id
    ).filter(Boolean))];
    let connectionPosts = [];
    if (connectionIds.length) {
      const { data, error } = await supabase.from('posts')
        .select('id, author_id, type, title, body, visibility, created_at')
        .eq('visibility', 'connections')
        .in('author_id', connectionIds)
        .order('created_at', { ascending: false })
        .limit(MAX_POSTS);
      if (error) {
        console.error('Connection feed lookup failed', error);
        return res.status(500).json({ error: 'feed_lookup_failed' });
      }
      connectionPosts = data || [];
    }

    const posts = [...(ownResult.data || []), ...connectionPosts]
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .slice(0, MAX_POSTS);
    const authorIds = [...new Set(posts.map(post => post.author_id))];
    const profileResult = authorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : { data: [], error: null };
    if (profileResult.error) {
      console.error('Professional feed author lookup failed', profileResult.error);
      return res.status(500).json({ error: 'feed_lookup_failed' });
    }
    const names = new Map((profileResult.data || []).map(profile => [profile.id, profile.full_name]));
    return res.json({
      posts: posts.map(post => ({
        ...post,
        author_name: names.get(post.author_id) || 'AIConnectPro member'
      }))
    });
  } catch (error) {
    console.error('Professional feed lookup failed', error);
    return res.status(500).json({ error: 'feed_lookup_failed' });
  }
});

router.post('/', async (req, res) => {
  const { type = 'update', title = '', body, visibility = 'private' } = req.body || {};
  const cleanedTitle = typeof title === 'string' ? title.trim() : '';
  const cleanedBody = typeof body === 'string' ? body.trim() : '';
  if (!POST_TYPES.has(type)) return res.status(400).json({ error: 'invalid_post_type' });
  if (!POST_VISIBILITY.has(visibility)) return res.status(400).json({ error: 'invalid_post_visibility' });
  if (!cleanedBody || cleanedBody.length > 3000 || cleanedTitle.length > 160) {
    return res.status(400).json({ error: 'invalid_post_content', message: 'Add an update of 1–3000 characters and a title up to 160 characters.' });
  }

  try {
    const { data, error } = await supabase.from('posts').insert({
      author_id: req.user.id,
      type,
      title: cleanedTitle,
      body: cleanedBody,
      visibility
    }).select('id, author_id, type, title, body, visibility, created_at').single();
    if (error) {
      console.error('Professional post creation failed', error);
      return res.status(500).json({ error: 'post_create_failed' });
    }
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('full_name').eq('id', req.user.id).maybeSingle();
    if (profileError) console.warn('Professional post author name lookup failed', profileError);
    return res.status(201).json({
      post: { ...data, author_name: profile?.full_name || 'AIConnectPro member' }
    });
  } catch (error) {
    console.error('Professional post creation failed', error);
    return res.status(500).json({ error: 'post_create_failed' });
  }
});

router.delete('/:id([0-9a-fA-F-]{36})', async (req, res) => {
  try {
    const { data, error } = await supabase.from('posts').delete()
      .eq('id', req.params.id)
      .eq('author_id', req.user.id)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('Professional post deletion failed', error);
      return res.status(500).json({ error: 'post_delete_failed' });
    }
    if (!data) return res.status(404).json({ error: 'post_not_found' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Professional post deletion failed', error);
    return res.status(500).json({ error: 'post_delete_failed' });
  }
});

module.exports = router;
