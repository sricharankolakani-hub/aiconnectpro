// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

const POST_TYPES = new Set(['update', 'milestone', 'business', 'learning']);
const POST_VISIBILITY = new Set(['private', 'connections']);
const MAX_POSTS = 30;

async function canViewPost(post, userId) {
  if (post.author_id === userId) return true;
  if (post.visibility !== 'connections') return false;
  const { data, error } = await supabase.from('connection_requests')
    .select('id').eq('status', 'accepted')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${post.author_id}),and(sender_id.eq.${post.author_id},recipient_id.eq.${userId})`)
    .limit(1).maybeSingle();
  return !error && Boolean(data);
}

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
    const postIds = posts.map(post => post.id);
    const { data: reactions, error: reactionError } = postIds.length
      ? await supabase.from('post_reactions').select('post_id, user_id').in('post_id', postIds)
      : { data: [], error: null };
    if (reactionError) {
      console.error('Professional feed reactions lookup failed', reactionError);
      return res.status(500).json({ error: 'feed_lookup_failed' });
    }
    const reactionsByPost = new Map();
    for (const reaction of reactions || []) {
      const current = reactionsByPost.get(reaction.post_id) || { count: 0, viewers: new Set() };
      current.count += 1;
      current.viewers.add(reaction.user_id);
      reactionsByPost.set(reaction.post_id, current);
    }

    const { data: commentRows, error: commentsError } = postIds.length
      ? await supabase.from('post_comments').select('id, post_id, user_id, body, created_at')
        .in('post_id', postIds).order('created_at', { ascending: false }).limit(300)
      : { data: [], error: null };
    if (commentsError) {
      console.error('Professional feed comments lookup failed', commentsError);
      return res.status(500).json({ error: 'feed_lookup_failed' });
    }
    const commentAuthorIds = [...new Set((commentRows || []).map(comment => comment.user_id))];
    const commentProfiles = commentAuthorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', commentAuthorIds)
      : { data: [], error: null };
    if (commentProfiles.error) {
      console.error('Professional feed comment authors lookup failed', commentProfiles.error);
      return res.status(500).json({ error: 'feed_lookup_failed' });
    }
    const commentNames = new Map((commentProfiles.data || []).map(profile => [profile.id, profile.full_name]));
    const commentsByPost = new Map();
    for (const comment of commentRows || []) {
      const current = commentsByPost.get(comment.post_id) || [];
      if (current.length < 10) current.push({
        ...comment,
        author_name: commentNames.get(comment.user_id) || 'AIConnectPro member'
      });
      commentsByPost.set(comment.post_id, current);
    }
    return res.json({
      posts: posts.map(post => {
        const reaction = reactionsByPost.get(post.id);
        return {
          ...post,
          author_name: names.get(post.author_id) || 'AIConnectPro member',
          reaction_count: reaction?.count || 0,
          viewer_reacted: Boolean(reaction?.viewers.has(userId)),
          comments: commentsByPost.get(post.id) || []
        };
      })
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

router.put('/:id([0-9a-fA-F-]{36})/reaction', async (req, res) => {
  const reacted = req.body?.reacted;
  if (typeof reacted !== 'boolean') return res.status(400).json({ error: 'invalid_reaction_state' });
  try {
    const { data: post, error: postError } = await supabase.from('posts')
      .select('id, author_id, visibility').eq('id', req.params.id).maybeSingle();
    if (postError) {
      console.error('Post reaction lookup failed', postError);
      return res.status(500).json({ error: 'reaction_update_failed' });
    }
    if (!post || !(await canViewPost(post, req.user.id))) return res.status(404).json({ error: 'post_not_found' });

    const change = reacted
      ? await supabase.from('post_reactions').upsert({ post_id: post.id, user_id: req.user.id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
      : await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', req.user.id);
    if (change.error) {
      console.error('Post reaction update failed', change.error);
      return res.status(500).json({ error: 'reaction_update_failed' });
    }
    const [{ count, error: countError }, { data: viewer, error: viewerError }] = await Promise.all([
      supabase.from('post_reactions').select('post_id', { count: 'exact', head: true }).eq('post_id', post.id),
      supabase.from('post_reactions').select('post_id').eq('post_id', post.id).eq('user_id', req.user.id).maybeSingle()
    ]);
    if (countError || viewerError) {
      console.error('Post reaction count lookup failed', countError || viewerError);
      return res.status(500).json({ error: 'reaction_update_failed' });
    }
    return res.json({ reaction_count: count || 0, viewer_reacted: Boolean(viewer) });
  } catch (error) {
    console.error('Post reaction update failed', error);
    return res.status(500).json({ error: 'reaction_update_failed' });
  }
});

router.post('/:id([0-9a-fA-F-]{36})/comments', async (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 1500) return res.status(400).json({ error: 'invalid_comment', message: 'Comments must be between 1 and 1,500 characters.' });
  try {
    const { data: post, error: postError } = await supabase.from('posts')
      .select('id, author_id, visibility').eq('id', req.params.id).maybeSingle();
    if (postError) {
      console.error('Post comment lookup failed', postError);
      return res.status(500).json({ error: 'comment_create_failed' });
    }
    if (!post || !(await canViewPost(post, req.user.id))) return res.status(404).json({ error: 'post_not_found' });

    const { data, error } = await supabase.from('post_comments')
      .insert({ post_id: post.id, user_id: req.user.id, body })
      .select('id, post_id, user_id, body, created_at').single();
    if (error) {
      console.error('Post comment creation failed', error);
      return res.status(500).json({ error: 'comment_create_failed' });
    }
    const { data: profile } = await supabase.from('profiles')
      .select('full_name').eq('id', req.user.id).maybeSingle();
    return res.status(201).json({
      comment: { ...data, author_name: profile?.full_name || 'AIConnectPro member' }
    });
  } catch (error) {
    console.error('Post comment creation failed', error);
    return res.status(500).json({ error: 'comment_create_failed' });
  }
});

router.delete('/comments/:commentId([0-9a-fA-F-]{36})', async (req, res) => {
  try {
    const { data, error } = await supabase.from('post_comments').delete()
      .eq('id', req.params.commentId).eq('user_id', req.user.id).select('id').maybeSingle();
    if (error) {
      console.error('Post comment deletion failed', error);
      return res.status(500).json({ error: 'comment_delete_failed' });
    }
    if (!data) return res.status(404).json({ error: 'comment_not_found' });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Post comment deletion failed', error);
    return res.status(500).json({ error: 'comment_delete_failed' });
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
