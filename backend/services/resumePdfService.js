// backend/services/resumePdfService.js
// Generates a PDF from HTML using Puppeteer and uploads to Supabase storage.
// Returns { id, signedUrl }.

const puppeteer = require('puppeteer');
const supabase = require('./supabaseClient'); // adjust path if necessary
const { v4: uuidv4 } = require('uuid');

async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-zygote',
      '--single-process'
    ]
  });
}

async function htmlToPdfBuffer(html, options = {}) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // set a generous timeout; caller can set shorter if desired
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: options.printBackground !== false, // default true
      margin: options.margin || { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      preferCSSPageSize: true
    });
    return pdfBuffer;
  } finally {
    try { await browser.close(); } catch (e) { /* ignore close errors */ }
  }
}

async function uploadPdfBufferToSupabase(buffer, destFilename = null) {
  const id = destFilename || `resume-${uuidv4()}.pdf`;
  const bucket = process.env.SUPABASE_RESUME_BUCKET || 'resumes'; // ensure this bucket exists

  // upload expects a stream or buffer with proper options
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(`resumes/${id}`, buffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (error) {
    const err = new Error('Supabase upload failed: ' + (error.message || JSON.stringify(error)));
    err.original = error;
    throw err;
  }

  // create signed url (expiry in seconds)
  const expiresIn = parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || String(60 * 60), 10); // default 1 hour
  const { data: signedData, error: signedErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(`resumes/${id}`, expiresIn);

  if (signedErr) {
    const err = new Error('Supabase createSignedUrl failed: ' + (signedErr.message || JSON.stringify(signedErr)));
    err.original = signedErr;
    throw err;
  }

  return { id, signedUrl: signedData.signedUrl };
}

module.exports = {
  htmlToPdfBuffer,
  uploadPdfBufferToSupabase
};
