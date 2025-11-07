// backend/services/reelService.js
// Minimal helper to standardize reel data shapes.

function normalizeReelRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    body: row.body,
    media_url: row.media_url,
    visibility: row.visibility,
    created_at: row.created_at
  };
}

module.exports = { normalizeReelRow };
