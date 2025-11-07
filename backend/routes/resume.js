// backend/routes/resume.js
const express = require('express');
const router = express.Router();
const { generateHtml } = require('../services/resumeService');
const { v4: uuidv4 } = require('uuid');

const RESUMES = {}; // in-memory storage (demo)

/**
 * POST /api/resume/generate
 * Body: { name, title, email, phone, location, summary, experience:[...], education:[...], skills:[...], template }
 * Returns: { html, id, template }
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};
    const template = (data.template || 'classic').toLowerCase();
    const html = await generateHtml(data, template);
    const id = uuidv4();
    RESUMES[id] = { html, createdAt: Date.now(), meta: { name: data.name || '', template } };
    return res.json({ html, id, template });
  } catch (err) {
    console.error('Resume generate error', err && err.message);
    return res.status(500).json({ error: 'resume_error', details: err.message || 'internal' });
  }
});

/**
 * GET /api/resume/:id
 * Returns stored resume HTML by ID (demo storage)
 */
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const r = RESUMES[id];
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', 'text/html');
  return res.send(r.html);
});

module.exports = router;
