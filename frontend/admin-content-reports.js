import { getUser } from './auth.js';

const state = document.getElementById('access-state');
const panel = document.getElementById('admin-panel');
const list = document.getElementById('report-list');
const queueStatus = document.getElementById('queue-status');
const count = document.getElementById('report-count');
const filter = document.getElementById('status-filter');

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function setStatus(message, error = false) {
  queueStatus.textContent = message;
  queueStatus.classList.toggle('error', error);
}
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
function showAccess(title, message) {
  state.replaceChildren(create('h2', '', title), create('p', '', message));
}
function render(reports) {
  list.replaceChildren();
  count.textContent = reports.length + (reports.length === 1 ? ' report' : ' reports');
  if (!reports.length) {
    list.append(create('p', 'empty-queue', 'No reports in this view.'));
    return;
  }
  for (const report of reports) {
    const card = create('article', 'request-card');
    const header = create('div', 'request-header');
    const identity = document.createElement('div');
    identity.append(create('h3', '', report.target_type === 'reel' ? 'Reel report' : 'Profile report'));
    identity.append(create('p', 'request-meta', 'Reported by ' + report.reporter_name));
    header.append(identity, create('span', 'request-status', report.status));
    card.append(header);
    card.append(create('p', 'request-company', 'Reason: ' + report.reason.replaceAll('_', ' ')));
    if (report.target_type === 'reel') {
      card.append(create('p', 'request-meta', 'Post: ' + (report.target_title || 'Removed or unavailable') + ' · ID ' + (report.target_reel_id || 'unavailable')));
    } else {
      card.append(create('p', 'request-meta', 'Member: ' + (report.target_name || 'Removed account') + ' · ID ' + (report.target_user_id || 'unavailable')));
    }
    if (report.details) card.append(create('p', 'request-message', report.details));
    card.append(create('p', 'request-date', 'Submitted ' + new Date(report.created_at).toLocaleString()));
    if (report.status === 'pending' || report.status === 'reviewed') {
      const actions = create('div', 'request-actions');
      const buttons = [];
      if (report.status === 'pending') {
        const review = create('button', 'button button-primary decision-button', 'Mark reviewed');
        review.type = 'button';
        review.addEventListener('click', () => decide(report.id, 'reviewed', buttons));
        buttons.push(review);
        actions.append(review);
      }
      const dismiss = create(
        'button',
        'button button-outline decision-button',
        report.status === 'reviewed' ? 'Dismiss report' : 'Dismiss'
      );
      dismiss.type = 'button';
      dismiss.addEventListener('click', () => decide(report.id, 'dismissed', buttons));
      buttons.push(dismiss);
      actions.append(dismiss);
      card.append(actions);
    }
    list.append(card);
  }
}
async function loadQueue() {
  list.replaceChildren();
  setStatus('Loading reports…');
  try {
    const result = await api('/api/admin/content-reports?status=' + encodeURIComponent(filter.value));
    render(Array.isArray(result.reports) ? result.reports : []);
    setStatus('');
  } catch (error) {
    setStatus(error.status === 401 ? 'Your session expired. Sign in again.' : 'We could not load the report queue.', true);
  }
}
async function decide(id, decision, buttons) {
  buttons.forEach(button => { button.disabled = true; });
  setStatus(decision === 'reviewed' ? 'Saving review…' : 'Dismissing report…');
  try {
    await api('/api/admin/content-reports/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ decision })
    });
    await loadQueue();
  } catch (error) {
    setStatus(error.message || 'Could not update this report.', true);
    buttons.forEach(button => { button.disabled = false; });
  }
}
async function initialize() {
  if (!localStorage.getItem('token')) {
    showAccess('Sign in to continue', 'This page is limited to authorized administrators.');
    return;
  }
  try {
    await getUser();
    await api('/api/admin/content-reports?status=pending');
    state.hidden = true;
    panel.hidden = false;
    await loadQueue();
  } catch (error) {
    showAccess(
      error.status === 401 ? 'Your session has expired' : 'Administrator access required',
      error.status === 401 ? 'Sign in again.' : 'This account does not have the server-managed admin role.'
    );
  }
}
filter.addEventListener('change', loadQueue);
initialize();
