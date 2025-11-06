// backend/services/resumeService.js
const education = Array.isArray(data.education) ? data.education : [];
const skills = Array.isArray(data.skills) ? data.skills : [];


const css = cssForTemplate(t);


const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Resume — ${name}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
${css}
@media print { .no-print{ display:none } }
</style>
</head>
<body>
<header>
<div>
<h1>${name}</h1>
<div class="muted">${title}</div>
</div>
<div class="contact">
<div>${email}</div>
<div>${phone}</div>
<div>${location}</div>
</div>
</header>


<section class="section">
<h2>Professional Summary</h2>
<div>${safeText(summary).replace(/\n/g,'<br/>')}</div>
</section>


<section class="section">
<h2>Experience</h2>
${experience.map(exp => `
<div class="job">
<div style="font-weight:600">${safeText(exp.role || '')} — ${safeText(exp.company || '')}</div>
<div class="muted">${safeText(exp.from || '')} — ${safeText(exp.to || '')}</div>
<div>${safeText(exp.desc || '').replace(/\n/g,'<br/>')}</div>
</div>
`).join('') || '<div class="muted">No experience listed</div>'}
</section>


<section class="section">
<h2>Education</h2>
${education.map(ed => `
<div>
<div style="font-weight:600">${safeText(ed.degree || '')} — ${safeText(ed.school || '')}</div>
<div class="muted">${safeText(ed.year || '')}</div>
</div>
`).join('') || '<div class="muted">No education listed</div>'}
</section>


<section class="section">
<h2>Skills</h2>
<ul class="skills">
${skills.map(s => `<li>${safeText(s)}</li>`).join('') || '<li class="muted">No skills listed</li>'}
</ul>
</section>


<div class="no-print" style="margin-top:18px;">
<button onclick="window.print()">Print / Save as PDF</button>
</div>
</body>
</html>
`;
return html;
}


module.exports = { generateHtml };
