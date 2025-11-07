// backend/middleware/authMiddleware.js
// Simple JWT auth middleware skeleton. Adapt to your auth system.

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    // Expect Authorization: Bearer <token>
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid_auth' });
    const token = parts[1];

    // Replace this with your JWT secret or public key retrieval
    const secret = process.env.JWT_SECRET || 'dev-secret';

    const payload = jwt.verify(token, secret);
    // attach user info to request
    req.user = payload; // should contain at least { id: '<user-uuid>' }
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', details: err.message });
  }
}

module.exports = authMiddleware;
