// backend/routes/reels.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');
const { normalizeReelRow } = require('../services/reelService');

/**
 * POST /api/reels
 * body: { title, body, media_url, visibility }
 * Auth required.
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, body, media_url, visibility } = req.body || {};
    const rec = {
      user_id: userId,
      title: title || null,
      body: body || null,
      media_url: media_url || null,
      visibility: visibility === 'public' ? 'public' : 'private'
    };

    const { data, error } = await supabase.from('reels').insert([rec]).select().single();
    if (error) return res.status(500).json({ error: 'db_error', details: error.message });
    return res.status(201).json({ reel: normalizeReelRow(data) });
  } catch (err) {
    console.error('Reel create error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * GET /api/reels?mine=true&limit=8&offset=0
 * Auth required. Returns a paginated feed.
 */
router.get('/', auth, async (req, res) => {
  try {
    const limitValue = Number.parseInt(req.query.limit || '20', 10);
    const offsetValue = Number.parseInt(req.query.offset || '0', 10);
    const limit = Number.isFinite(limitValue) ? Math.min(50, Math.max(1, limitValue)) : 20;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    let query = supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.mine === 'true') {
      query = query.eq('user_id', req.user.id);
    } else {
      // The feed includes public reels and the signed-in user's own private reels.
      query = query.or(`visibility.eq.public,user_id.eq.${req.user.id}`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'db_error', details: error.message });
    return res.json({ reels: (data || []).map(normalizeReelRow) });
  } catch (err) {
    console.error('Reel list error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * POST /api/reels/:id/like
 * Toggle a like. Auth required.
 */
router.post('/:id/like', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, user_id, visibility')
      .eq('id', reelId)
      .maybeSingle();
    if (reelError) return res.status(500).json({ error: 'db_error', details: reelError.message });
    if (!reel || (reel.visibility !== 'public' && reel.user_id !== userId)) {
      return res.status(404).json({ error: 'reel_not_found' });
    }

    const { error: insertErr } = await supabase.from('reel_likes').insert([
      { reel_id: reelId, user_id: userId }
    ]);

    if (!insertErr) return res.json({ liked: true });
    if (insertErr.code !== '23505') {
      return res.status(500).json({ error: 'db_error', details: insertErr.message });
    }

    const { error: deleteErr } = await supabase
      .from('reel_likes')
      .delete()
      .eq('reel_id', reelId)
      .eq('user_id', userId);

    if (deleteErr) {
      return res.status(500).json({ error: 'db_error', details: deleteErr.message });
    }
    return res.json({ liked: false });
  } catch (err) {
    console.error('Like error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * POST /api/reels/:id/comment
 * body: { comment }
 * Auth required.
 */
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, user_id, visibility')
      .eq('id', reelId)
      .maybeSingle();
    if (reelError) return res.status(500).json({ error: 'db_error', details: reelError.message });
    if (!reel || (reel.visibility !== 'public' && reel.user_id !== userId)) {
      return res.status(404).json({ error: 'reel_not_found' });
    }
    const { comment } = req.body || {};
    if (typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_comment' });
    }

    const { data, error } = await supabase
      .from('reel_comments')
      .insert([{ reel_id: reelId, user_id: userId, comment: comment.trim() }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'db_error', details: error.message });
    return res.json({ comment: data });
  } catch (err) {
    console.error('Comment error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

module.exports = router;
