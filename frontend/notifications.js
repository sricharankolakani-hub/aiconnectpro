const token = localStorage.getItem('token');
const list = document.getElementById('notification-list');
const status = document.getElementById('notifications-status');
const refresh = document.getElementById('refresh-notifications');
const count = document.getElementById('notifications-count');
let loading = false;

async function request(path, options = {}) {
  const response = await fetch('/api/notifications' + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load notifications.');
  return data;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function destination(item) {
  if (item.type === 'message') return 'messages.html?user=' + encodeURIComponent(item.actor_id);
  if (item.type === 'connection_request') return 'connections.html#incoming-heading';
  return 'connections.html#outgoing-heading';
}

function render(items, unreadCount) {
  list.replaceChildren();
  count.textContent = unreadCount ? String(unreadCount) : '';
  count.hidden = !unreadCount;
  if (!items.length) {
    list.append(node('p', 'notification-empty', 'You’re all caught up.'));
    return;
  }
  for (const item of items) {
    const row = node('article', 'notification-item');
    const link = node('a');
    link.href = destination(item);
    link.append(node('span', 'notification-title', item.title));
    const preview = item.type === 'message'
      ? item.body + (item.unread_count > 1 ? ' · ' + item.unread_count + ' unread messages' : '')
      : item.type.replaceAll('_', ' ');
    if (preview) link.append(node('span', 'notification-copy', preview));
    const time = new Date(item.created_at);
    if (!Number.isNaN(time.getTime())) link.append(node('time', 'notification-time', time.toLocaleString()));
    link.addEventListener('click', async event => {
      event.preventDefault();
      if (item.type !== 'message') {
        try { await request('/' + encodeURIComponent(item.id) + '/read', { method: 'PATCH' }); }
        catch (error) { status.textContent = error.message; }
      }
      window.location.assign(link.href);
    });
    row.append(link);
    if (item.type === 'message' && item.unread_count) row.append(node('span', 'notification-unread-count', String(item.unread_count)));
    list.append(row);
  }
}

async function load() {
  if (!token || loading || document.hidden) return;
  loading = true;
  try {
    const data = await request('');
    render(data.notifications || [], data.unread_count || 0);
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message === 'Could not load notifications.'
      ? 'Updates are temporarily unavailable. Please try again.'
      : error.message;
    list.replaceChildren(node('p', 'notification-empty', 'Could not load updates. Please try refreshing.'));
  } finally { loading = false; }
}

refresh?.addEventListener('click', load);
window.addEventListener('focus', load);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
load();
window.setInterval(load, 20000);
