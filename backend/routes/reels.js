// backend/routes/reels.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient'); // must exist (we added earlier)
const auth = require('../middleware/authMiddleware');
const { normalizeReelRow } = require('../services/reelService');

/**
 * POST /api/reels
 * body: { title, body, media_url, visibility }
 * Auth required (signed-in users only)
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { title, body, media_url, visibility } = req.body;
    const rec = {
      user_id: userId,
      title: title || null,
      body: body || null,
      media_url: media_url || null,
      visibility: visibility === 'public' ? 'public' : 'private'
    };

    const { data, error } = await supabase.from('reels').insert([rec]).select().single();
    if (error) return res.status(500).json({ error: 'db_error', details: error.message || error });

    return res.json({ reel: normalizeReelRow(data) });
  } catch (err) {
    console.error('Reel create error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * GET /api/reels
 * Query params: ?limit=20&offset=0
 * Returns reels visible to signed-in users (private visibility allowed)
 * For simplicity, require auth to list (as you requested jobs visible only to signed-in users).
 */
router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = parseInt(req.query.offset || '0', 10);

    // Fetch reels ordered by created_at desc
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: 'db_error', details: error.message || error });

    const reels = (data || []).map(normalizeReelRow);
    return res.json({ reels });
  } catch (err) {
    console.error('Reel list error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * POST /api/reels/:id/like
 * Toggle like (idempotent). Auth required.
 */
router.post('/:id/like', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;

    // try insert; if conflicts, delete (toggle)
    const { error: insertErr } = await supabase.from('reel_likes').insert([{ reel_id: reelId, user_id: userId }]);
    if (!insertErr) {
      // liked successfully
      return res.json({ liked: true });
    }

    // if insert failed because already exists, delete like
    // we guard by attempting deletion
    const { error: delErr } = await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', userId);
    if (delErr) {
      // if deletion fails, return error
      return res.status(500).json({ error: 'db_error', details: delErr.message || delErr });
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
 * Auth required
 */
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;
    const { comment } = req.body;
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_comment' });
    }

    const rec = { reel_id: reelId, user_id: userId, comment: comment.trim() };
    const { data, error } = await supabase.from('reel_comments').insert([rec]).select().single();
    if (error) return res.status(500).json({ error: 'db_error', details: error.message || error });

    return res.json({ comment: data });
  } catch (err) {
    console.error('Comment error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

module.exports = router;
