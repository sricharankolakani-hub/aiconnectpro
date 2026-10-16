// backend/middleware/authMiddleware.js
const supabase = require('../services/supabaseClient');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Supabase verifies the access token and returns the canonical user identity.
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = data.user;
    req.user = {
      id: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      roles: user.app_metadata?.roles || []
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
