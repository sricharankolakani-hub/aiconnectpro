// backend/middleware/authMiddleware.js
const supabase = require('../services/supabaseClient');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = match[1];
    // Supabase verifies the token signature and returns the canonical user identity.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = data.user;
    if (!user.email_confirmed_at) {
      return res.status(403).json({ error: 'email_verification_required', message: 'Verify your email before using AIConnectPro.' });
    }

    // MFA is optional. If this user has a verified factor, require an AAL2 session.
    const { data: factorData, error: factorError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
    if (factorError) return res.status(503).json({ error: 'auth_verification_unavailable' });
    const hasVerifiedFactor = (factorData.factors || []).some(factor => factor.factor_type === 'totp' && factor.status === 'verified');
    if (hasVerifiedFactor) {
      const parts = token.split('.');
      if (parts.length !== 3) return res.status(401).json({ error: 'Invalid token' });
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.aal !== 'aal2') {
        return res.status(403).json({ error: 'mfa_required', message: 'Complete your second-step verification to continue.' });
      }
    }


    req.user = {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      roles: user.app_metadata?.roles || []
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
