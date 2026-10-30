import { getUser } from './auth.js';

const accessState = document.getElementById('access-state');
const inbox = document.getElementById('inbox');
const jobSelect = document.getElementById('job-select');
const list = document.getElementById('application-list');
const statusEl = document.getElementById('inbox-status');
const summary = document.getElementById('inbox-summary');

function showAccess(title, message, linkText, href) {
  accessState.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = message;
  accessState.append(heading, description);
  if (linkText && href) {
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = href;
    link.textContent = linkText;
    accessState.append(link);
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function request(path) {
  const token = localStorage.getItem('token');
  const response = await fetch(path, { headers: { Authorization: 'Bearer ' + token } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.details || body.error || 'We could not load this information.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

function renderApplications(applications) {
  list.replaceChildren();
  if (!applications.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-inbox';
    empty.textContent = 'No applications for this opportunity yet.';
    list.append(empty);
    return;
  }

  for (const application of applications) {
    const card = document.createElement('article');
    card.className = 'application-card';
    const top = document.createElement('div');
    top.className = 'application-card-top';
    const identity = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = application.full_name || 'Applicant';
    const date = document.createElement('p');
    date.className = 'application-date';
    date.textContent = 'Applied ' + formatDate(application.created_at);
    identity.append(name, date);
    const badge = document.createElement('span');
    badge.className = 'application-status';
    badge.textContent = application.status || 'applied';
    top.append(identity, badge);
    card.append(top);

    if (application.message) {
      const message = document.createElement('p');
      message.className = 'application-message';
      message.textContent = application.message;
      card.append(message);
    }

    if (application.resume) {
      const resume = document.createElement('p');
      resume.className = 'resume-meta';
      resume.textContent = 'Resume attached · ' + (application.resume.template || 'classic') + ' template';
      card.append(resume);
    } else {
      const resume = document.createElement('p');
      resume.className = 'resume-meta';
      resume.textContent = 'No saved resume was attached.';
      card.append(resume);
    }
    list.append(card);
  }
}

async function loadApplications() {
  const jobId = jobSelect.value;
  list.replaceChildren();
  if (!jobId) {
    summary.textContent = 'Choose one of your opportunities to review its applicants.';
    setStatus('');
    return;
  }
  const option = jobSelect.selectedOptions[0];
  summary.textContent = 'Applicants for ' + option.textContent;
  setStatus('Loading applications…');
  try {
    const result = await request('/api/jobs/posted/' + encodeURIComponent(jobId) + '/applications');
    renderApplications(Array.isArray(result.applications) ? result.applications : []);
    setStatus('');
  } catch (error) {
    setStatus(error.status === 401
      ? 'Your session expired. Please log in again.'
      : 'We couldn’t load applications. Please try again.', true);
  }
}

async function initialize() {
  if (!localStorage.getItem('token')) {
    showAccess('Sign in to open your applicant inbox', 'Log in with your employer account to review applications.', 'Log in', 'login.html');
    return;
  }

  try {
    await getUser();
    const memberships = await request('/api/organizations/mine');
    const verifiedOrganizations = (memberships.organizations || []).filter(item => item.verification_status === 'verified');
    if (!verifiedOrganizations.length) {
      showAccess('A verified organization is required', 'Applicant information is available to active members of verified organizations.', 'Register an organization', 'company-access.html');
      return;
    }

    const jobs = await request('/api/jobs/posted');
    const rows = Array.isArray(jobs) ? jobs : [];
    for (const job of rows) {
      const option = document.createElement('option');
      option.value = job.id;
      option.textContent = job.title || 'Untitled opportunity';
      jobSelect.append(option);
    }
    accessState.hidden = true;
    inbox.hidden = false;
    if (!rows.length) {
      summary.textContent = 'You haven’t posted an opportunity yet.';
      setStatus('Post an opportunity to start receiving applications.');
    } else {
      await loadApplications();
    }
  } catch (error) {
    showAccess('We couldn’t open your applicant inbox', error.status === 401
      ? 'Your session expired. Log in again to continue.'
      : 'Please try again in a moment.', error.status === 401 ? 'Log in' : 'Return to Jobs', error.status === 401 ? 'login.html' : 'jobs.html');
  }
}

jobSelect.addEventListener('change', loadApplications);
initialize();
