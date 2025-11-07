// backend/routes/jobs.js
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient'); // existing
const auth = require('../middleware/authMiddleware');   // existing
const { v4: uuidv4 } = require('uuid');

/**
 * Job object fields:
 * id uuid PK
 * title text
 * type text ('job'|'freelance'|'govt'|'business')
 * description text
 * company_id uuid (nullable)
 * location text
 * is_private boolean
 * posted_by uuid
 * created_at timestamptz
 */

/**
 * POST /api/jobs
 * Create a job posting
 * Auth required
 * Body: { title, type, description, company_id, location, is_private }
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { title, type, description, company_id, location, is_private } = req.body || {};
    if (!title || !type) return res.status(400).json({ error: 'missing_fields', details: 'title and type required' });

    const rec = {
      id: uuidv4(),
      title: String(title).trim(),
      type: String(type).trim(),
      description: description ? String(description) : null,
      company_id: company_id || null,
      location: location ? String(location) : null,
      is_private: !!is_private,
      posted_by: userId
    };

    const { data, error } = await supabase.from('jobs').insert([rec]).select().single();
    if (error) {
      console.error('Job insert error', error);
      return res.status(500).json({ error: 'db_error', details: error.message || error });
    }

    return res.status(201).json({ job: data });
  } catch (err) {
    console.error('Create job error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * GET /api/jobs
 * List jobs (visible only to signed-in users)
 * Query params:
 *   - type (job|freelance|govt|business)
 *   - location
 *   - company_id
 *   - limit, offset
 */
router.get('/', auth, async (req, res) => {
  try {
    const qType = req.query.type;
    const qLocation = req.query.location;
    const qCompany = req.query.company_id;
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = parseInt(req.query.offset || '0', 10);

    let builder = supabase.from('jobs').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (qType) builder = builder.eq('type', qType);
    if (qCompany) builder = builder.eq('company_id', qCompany);
    if (qLocation) builder = builder.ilike('location', `%${qLocation}%`);

    const { data, error } = await builder;
    if (error) {
      console.error('Jobs list error', error);
      return res.status(500).json({ error: 'db_error', details: error.message || error });
    }

    return res.json({ jobs: data || [] });
  } catch (err) {
    console.error('Jobs listing failed', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * GET /api/jobs/:id
 * Fetch job details
 * Auth required (as per your choice)
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).limit(1).single();
    if (error) {
      console.error('Job fetch error', error);
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json({ job: data });
  } catch (err) {
    console.error('Job fetch failed', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * POST /api/jobs/:id/apply
 * Apply to a job (attach resume id)
 * Auth required
 * Body: { resume_id, message }
 */
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const jobId = req.params.id;
    const { resume_id, message } = req.body || {};

    // Basic validation: ensure job exists
    const { data: jobRow, error: jobErr } = await supabase.from('jobs').select('id, is_private, posted_by').eq('id', jobId).limit(1).single();
    if (jobErr || !jobRow) {
      return res.status(404).json({ error: 'job_not_found' });
    }

    // Optionally prevent applying to private jobs unless invited - here we allow apply
    const application = {
      id: uuidv4(),
      job_id: jobId,
      user_id: userId,
      message: message || null,
      resume_id: resume_id || null,
      status: 'applied',
      created_at: new Date().toISOString()
    };

    // Ensure applications table exists; insert application
    const { error: insertErr } = await supabase.from('applications').insert([application]);
    if (insertErr) {
      console.error('Application insert error', insertErr);
      return res.status(500).json({ error: 'db_error', details: insertErr.message || insertErr });
    }

    // Optionally: notify job poster (email/webhook) — left as TODO
    return res.status(201).json({ applied: true, applicationId: application.id });
  } catch (err) {
    console.error('Apply error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

/**
 * OPTIONAL: GET /api/companies - list companies (public)
 * If you have a companies table, you can enable this.
 */
router.get('/_companies/list', async (req, res) => {
  try {
    const { data, error } = await supabase.from('companies').select('*').order('name', { ascending: true }).limit(200);
    if (error) return res.status(500).json({ error: 'db_error', details: error.message || error });
    return res.json({ companies: data || [] });
  } catch (err) {
    console.error('Companies list failed', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
});

module.exports = router;
