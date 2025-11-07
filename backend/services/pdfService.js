// backend/services/pdfService.js
const puppeteer = require('puppeteer');

/**
 * generatePdfFromHtml
 * @param {string} html - full HTML string
 * @param {object} opts - optional puppeteer pdf options
 * @returns {Buffer} PDF bytes buffer
 */
async function generatePdfFromHtml(html, opts = {}) {
  // sensible defaults
  const pdfOptions = Object.assign({
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
  }, opts);

  // launch puppeteer - add no-sandbox flags for container environments
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  });

  try {
    const page = await browser.newPage();

    // set a default viewport so rendering is consistent
    await page.setViewport({ width: 1200, height: 800 });

    // set content and wait until network idle so external fonts/CSS load
    await page.setContent(html, { waitUntil: ['networkidle0'] });

    // wait a short period if there are fonts or slow assets
    await page.waitForTimeout(300);

    const pdfBuffer = await page.pdf(pdfOptions);
    await page.close();
    return pdfBuffer;
  } finally {
    try { await browser.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = { generatePdfFromHtml };
