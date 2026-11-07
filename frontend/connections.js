import { getUser } from './auth.js';

const statusEl = document.getElementById('connections-status');
const discoverableEl = document.getElementById('discoverable');
const token = localStorage.getItem('token');
const headers = token ? { Authorization: 'Bearer ' + token } : {};

async function api(path, options = {}) {
  const response = await fetch('/api/connections' + path, {
    ...options,
    headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = error ? 'error' : '';
}

function initials(name) {
  return String(name || 'AIConnectPro member').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A';
}

async function loadConnectionPhoto(avatar) {
  if (avatar.dataset.photoRequested) return;
  avatar.dataset.photoRequested = 'true';
  try {
    const response = await fetch('/api/profile/' + encodeURIComponent(avatar.dataset.userId), { headers });
    const profile = await response.json().catch(() => ({}));
    if (!response.ok || !profile.avatar_url) return;
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => avatar.replaceChildren(image), { once: true });
    image.src = profile.avatar_url;
  } catch {
    // Keep the monogram when a profile photo is unavailable.
  }
}

const avatarObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        avatarObserver.unobserve(entry.target);
        loadConnectionPhoto(entry.target);
      }
    }), { rootMargin: '180px' })
  : null;

function renderPersonList(containerId, rows, kind) {
  const list = document.getElementById(containerId);
  list.replaceChildren();
  if (!rows.length) {
    list.append(make('p', 'connection-empty', kind === 'incoming' ? 'No pending requests.' : kind === 'connected' ? 'Your network is just getting started.' : kind === 'outgoing' ? 'No requests waiting for a reply.' : 'No discoverable members found.'));
    return;
  }
  for (const row of rows) {
    const person = row.user || row;
    const item = make('article', 'connection-row');
    const displayName = person.full_name || 'AIConnectPro member';
    const copy = make('div', 'connection-person');
    const avatar = make('span', 'connection-person-avatar', initials(displayName));
    avatar.dataset.userId = person.id;
    const personCopy = make('div', 'connection-person-copy');
    personCopy.append(make('strong', '', displayName));
    if (person.company_name) personCopy.append(make('span', '', person.company_name));
    copy.append(avatar, personCopy);
    item.append(copy);
    if (avatarObserver) avatarObserver.observe(avatar);
    const actions = make('div', 'connection-actions');
    if (kind === 'discover' || kind === 'connected') {
      const profileLink = make('a', 'connection-message-link', 'View profile');
      profileLink.href = 'member-profile.html?user=' + encodeURIComponent(person.id);
      actions.append(profileLink);
    }

    if (kind === 'discover') {
      actions.append(actionButton('Connect', 'request', person.id, 'accept-action'));
    } else if (kind === 'incoming') {
      actions.append(actionButton('Accept', 'accept', row.id, 'accept-action'));
      actions.append(actionButton('Decline', 'decline', row.id));
    } else if (kind === 'outgoing') {
      actions.append(actionButton('Withdraw', 'withdraw', row.id));
    } else {
      const messageLink = make('a', 'connection-message-link', 'Message');
      messageLink.href = 'messages.html?user=' + encodeURIComponent(person.id);
      actions.append(messageLink);
      actions.append(actionButton('Remove connection', 'disconnect', row.id));
    }
    actions.append(actionButton('Report', 'report', person.id));
    item.append(actions);
    list.append(item);
  }
}

function actionButton(label, action, id, className = '') {
  const button = make('button', className, label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

async function loadDiscovery(term = '') {
  const list = document.getElementById('discover-list');
  list.replaceChildren(make('p', 'connection-empty', 'Searching…'));
  try {
    const result = await api('/discover?q=' + encodeURIComponent(term));
    renderPersonList('discover-list', result.people || [], 'discover');
  } catch (error) {
    list.replaceChildren(make('p', 'connection-empty', error.message || 'Could not load members.'));
  }
}

async function loadConnections() {
  try {
    const result = await api('/me');
    discoverableEl.checked = result.discoverable;
    discoverableEl.disabled = false;
    renderPersonList('incoming-list', result.incoming || [], 'incoming');
    renderPersonList('connection-list', result.connections || [], 'connected');
    renderPersonList('outgoing-list', result.outgoing || [], 'outgoing');
    setStatus('Your privacy setting and network are up to date.');
    await loadDiscovery(document.getElementById('member-search').value.trim());
  } catch (error) {
    setStatus(error.status === 401 ? 'Sign in again to manage connections.' : error.message || 'Could not load your network.', true);
    if (error.status === 401) window.location.replace('login.html');
  }
}

document.getElementById('discover-form').addEventListener('submit', event => {
  event.preventDefault();
  loadDiscovery(document.getElementById('member-search').value.trim());
});

discoverableEl.addEventListener('change', async () => {
  const previousValue = !discoverableEl.checked;
  discoverableEl.disabled = true;
  try {
    const result = await api('/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ discoverable: discoverableEl.checked })
    });
    discoverableEl.checked = result.discoverable;
    setStatus(result.discoverable ? 'Members can now find you by name.' : 'Your profile is hidden from member discovery.');
    await loadDiscovery(document.getElementById('member-search').value.trim());
  } catch (error) {
    discoverableEl.checked = previousValue;
    setStatus(error.message || 'Could not update your privacy setting.', true);
  } finally { discoverableEl.disabled = false; }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'report') {
    document.getElementById('profile-report-target').value = button.dataset.id;
    document.getElementById('profile-report-details').value = '';
    document.getElementById('profile-report-status').textContent = '';
    document.getElementById('profile-report-dialog').showModal();
    return;
  }
  button.disabled = true;
  try {
    if (action === 'request') {
      await api('/requests/' + encodeURIComponent(button.dataset.id), { method: 'POST' });
      setStatus('Connection request sent.');
    } else if (action === 'disconnect') {
      await api('/' + encodeURIComponent(button.dataset.id), { method: 'DELETE' });
      setStatus('Connection removed.');
    } else {
      await api('/requests/' + encodeURIComponent(button.dataset.id), {
        method: 'PATCH',
        body: JSON.stringify({ action })
      });
      setStatus(action === 'accept' ? 'Connection accepted.' : action === 'decline' ? 'Request declined.' : 'Request withdrawn.');
    }
    await loadConnections();
  } catch (error) {
    setStatus(error.message || 'Could not update this connection.', true);
    button.disabled = false;
  }
});

document.getElementById('profile-report-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = document.getElementById('profile-report-submit');
  submit.disabled = true;
  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: 'member',
        target_id: document.getElementById('profile-report-target').value,
        reason: document.getElementById('profile-report-reason').value,
        details: document.getElementById('profile-report-details').value.trim()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not send this report.');
    document.getElementById('profile-report-dialog').close();
    setStatus('Thanks. Your report was sent to the administrators for review.');
  } catch (error) {
    const status = document.getElementById('profile-report-status');
    status.textContent = error.message || 'Could not send this report.';
    status.dataset.state = 'error';
  } finally {
    submit.disabled = false;
  }
});
document.getElementById('cancel-profile-report').addEventListener('click', () => {
  document.getElementById('profile-report-dialog').close();
});

async function initialize() {
  if (!token) {
    window.location.replace('login.html');
    return;
  }
  try {
    await getUser();
    await loadConnections();
  } catch {
    window.location.replace('login.html');
  }
}

initialize();
