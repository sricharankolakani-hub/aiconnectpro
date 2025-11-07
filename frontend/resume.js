// frontend/resume.js
const API_BASE = '/api'; // your backend proxy base path (Vercel rewrites this to your backend)
function el(id) { return document.getElementById(id); }

// Collect form data
function collectData() {
  const experience = [{
    company: el('exp-company').value.trim(),
    role: el('exp-role').value.trim(),
    from: el('exp-from').value.trim(),
    to: el('exp-to').value.trim(),
    desc: el('exp-desc').value.trim()
  }].filter(x => x.role || x.company || x.desc);

  const education = [{
    school: el('edu-school').value.trim(),
    degree: el('edu-degree').value.trim(),
    year: el('edu-year').value.trim()
  }].filter(x => x.school || x.degree);

  const skills = (el('skills').value || '').split(',').map(s => s.trim()).filter(Boolean);

  return {
    name: el('name').value.trim(),
    title: el('title').value.trim(),
    email: el('email').value.trim(),
    phone: el('phone').value.trim(),
    location: el('location').value.trim(),
    summary: el('summary').value.trim(),
    experience,
    education,
    skills,
    template: el('template-select') ? el('template-select').value : 'classic'
  };
}

// Generate resume (HTML + PDF)
async function generateResume(save = false) {
  el('result').textContent = 'Generating...';
  const data = collectData();
  try {
    const res = await fetch(API_BASE + '/resume/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();

    if (j.error) {
      el('result').textContent = 'Error: ' + JSON.stringify(j);
      return;
    }

    el('result').textContent = 'Template: ' + (j.template || 'classic') + ' — Preview opened in a new tab.';

    // --- Updated response handling ---
    if (j.url) {
      // Open the rendered HTML resume via backend redirect
      window.open('/api/resume/' + j.id, '_blank');
    } else if (j.html) {
      // fallback if backend still returns HTML directly
      const w = window.open('', '_blank');
      w.document.open();
      w.document.write(j.html);
      w.document.close();
    }

    // If backend returned a PDF signed URL, show a “Download PDF” link
    if (j.pdfUrl) {
      const resultDiv = el('result') || document.body;
      // remove previous link if exists
      const old = document.getElementById('resume-pdf-link');
      if (old) old.remove();

      const pdfLink = document.createElement('a');
      pdfLink.id = 'resume-pdf-link';
      pdfLink.href = j.pdfUrl;
      pdfLink.textContent = 'Download PDF';
      pdfLink.target = '_blank';
      pdfLink.style.display = 'inline-block';
      pdfLink.style.marginTop = '10px';
      pdfLink.style.fontWeight = '600';
      pdfLink.style.color = '#0b76ff';
      resultDiv.appendChild(document.createElement('br'));
      resultDiv.appendChild(pdfLink);
    }

    if (save && j.id) {
      el('result').textContent += ' Saved on server (id: ' + j.id + ')';
    }

  } catch (err) {
    console.error(err);
    el('result').textContent = 'Failed to generate resume.';
  }
}

// Wire buttons after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const gen = el('generate-resume');
  if (gen) gen.addEventListener('click', () => generateResume(false));

  const genSave = el('generate-and-save');
  if (genSave) genSave.addEventListener('click', () => generateResume(true));
});
