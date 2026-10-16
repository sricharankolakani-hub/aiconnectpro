// backend/middleware/auth.js
// Keep the existing import path used by posts.js while sharing the same
// Supabase session verification as every other protected route.
module.exports = require('./authMiddleware');
