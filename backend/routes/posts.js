// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const POSTS = [];

/**
 * GET /api/posts
 * Returns all posts (demo)
 */
router.get('/', (req, res) => {
  res.json({ posts: POSTS });
});

/**
 * POST /api/posts
 * body: { type, title, body }
 */
router.post('/', (req, res) => {
  const { type, title, body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body_required' });
  const post = {
    id: uuidv4(),
    type: type || 'post',
    title: title || '',
    body,
    createdAt: new Date().toISOString()
  };
  POSTS.unshift(post);
  res.json({ post });
});

module.exports = router;
