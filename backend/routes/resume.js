// backend/routes/resume.js
const express = require('express');
const router = express.Router();
const { generateHtml } = require('../services/resumeService');
const { generatePdfFromHtml } = require('../services/pdfService');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');

// Supabase bucket name (must exist)
const BUCKET = 'resumes';

/**
 * POST /api/resume/generate
 * Body: { name, title, email, phone, location, summary, experience, education, skills, template, user_id? }
 * Returns: { id, template, url (html signed url), pdfUrl (signed pdf url) }
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};
    const template = (data.template || 'classic').toLowerCase();

    // generate HTML resume string
    const html = await generateHtml(data, template);

    // generate uuid id and filenames
    const id = uuidv4();
    const htmlFilename = `${id}.html`;
    const pdfFilename = `${id}.pdf`;

    // upload HTML buffer to Supabase Storage with content type
    const htmlBuffer = Buffer.from(html, 'utf-8');
    const { error: uploadHtmlErr } = await supabase.storage.from(BUCKET).upload(htmlFilename, htmlBuffer, {
      contentType: 'text/html',
      upsert: false
    });

    if (uploadHtmlErr) {
      console.error('Supabase HTML upload error', uploadHtmlErr);
      return res.status(500).json({ error: 'storage_upload_failed', details: uploadHtmlErr.message || uploadHtmlErr });
    }

    // generate PDF buffer from HTML (server-side)
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePdfFromHtml(html);
    } catch (pdfErr) {
      console.error('PDF generation failed', pdfErr && (pdfErr.message || pdfErr));
      // Continue — we still can return HTML URL even if PDF generation fails
    }

    // upload PDF to Supabase Storage (if generated)
    if (pdfBuffer) {
      const { error: uploadPdfErr } = await supabase.storage.from(BUCKET).upload(pdfFilename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });
      if (uploadPdfErr) {
        console.warn('Supabase PDF upload warning', uploadPdfErr);
        // continue
      }
    }

    // Insert metadata into resumes table (best-effort)
    try {
      const meta = {
        id,
        filename: htmlFilename,
        name: data.name || null,
        template,
        user_id: data.user_id || null
      };
      const { error: insertErr } = await supabase.from('resumes').insert([meta]);
      if (insertErr) {
        console.warn('Supabase metadata insert warning', insertErr);
      }
    } catch (metaErr) {
      console.warn('Metadata insert failed', metaErr && (metaErr.message || metaErr));
    }

    // create signed URLs
    const expiresInHtml = 60 * 60 * 24 * 7; // 7 days for HTML preview
    const { data: signedHtmlData, error: signedHtmlErr } = await supabase.storage.from(BUCKET).createSignedUrl(htmlFilename, expiresInHtml);
    if (signedHtmlErr) {
      console.error('Signed URL creation failed for HTML', signedHtmlErr);
    }
    const htmlSignedUrl = signedHtmlData && (signedHtmlData.signedUrl || signedHtmlData.signedURL);

    let pdfSignedUrl = null;
    if (pdfBuffer) {
      // shorter expiry for PDFs if you want
      const expiresInPdf = 60 * 60 * 24 * 7;
      const { data: signedPdfData, error: signedPdfErr } = await supabase.storage.from(BUCKET).createSignedUrl(pdfFilename, expiresInPdf);
      if (signedPdfErr) {
        console.warn('Signed URL creation failed for PDF', signedPdfErr);
      } else {
        pdfSignedUrl = signedPdfData && (signedPdfData.signedUrl || signedPdfData.signedURL);
      }
    }

    return res.json({
      id,
      template,
      url: htmlSignedUrl || null,
      pdfUrl: pdfSignedUrl || null
    });
  } catch (err) {
    console.error('Resume generate error', err && err.message);
    return res.status(500).json({ error: 'resume_error', details: err.message || 'internal' });
  }
});

/**
 * GET /api/resume/:id
 * Redirects to a short-lived signed URL for the HTML file by id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: row, error: fetchErr } = await supabase.from('resumes').select('filename').eq('id', id).limit(1).single();

    let filename = `${id}.html`;
    if (!fetchErr && row && row.filename) filename = row.filename;

    // create a short signed url (60 seconds) for immediate preview
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(filename, 60);
    if (signedErr) {
      console.error('Signed URL creation failed', signedErr);
      return res.status(500).json({ error: 'signed_url_failed', details: signedErr.message || signedErr });
    }
    const signedUrl = (signedData && (signedData.signedUrl || signedData.signedURL)) || null;
    if (!signedUrl) return res.status(500).json({ error: 'signed_url_unavailable' });

    return res.redirect(signedUrl);
  } catch (err) {
    console.error('Resume fetch error', err && err.message);
    return res.status(500).json({ error: 'resume_fetch_error', details: err.message || 'internal' });
  }
});

module.exports = router;
