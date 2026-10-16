// backend/middleware/authMiddleware.js
const supabase = require('../services/supabaseClient');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = match[1];
    // Supabase verifies the token signature and returns the canonical user identity.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // The signature is already verified above; inspect its AAL claim to require MFA for APIs.
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(401).json({ error: 'Invalid token' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.aal !== 'aal2') {
      return res.status(403).json({ error: 'mfa_required', message: 'Complete authenticator verification to continue.' });
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
