// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Demo in-memory user store (replace with DB for production)
const USERS = [];

/**
 * POST /api/auth/signup
 * body: { name, email, password, roles }
 */
router.post('/signup', (req, res) => {
  const { name, email, password, roles = [] } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  // simple uniqueness check
  if (USERS.find(u => u.email === email)) return res.status(409).json({ error: 'user_exists' });
  const id = uuidv4();
  const user = { id, name, email, password, roles };
  USERS.push(user);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, roles: user.roles }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, roles: user.roles } });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = USERS.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, roles: user.roles }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, roles: user.roles } });
});

module.exports = router;
