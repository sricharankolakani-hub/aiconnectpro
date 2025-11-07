// backend/routes/resume.js
const express = require('express');
const router = express.Router();
const { generateHtml } = require('../services/resumeService');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');

// Supabase bucket name (must exist)
const BUCKET = 'resumes';

/**
 * POST /api/resume/generate
 * Body: { name, title, email, phone, location, summary, experience, education, skills, template, user_id? }
 * Returns: { id, template, url }
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};
    const template = (data.template || 'classic').toLowerCase();

    // generate HTML resume string
    const html = await generateHtml(data, template);

    // generate uuid and filename (inside bucket)
    const id = uuidv4();
    const filename = `${id}.html`; // will be stored at bucket://resumes/<id>.html

    // upload HTML buffer to Supabase Storage with correct content type
    const buffer = Buffer.from(html, 'utf-8');

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: 'text/html',
        upsert: false
      });

    if (uploadErr) {
      console.error('Supabase upload error', uploadErr);
      // If file exists or other error, return helpful message
      return res.status(500).json({ error: 'storage_upload_failed', details: uploadErr.message || uploadErr });
    }

    // Insert metadata row in resumes table (best-effort)
    try {
      const meta = {
        id,
        filename,
        name: data.name || null,
        template,
        user_id: data.user_id || null
      };
      const { error: insertErr } = await supabase.from('resumes').insert([meta]);
      if (insertErr) {
        console.warn('Supabase metadata insert warning', insertErr);
        // continue — we can still return signed url even if metadata insert fails
      }
    } catch (metaErr) {
      console.warn('Metadata insert failed', metaErr && metaErr.message);
    }

    // Create a signed URL for preview — set expiration (seconds). e.g., 7 days
    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(filename, expiresIn);

    if (signedErr) {
      console.error('Supabase createSignedUrl error', signedErr);
      return res.status(500).json({ error: 'signed_url_failed', details: signedErr.message || signedErr });
    }

    const signedUrl = (signedData && (signedData.signedUrl || signedData.signedURL)) || null;
    return res.json({ id, template, url: signedUrl });
  } catch (err) {
    console.error('Resume generate error', err && err.message);
    return res.status(500).json({ error: 'resume_error', details: err.message || 'internal' });
  }
});

/**
 * GET /api/resume/:id
 * Finds metadata by id, then redirects to a short-lived signed URL for the HTML file.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // fetch metadata row to get filename (optional fallback)
    const { data: rows, error: fetchErr } = await supabase.from('resumes').select('filename').eq('id', id).limit(1).single();

    if (fetchErr) {
      // If not found in table, still try to assume filename = <id>.html
      // But if the error is something else, return 404.
      if (fetchErr.code === 'PGRST116' || fetchErr.code === 'NotFound' || fetchErr.message?.includes('No rows')) {
        // fallback to filename
      } else {
        console.warn('Supabase metadata fetch warning', fetchErr);
      }
    }

    const filename = (rows && rows.filename) || `${id}.html`;

    // create a short signed url (e.g., 60 seconds) for immediate preview
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(filename, 60);

    if (signedErr) {
      console.error('Signed URL creation failed', signedErr);
      return res.status(500).json({ error: 'signed_url_failed', details: signedErr.message || signedErr });
    }

    const signedUrl = (signedData && (signedData.signedUrl || signedData.signedURL)) || null;
    if (!signedUrl) return res.status(500).json({ error: 'signed_url_unavailable' });

    // redirect the client to the signed URL (so browser renders the HTML)
    return res.redirect(signedUrl);
  } catch (err) {
    console.error('Resume fetch error', err && err.message);
    return res.status(500).json({ error: 'resume_fetch_error', details: err.message || 'internal' });
  }
});

module.exports = router;
