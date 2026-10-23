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
  const verification = request.organization?.verification_status;
  if (request.status === 'pending' || verification === 'pending' || verification === 'manual_review') {
    showState(
      'Organization submitted for manual review',
      'We received the details for ' + request.company_name + '. GST checks are not automated yet, so an administrator must review the organization before employer tools are enabled.',
      'Browse opportunities', 'jobs.html'
    );
    return;
  }
  if (request.status === 'approved' && verification === 'verified') {
    showState('Organization verified', 'Employer access is connected to your existing login.', 'Post an opportunity', 'post-job.html');
    return;
  }
  showState('The organization needs another review', 'Your organization was not approved. Check the details and submit an updated request.', null, null);
  form.hidden = false;
}

async function initialize() {
  if (!localStorage.getItem('token')) {
    showState('Sign in to register an organization', 'Use your AIConnectPro account. Your personal profile and organization will remain separate.', 'Log in', 'login.html');
    return;
  }

  try {
    await getUser();
    const memberships = await api('/api/organizations/mine');
    const verifiedOrganizations = (memberships.organizations || []).filter(item => item.verification_status === 'verified');
    if (verifiedOrganizations.length) {
      showState('Employer access is ready', 'Your personal profile remains separate from your organization membership.', 'Post an opportunity', 'post-job.html');
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
  statusEl.textContent = 'Submitting organization details…';
  statusEl.classList.remove('error');
  try {
    const result = await api('/api/company-access-requests', {
      method: 'POST',
      body: JSON.stringify({
        company_name: document.getElementById('company-name').value.trim(),
        gstin: document.getElementById('gstin').value.trim().toUpperCase() || null,
        registered_address: document.getElementById('registered-address').value.trim() || null,
        operating_location: document.getElementById('operating-location').value.trim(),
        website: document.getElementById('website').value.trim() || null,
        message: document.getElementById('message').value.trim() || null
      })
    });
    form.hidden = true;
    renderCurrentRequest({
      ...result.request,
      organization: { verification_status: result.organization?.verification_status }
    });
  } catch (error) {
    statusEl.textContent = error.status === 409
      ? 'A review request is already pending, or this GSTIN is already registered.'
      : error.message || 'We could not submit the organization.';
    statusEl.classList.add('error');
  } finally {
    submitButton.disabled = false;
  }
});

initialize();
