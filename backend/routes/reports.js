// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS = new Set(['spam', 'harassment', 'hate_or_abuse', 'misleading', 'unsafe', 'other']);
const DAILY_LIMIT = 10;

router.post('/', auth, async (req, res) => {
  const { target_type: targetType, target_id: targetId, reason, details = '' } = req.body || {};
  if (!['reel', 'member'].includes(targetType) || typeof targetId !== 'string' || !UUID.test(targetId)) {
    return res.status(400).json({ error: 'invalid_report_target' });
  }
  if (!REASONS.has(reason)) return res.status(400).json({ error: 'choose_a_report_reason' });
  if (typeof details !== 'string' || details.trim().length > 1000) {
    return res.status(400).json({ error: 'report_details_too_long' });
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await supabase.from('content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', req.user.id)
      .gte('created_at', since);
    if (rateError) throw rateError;
    if ((count || 0) >= DAILY_LIMIT) return res.status(429).json({ error: 'daily_report_limit_reached' });

    let targetUserId = null;
    let targetReelId = null;
    if (targetType === 'reel') {
      const { data: reel, error } = await supabase.from('reels')
        .select('id, user_id, visibility')
        .eq('id', targetId)
        .maybeSingle();
      if (error) throw error;
      if (!reel || reel.visibility !== 'public') return res.status(404).json({ error: 'report_target_not_found' });
      if (reel.user_id === req.user.id) return res.status(400).json({ error: 'cannot_report_own_content' });
      targetUserId = reel.user_id;
      targetReelId = reel.id;
    } else {
      if (targetId === req.user.id) return res.status(400).json({ error: 'cannot_report_yourself' });
      const { data: profile, error } = await supabase.from('profiles')
        .select('id').eq('id', targetId).maybeSingle();
      if (error) throw error;
      if (!profile) return res.status(404).json({ error: 'report_target_not_found' });
      targetUserId = profile.id;
    }

    const { data, error } = await supabase.from('content_reports').insert({
      reporter_id: req.user.id,
      target_type: targetType,
      target_reel_id: targetReelId,
      target_user_id: targetUserId,
      reason,
      details: details.trim()
    }).select('id, status, created_at').single();
    if (error) throw error;
    return res.status(201).json({ report: data });
  } catch (error) {
    console.error('Content report submission failed', error);
    return res.status(500).json({ error: 'report_submission_failed' });
  }
});

module.exports = router;
