import { getUser } from './auth.js';

const state = document.getElementById('access-state');
const panel = document.getElementById('admin-panel');
const list = document.getElementById('request-list');
const queueStatus = document.getElementById('queue-status');
const requestCount = document.getElementById('request-count');
const filter = document.getElementById('status-filter');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer ' + localStorage.getItem('token'),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function showAccess(title, message, linkText, href) {
  state.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = message;
  state.append(heading, description);
  if (linkText && href) {
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = href;
    link.textContent = linkText;
    state.append(link);
  }
}

function setQueueStatus(message, error = false) {
  queueStatus.textContent = message;
  queueStatus.classList.toggle('error', error);
}

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderRequests(requests) {
  list.replaceChildren();
  requestCount.textContent = requests.length + (requests.length === 1 ? ' request' : ' requests');
  if (!requests.length) {
    list.append(create('p', 'empty-queue', 'No requests in this view.'));
    return;
  }

  for (const request of requests) {
    const card = create('article', 'request-card');
    const header = create('div', 'request-header');
    const identity = document.createElement('div');
    identity.append(create('h3', '', request.requester_name || 'AIConnectPro user'));
    identity.append(create('p', 'request-meta', request.requester_email || 'No email available'));
    header.append(identity, create('span', 'request-status', request.status));
    card.append(header);
    card.append(create('h4', 'request-company', request.company_name));
    if (request.website) {
      const website = create('a', 'request-meta', request.website);
      website.href = request.website;
      website.target = '_blank';
      website.rel = 'noopener noreferrer';
      card.append(website);
    }
    card.append(create('p', 'request-date', 'Submitted ' + new Date(request.created_at).toLocaleString()));
    if (request.message) card.append(create('p', 'request-message', request.message));

    if (request.status === 'pending') {
      const actions = create('div', 'request-actions');
      const approve = create('button', 'button button-primary decision-button', 'Approve employer');
      const reject = create('button', 'button button-outline decision-button', 'Decline');
      approve.type = reject.type = 'button';
      approve.addEventListener('click', () => decide(request.id, 'approved', approve, reject));
      reject.addEventListener('click', () => decide(request.id, 'rejected', approve, reject));
      actions.append(approve, reject);
      card.append(actions);
    }
    list.append(card);
  }
}

async function loadQueue() {
  list.replaceChildren();
  setQueueStatus('Loading requests…');
  try {
    const result = await api('/api/admin/company-access-requests?status=' + encodeURIComponent(filter.value));
    const requests = Array.isArray(result.requests) ? result.requests : [];
    renderRequests(requests);
    setQueueStatus('');
  } catch (error) {
    setQueueStatus(error.status === 401 ? 'Your session expired. Sign in again.' : 'We could not load the request queue.', true);
  }
}

async function decide(id, decision, approve, reject) {
  approve.disabled = reject.disabled = true;
  setQueueStatus(decision === 'approved' ? 'Approving company access…' : 'Declining request…');
  try {
    await api('/api/admin/company-access-requests/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ decision })
    });
    setQueueStatus(decision === 'approved'
      ? 'Company access approved. The employer must sign in again to refresh their access.'
      : 'Request declined.');
    await loadQueue();
  } catch (error) {
    setQueueStatus(error.message || 'We could not update this request.', true);
    approve.disabled = reject.disabled = false;
  }
}

async function initialize() {
  if (!localStorage.getItem('token')) {
    showAccess('Sign in to continue', 'This page is limited to authorized administrators.', 'Log in', 'login.html');
    return;
  }

  try {
    await getUser();
    await api('/api/admin/company-access-requests?status=pending');
    state.hidden = true;
    panel.hidden = false;
    await loadQueue();
  } catch (error) {
    showAccess(
      error.status === 401 ? 'Your session has expired' : 'Administrator access required',
      error.status === 401 ? 'Sign in again to continue.' : 'This account does not have the server-managed admin role.',
      error.status === 401 ? 'Log in' : 'Return to Jobs',
      error.status === 401 ? 'login.html' : 'jobs.html'
    );
  }
}

filter.addEventListener('change', loadQueue);
initialize();
