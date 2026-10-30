// backend/routes/reels.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');
const { normalizeReelRow } = require('../services/reelService');

function canView(reel, userId) {
  return reel && (reel.visibility === 'public' || reel.user_id === userId);
}

async function withSignedMedia(reel) {
  const normalized = normalizeReelRow(reel);
  const path = normalized.media_url;
  if (!path) return normalized;
  if (/^https?:\/\//i.test(path)) return normalized;

  const { data, error } = await supabase.storage.from('reel-media').createSignedUrl(path, 3600);
  if (error) {
    console.error('Reel media signing failed', error);
    normalized.media_url = null;
    return normalized;
  }
  normalized.media_url = data.signedUrl;
  return normalized;
}

async function getReel(reelId) {
  const { data, error } = await supabase
    .from('reels')
    .select('id, user_id, title, body, media_url, visibility, created_at')
    .eq('id', reelId)
    .maybeSingle();
  return { data, error };
}

/** Create a Reel with text and/or an uploaded storage path. */
router.post('/', auth, async (req, res) => {
  try {
    const { title, body, media_url, visibility } = req.body || {};
    const titleText = typeof title === 'string' ? title.trim().slice(0, 160) : '';
    const bodyText = typeof body === 'string' ? body.trim().slice(0, 3000) : '';
    const mediaPath = typeof media_url === 'string' ? media_url.trim().slice(0, 1000) : '';
    if (!titleText && !bodyText && !mediaPath) {
      return res.status(400).json({ error: 'reel_content_required' });
    }
    const mediaSegments = mediaPath ? mediaPath.split('/') : [];
    const mediaPathBelongsToUser = mediaPath.startsWith(`${req.user.id}/`)
      && !mediaPath.includes('\\')
      && mediaSegments.every(segment => segment && segment !== '.' && segment !== '..');
    if (mediaPath && !mediaPathBelongsToUser) {
      return res.status(400).json({ error: 'media_path_must_belong_to_user' });
    }

    const rec = {
      user_id: req.user.id,
      title: titleText || null,
      body: bodyText || null,
      media_url: mediaPath || null,
      visibility: visibility === 'public' ? 'public' : 'private'
    };
    const { data, error } = await supabase.from('reels').insert([rec]).select().single();
    if (error) return res.status(500).json({ error: 'db_error', details: error.message });
    return res.status(201).json({ reel: await withSignedMedia(data) });
  } catch (err) {
    console.error('Reel create error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

/** Return a paginated feed with engagement counts and recent comments. */
router.get('/', auth, async (req, res) => {
  try {
    const limitValue = Number.parseInt(req.query.limit || '20', 10);
    const offsetValue = Number.parseInt(req.query.offset || '0', 10);
    const limit = Number.isFinite(limitValue) ? Math.min(50, Math.max(1, limitValue)) : 20;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    let query = supabase.from('reels').select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    query = req.query.mine === 'true'
      ? query.eq('user_id', req.user.id)
      : query.or(`visibility.eq.public,user_id.eq.${req.user.id}`);

    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: 'db_error', details: error.message });
    const reels = rows || [];
    const ids = reels.map(row => row.id);
    if (!ids.length) return res.json({ reels: [] });

    const [likesResult, commentsResult, sharesResult] = await Promise.all([
      supabase.from('reel_likes').select('reel_id, user_id').in('reel_id', ids),
      supabase.from('reel_comments').select('id, reel_id, user_id, comment, created_at')
        .in('reel_id', ids).order('created_at', { ascending: false }),
      supabase.from('reel_shares').select('reel_id').in('reel_id', ids)
    ]);
    for (const result of [likesResult, commentsResult, sharesResult]) {
      if (result.error) return res.status(500).json({ error: 'engagement_lookup_failed' });
    }

    const decorated = await Promise.all(reels.map(async reel => {
      const likes = likesResult.data.filter(item => item.reel_id === reel.id);
      const comments = commentsResult.data.filter(item => item.reel_id === reel.id);
      const shares = sharesResult.data.filter(item => item.reel_id === reel.id);
      return {
        ...await withSignedMedia(reel),
        is_owner: reel.user_id === req.user.id,
        like_count: likes.length,
        comment_count: comments.length,
        share_count: shares.length,
        liked: likes.some(item => item.user_id === req.user.id),
        recent_comments: comments.slice(0, 3)
      };
    }));
    return res.json({ reels: decorated });
  } catch (err) {
    console.error('Reel list error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

/** List comments for a visible Reel. */
router.get('/:id/comments', auth, async (req, res) => {
  const { data: reel, error: reelError } = await getReel(req.params.id);
  if (reelError) return res.status(500).json({ error: 'reel_lookup_failed' });
  if (!canView(reel, req.user.id)) return res.status(404).json({ error: 'reel_not_found' });

  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '30', 10) || 30));
  const { data, error } = await supabase.from('reel_comments')
    .select('id, reel_id, user_id, comment, created_at')
    .eq('reel_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: 'comments_lookup_failed' });
  return res.json({ comments: data || [] });
});

/** Toggle the current user's like. */
router.post('/:id/like', auth, async (req, res) => {
  const { data: reel, error: reelError } = await getReel(req.params.id);
  if (reelError) return res.status(500).json({ error: 'reel_lookup_failed' });
  if (!canView(reel, req.user.id)) return res.status(404).json({ error: 'reel_not_found' });

  const { error: insertError } = await supabase.from('reel_likes').insert({
    reel_id: req.params.id,
    user_id: req.user.id
  });
  let liked = true;
  if (insertError?.code === '23505') {
    const { error: deleteError } = await supabase.from('reel_likes')
      .delete().eq('reel_id', req.params.id).eq('user_id', req.user.id);
    if (deleteError) return res.status(500).json({ error: 'like_update_failed' });
    liked = false;
  } else if (insertError) {
    return res.status(500).json({ error: 'like_update_failed' });
  }

  const { count, error } = await supabase.from('reel_likes').select('id', { count: 'exact', head: true })
    .eq('reel_id', req.params.id);
  if (error) return res.status(500).json({ error: 'like_count_failed' });
  return res.json({ liked, like_count: count || 0 });
});

/** Add a comment. */
router.post('/:id/comment', auth, async (req, res) => {
  const { data: reel, error: reelError } = await getReel(req.params.id);
  if (reelError) return res.status(500).json({ error: 'reel_lookup_failed' });
  if (!canView(reel, req.user.id)) return res.status(404).json({ error: 'reel_not_found' });

  const comment = req.body?.comment;
  if (typeof comment !== 'string' || comment.trim().length === 0 || comment.trim().length > 1500) {
    return res.status(400).json({ error: 'comment_must_be_between_1_and_1500_characters' });
  }
  const { data, error } = await supabase.from('reel_comments')
    .insert({ reel_id: req.params.id, user_id: req.user.id, comment: comment.trim() })
    .select('id, reel_id, user_id, comment, created_at')
    .single();
  if (error) return res.status(500).json({ error: 'comment_create_failed' });
  const { count } = await supabase.from('reel_comments').select('id', { count: 'exact', head: true })
    .eq('reel_id', req.params.id);
  return res.status(201).json({ comment: data, comment_count: count || 0 });
});

/** Delete a Reel owned by the signed-in member and clean up its private media. */
router.delete('/:id', auth, async (req, res) => {
  const { data: reel, error: reelError } = await getReel(req.params.id);
  if (reelError) return res.status(500).json({ error: 'reel_lookup_failed' });
  if (!reel) return res.status(404).json({ error: 'reel_not_found' });
  if (reel.user_id !== req.user.id) return res.status(403).json({ error: 'not_reel_owner' });

  const { data: deleted, error: deleteError } = await supabase.from('reels')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (deleteError) return res.status(500).json({ error: 'reel_delete_failed' });
  if (!deleted) return res.status(404).json({ error: 'reel_not_found' });

  if (reel.media_url && !/^https?:\/\//i.test(reel.media_url)) {
    const { error: storageError } = await supabase.storage.from('reel-media').remove([reel.media_url]);
    if (storageError) console.error('Deleted Reel media cleanup failed', storageError);
  }

  return res.json({ deleted: true });
});

/** Count a successful share action for public Reels only. */
router.post('/:id/share', auth, async (req, res) => {
  const { data: reel, error: reelError } = await getReel(req.params.id);
  if (reelError) return res.status(500).json({ error: 'reel_lookup_failed' });
  if (!reel || reel.visibility !== 'public') return res.status(404).json({ error: 'public_reel_not_found' });
  const { error } = await supabase.from('reel_shares').insert({
    reel_id: req.params.id,
    user_id: req.user.id
  });
  if (error) return res.status(500).json({ error: 'share_count_failed' });
  const { count } = await supabase.from('reel_shares').select('id', { count: 'exact', head: true })
    .eq('reel_id', req.params.id);
  return res.json({ share_count: count || 0 });
});

module.exports = router;
