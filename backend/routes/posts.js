// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const requireAuth = require('../middleware/auth'); // auth middleware

// In-memory posts store (demo)
const POSTS = [];

/**
 * GET /api/posts
 * Returns all posts (public)
 */
router.get('/', (req, res) => {
  res.json({ posts: POSTS });
});

/**
 * POST /api/posts
 * Protected: requires Authorization: Bearer <token>
 * body: { type, title, body }
 */
router.post('/', requireAuth, (req, res) => {
  const { type, title, body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body_required' });

  const post = {
    id: uuidv4(),
    type: type || 'post',
    title: title || '',
    body,
    authorId: req.user && req.user.id ? req.user.id : null,
    authorName: req.user && req.user.name ? req.user.name : null,
    createdAt: new Date().toISOString()
  };

  // add to beginning
  POSTS.unshift(post);
  res.json({ post });
});

module.exports = router;
