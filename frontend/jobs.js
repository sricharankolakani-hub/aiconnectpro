import { getUser, signOut } from './auth.js';

const API = '/api';
let token = localStorage.getItem('token');
const guestActions = document.getElementById('guest-actions');
const userActions = document.getElementById('user-actions');
const logoutButton = document.getElementById('logout');

const statusEl = document.getElementById('status');
const listEl = document.getElementById('job-list');
const detailEl = document.getElementById('job-detail');
const countEl = document.getElementById('result-count');
const loadMoreButton = document.getElementById('load-more');
const filtersForm = document.getElementById('filters');
let jobs = [];
let offset = 0;
const pageSize = 20;
let hasMore = false;
let selectedJob = null;

function syncAuthNavigation() {
  guestActions.hidden = Boolean(token);
  userActions.hidden = !token;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer ' + token,
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.details || body.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function createText(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text || '';
  return element;
}

function renderJobs() {
  listEl.replaceChildren();
  const keyword = document.getElementById('search').value.trim().toLocaleLowerCase();
  const visibleJobs = jobs.filter(job => {
    const haystack = [job.title, job.description, job.location, job.type].filter(Boolean).join(' ').toLocaleLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  countEl.textContent = visibleJobs.length + (hasMore ? '+' : '') + ' shown';

  if (!visibleJobs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.appendChild(createText('span', 'empty-state-icon', jobs.length ? '⌕' : '↗'));
    empty.appendChild(createText('h3', '', jobs.length ? 'No matches for this search' : 'No listings published yet'));
    empty.appendChild(createText('p', '', jobs.length
      ? 'Try another keyword or adjust the type and location filters.'
      : 'New opportunities will appear here once companies publish listings.'));
    if (jobs.length) {
      const reset = createText('button', 'btn', 'Clear keyword search');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        document.getElementById('search').value = '';
        renderJobs();
      });
      empty.appendChild(reset);
    }
    listEl.appendChild(empty);
    return;
  }

  for (const job of visibleJobs) {
    const card = document.createElement('article');
    card.className = 'job-card';
    card.appendChild(createText('h3', '', job.title || 'Untitled opportunity'));

    const meta = document.createElement('div');
    meta.className = 'job-meta';
    if (job.type) meta.appendChild(createText('span', '', job.type));
    if (job.location) meta.appendChild(createText('span', '', job.location));
    const date = formatDate(job.created_at);
    if (date) meta.appendChild(createText('span', '', 'Posted ' + date));
    card.appendChild(meta);

    if (job.description) {
      const excerpt = job.description.length > 220 ? job.description.slice(0, 220).trimEnd() + '…' : job.description;
      card.appendChild(createText('p', 'job-excerpt', excerpt));
    }

    const actions = document.createElement('div');
    actions.className = 'job-actions';
    const detailsButton = createText('button', 'btn', 'View details');
    detailsButton.type = 'button';
    detailsButton.addEventListener('click', () => showDetails(job));
    actions.appendChild(detailsButton);
    card.appendChild(actions);
    listEl.appendChild(card);
  }
}

async function loadJobs({ reset = false } = {}) {
  if (!token) {
    setStatus('');
    countEl.textContent = '';
    listEl.replaceChildren();
    const prompt = document.createElement('div');
    prompt.className = 'empty-state auth-prompt';
    prompt.appendChild(createText('span', 'empty-state-icon', '◎'));
    prompt.appendChild(createText('h3', '', 'Sign in to explore opportunities'));
    prompt.appendChild(createText('p', '', 'Log in to search public listings and apply with a resume saved to your account.'));
    const link = createText('a', 'button button-primary', 'Log in');
    link.href = 'login.html';
    prompt.appendChild(link);
    listEl.appendChild(prompt);
    loadMoreButton.hidden = true;
    return;
  }

  if (reset) {
    offset = 0;
    jobs = [];
    selectedJob = null;
    hasMore = false;
    detailEl.replaceChildren(createText('p', 'muted', 'Select a listing to see its details.'));
  }

  const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
  const type = document.getElementById('type').value;
  const location = document.getElementById('location').value.trim();
  if (type) params.set('type', type);
  if (location) params.set('location', location);

  setStatus('Loading opportunities…');
  loadMoreButton.disabled = true;
  try {
    const result = await api('/jobs?' + params.toString());
    const page = Array.isArray(result.jobs) ? result.jobs : [];
    jobs = reset ? page : jobs.concat(page);
    offset += page.length;
    hasMore = page.length === pageSize;
    renderJobs();
    loadMoreButton.hidden = !hasMore;
    setStatus(page.length || jobs.length ? '' : 'There are no public job listings yet.');
  } catch (error) {
    hasMore = false;
    loadMoreButton.hidden = true;
    setStatus(error.status === 401 ? 'Your session expired. Please log in again.' : error.message, true);
  } finally {
    loadMoreButton.disabled = false;
  }
}

async function showDetails(job) {
  selectedJob = job;
  detailEl.replaceChildren(createText('p', 'muted', 'Loading details…'));
  try {
    const result = await api('/jobs/' + encodeURIComponent(job.id));
    const listing = result.job || job;
    selectedJob = listing;
    detailEl.replaceChildren();
    detailEl.appendChild(createText('h2', '', listing.title || 'Opportunity details'));
    const meta = [listing.type, listing.location, formatDate(listing.created_at) && ('Posted ' + formatDate(listing.created_at))]
      .filter(Boolean).join(' · ');
    if (meta) detailEl.appendChild(createText('p', 'job-meta', meta));
    detailEl.appendChild(createText('div', 'job-detail-body', listing.description || 'No description was provided.'));

    const applyButton = createText('button', 'btn btn--primary', 'Apply');
    applyButton.type = 'button';
    applyButton.addEventListener('click', () => showApplicationForm(listing));
    detailEl.appendChild(applyButton);
  } catch (error) {
    detailEl.replaceChildren(createText('p', 'job-status error', error.message));
  }
}

async function showApplicationForm(job) {
  selectedJob = job;
  try {
    const resumes = await api('/resume?mine=true');
    detailEl.querySelector('.application-form')?.remove();
    const form = document.createElement('form');
    form.className = 'application-form';
    form.innerHTML = '<h3>Apply for this opportunity</h3><p class="application-note">Your application and selected saved resume will be sent to the job poster.</p>';

    const resumeLabel = createText('label', '', 'Choose a saved resume');
    const resumeSelect = document.createElement('select');
    resumeSelect.name = 'resume_id';
    resumeSelect.required = true;

    if (!Array.isArray(resumes) || resumes.length === 0) {
      form.append(createText('p', 'application-note', 'You need a saved resume before applying. Create one in the Resume Builder.'));
      const resumeLink = createText('a', '', 'Open Resume Builder');
      resumeLink.href = 'resume.html';
      form.appendChild(resumeLink);
    } else {
      for (const resume of resumes) {
        const option = document.createElement('option');
        option.value = resume.id;
        const date = formatDate(resume.created_at);
        option.textContent = (resume.template || 'classic') + (date ? ' · ' + date : '');
        resumeSelect.appendChild(option);
      }
      resumeLabel.appendChild(resumeSelect);
      form.appendChild(resumeLabel);

      const messageLabel = createText('label', '', 'Message to the employer (optional)');
      const messageInput = document.createElement('textarea');
      messageInput.name = 'message';
      messageInput.rows = 4;
      messageInput.maxLength = 2000;
      messageInput.placeholder = 'Add a short note about your application';
      messageLabel.appendChild(messageInput);
      form.appendChild(messageLabel);

      const submit = createText('button', 'btn btn--primary', 'Submit application');
      submit.type = 'submit';
      form.appendChild(submit);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        submit.disabled = true;
        setStatus('Submitting your application…');
        try {
          await api('/jobs/' + encodeURIComponent(job.id) + '/apply', {
            method: 'POST',
            body: JSON.stringify({
              resume_id: resumeSelect.value,
              message: messageInput.value.trim() || null
            })
          });
          form.replaceChildren(createText('p', 'application-note', 'Application submitted. You can see it in My Profile.'));
          setStatus('Your application was submitted.');
        } catch (error) {
          setStatus(error.status === 409 ? 'You already applied to this opportunity.' : error.message, true);
          submit.disabled = false;
        }
      });
    }

    detailEl.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    setStatus(error.status === 401 ? 'Your session expired. Please log in again.' : error.message, true);
  }
}

filtersForm.addEventListener('submit', event => {
  event.preventDefault();
  loadJobs({ reset: true });
});
document.getElementById('search').addEventListener('input', renderJobs);
loadMoreButton.addEventListener('click', () => loadJobs());

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await signOut();
  } finally {
    window.location.assign('index.html');
  }
});

async function initializePage() {
  try {
    await getUser();
  } catch {
    // The page will show its sign-in prompt when no valid session exists.
  }
  token = localStorage.getItem('token');
  syncAuthNavigation();
  loadJobs({ reset: true });
}

initializePage();
