import { getUser } from './auth.js';

const state = document.getElementById('access-state');
const form = document.getElementById('access-form');
const statusEl = document.getElementById('form-status');
const submitButton = document.getElementById('submit-request');

function showState(title, message, linkText, href) {
  state.hidden = false;
  state.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = message;
  state.append(heading, copy);
  if (linkText && href) {
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = href;
    link.textContent = linkText;
    state.append(link);
  }
}

async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer ' + token,
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.details || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function renderCurrentRequest(request) {
  if (!request) {
    state.hidden = true;
    form.hidden = false;
    return;
  }
  if (request.status === 'pending') {
    showState('Your request is being reviewed', 'We received the request for ' + request.company_name + '. We’ll show an update here after an administrator reviews it.', 'Browse opportunities', 'jobs.html');
    return;
  }
  if (request.status === 'approved') {
    showState('Company access is approved', 'Sign out and back in to refresh your access, then return to Post an Opportunity.', 'Post an opportunity', 'post-job.html');
    return;
  }
  showState('Your previous request was not approved', 'You can update your organization details and send a new request for review.', null, null);
  form.hidden = false;
}

async function initialize() {
  if (!localStorage.getItem('token')) {
    showState('Sign in to request company access', 'Use your AIConnectPro account so we can connect the request to the right profile.', 'Log in', 'login.html');
    return;
  }

  try {
    await getUser();
    const profile = await api('/api/profile/me');
    if (profile.role === 'company') {
      showState('Company access is already enabled', 'This account can publish opportunities.', 'Post an opportunity', 'post-job.html');
      return;
    }
    const result = await api('/api/company-access-requests/me');
    renderCurrentRequest(result.request || null);
  } catch (error) {
    showState(error.status === 401 ? 'Your session has expired' : 'We could not load your request', error.status === 401 ? 'Sign in again to continue.' : 'Please try again in a moment.', error.status === 401 ? 'Log in' : 'Return to Jobs', error.status === 401 ? 'login.html' : 'jobs.html');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  statusEl.textContent = 'Sending your request…';
  statusEl.classList.remove('error');
  try {
    const result = await api('/api/company-access-requests', {
      method: 'POST',
      body: JSON.stringify({
        company_name: document.getElementById('company-name').value.trim(),
        website: document.getElementById('website').value.trim() || null,
        message: document.getElementById('message').value.trim() || null
      })
    });
    form.hidden = true;
    renderCurrentRequest(result.request);
  } catch (error) {
    statusEl.textContent = error.status === 409
      ? 'A request is already pending or company access is already enabled for this account.'
      : error.message || 'We could not send your request.';
    statusEl.classList.add('error');
  } finally {
    submitButton.disabled = false;
  }
});

initialize();
