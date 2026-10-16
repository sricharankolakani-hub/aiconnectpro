module.exports = function requireAdmin(req, res, next) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'admin_access_required' });
  }
  return next();
};
