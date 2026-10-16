(() => {
  const storageKey = 'aiconnectpro-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const saved = localStorage.getItem(storageKey);
  const initial = saved === 'dark' || saved === 'light' ? saved : (media.matches ? 'dark' : 'light');

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = theme === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.innerHTML = '<span aria-hidden="true">' + (dark ? '☀' : '☾') + '</span>';
  }

  async function addAdminNavigation() {
    const nav = document.querySelector('.primary-nav');
    if (!nav || nav.querySelector('[data-admin-nav]')) return;

    try {
      const { getUser } = await import('./auth.js');
      const user = await getUser();
      const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
      if (!roles.includes('admin')) return;

      const link = document.createElement('a');
      link.href = 'admin-company-requests.html';
      link.textContent = 'Admin Requests';
      link.dataset.adminNav = 'true';
      if (window.location.pathname.endsWith('/admin-company-requests.html')) {
        link.setAttribute('aria-current', 'page');
      }
      nav.append(link);
    } catch {
      // Keep the regular navigation if the user is signed out or auth is unavailable.
    }
  }

  applyTheme(initial);
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(document.body.dataset.theme || initial);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
    void addAdminNavigation();
  });

  media.addEventListener?.('change', event => {
    if (!localStorage.getItem(storageKey)) applyTheme(event.matches ? 'dark' : 'light');
  });
})();
