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
    const copy = make('div', 'connection-person');
    copy.append(make('strong', '', person.full_name || 'AIConnectPro member'));
    if (person.company_name) copy.append(make('span', '', person.company_name));
    item.append(copy);
    const actions = make('div', 'connection-actions');

    if (kind === 'discover') {
      actions.append(actionButton('Connect', 'request', person.id, 'accept-action'));
    } else if (kind === 'incoming') {
      actions.append(actionButton('Accept', 'accept', row.id, 'accept-action'));
      actions.append(actionButton('Decline', 'decline', row.id));
    } else if (kind === 'outgoing') {
      actions.append(actionButton('Withdraw', 'withdraw', row.id));
    } else {
      actions.append(actionButton('Remove connection', 'disconnect', row.id));
    }
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
  button.disabled = true;
  const action = button.dataset.action;
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
