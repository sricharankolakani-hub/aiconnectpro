import { getUser } from './auth.js';

const accessState = document.getElementById('access-state');
const form = document.getElementById('job-form');
const statusEl = document.getElementById('form-status');
const submitButton = document.getElementById('submit-job');

function showAccess(title, message, linkText, href) {
  accessState.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'access-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '◎';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = message;
  accessState.append(icon, heading, description);
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

async function initialize() {
  const token = localStorage.getItem('token');
  if (!token) {
    showAccess('Sign in to post an opportunity', 'Log in to check whether this account can publish company listings.', 'Log in', 'login.html');
    return;
  }

  try {
    await getUser();
    const response = await fetch('/api/profile/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
    const profile = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showAccess('Your session has expired', 'Log in again to continue.', 'Log in', 'login.html');
      return;
    }
    if (!response.ok) throw new Error(profile.error || 'We could not check this account right now.');

    if (profile.role !== 'company') {
      showAccess(
        'Company access is required',
        'Posting is available to verified company accounts. An administrator must approve company access before this account can publish.',
        'Request company access', 'company-access.html'
      );
      return;
    }

    accessState.hidden = true;
    form.hidden = false;
  } catch (error) {
    showAccess('We could not check employer access', error.message || 'Please try again in a moment.', 'Return to Jobs', 'jobs.html');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const token = localStorage.getItem('token');
  if (!token) {
    showAccess('Your session has expired', 'Log in again to continue.', 'Log in', 'login.html');
    form.hidden = true;
    return;
  }

  submitButton.disabled = true;
  setStatus('Publishing your opportunity…');
  const payload = {
    title: document.getElementById('title').value.trim(),
    type: document.getElementById('type').value,
    location: document.getElementById('location').value.trim() || null,
    description: document.getElementById('description').value.trim() || null,
    is_private: document.getElementById('is-private').checked
  };

  try {
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) throw new Error('Your session has expired. Please log in again.');
    if (response.status === 403) throw new Error('Company access is required. An administrator must approve this account before it can publish.');
    if (!response.ok) throw new Error(result.details || result.error || 'The opportunity could not be published.');

    form.reset();
    setStatus('Your opportunity is live. You can review its applications in your employer inbox.');
    const link = document.createElement('a');
    link.className = 'published-link';
    link.href = 'company-applications.html';
    link.textContent = 'Open applicant inbox';
    statusEl.append(document.createElement('br'), link);
  } catch (error) {
    setStatus(error.message || 'The opportunity could not be published.', true);
  } finally {
    submitButton.disabled = false;
  }
});

initialize();
