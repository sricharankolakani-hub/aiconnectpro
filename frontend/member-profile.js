import { getUser } from './auth.js';

const status = document.getElementById('member-status');
const card = document.getElementById('member-card');
const token = localStorage.getItem('token');
const headers = token ? { Authorization: 'Bearer ' + token } : {};

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : '';
}
function showDetail(label, value) {
  if (!value) return;
  const row = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = label;
  const text = document.createElement('span');
  text.textContent = value;
  row.append(name, text);
  document.getElementById('member-details').append(row);
}

async function initialize() {
  if (!token) {
    window.location.replace('login.html');
    return;
  }
  try {
    await getUser();
    const userId = new URLSearchParams(location.search).get('user');
    if (!userId) throw new Error('Profile not found.');
    const response = await fetch('/api/profile/' + encodeURIComponent(userId), { headers });
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) throw new Error('This profile is private or unavailable.');
      throw new Error(profile.error || 'Could not load this profile.');
    }
    document.getElementById('member-name').textContent = profile.full_name || 'AIConnectPro member';
    const initials = String(profile.full_name || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A';
    const avatar = document.getElementById('member-avatar');
    avatar.textContent = initials;
    if (profile.avatar_url) {
      const image = document.createElement('img');
      image.src = profile.avatar_url;
      image.alt = '';
      avatar.replaceChildren(image);
    }
    if (profile.company_name) {
      const company = document.getElementById('member-company');
      company.textContent = profile.company_name;
      company.hidden = false;
    }
    if (profile.bio) {
      const bio = document.getElementById('member-bio');
      bio.textContent = profile.bio;
      bio.hidden = false;
    }
    showDetail('Place', profile.location);
    showDetail('Date of birth', profile.date_of_birth
      ? new Date(profile.date_of_birth + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : '');
    showDetail('Email', profile.email);
    showDetail('Phone', profile.phone);
    const message = document.getElementById('member-message');
    if (profile.email || profile.phone) {
      // Contact sharing does not imply that a messaging connection exists.
      message.hidden = true;
    }
    card.hidden = false;
    setStatus('');
  } catch (error) {
    setStatus(error.message || 'Could not load this profile.', true);
  }
}

initialize();
