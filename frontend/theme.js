(() => {
  const storageKey = 'aiconnectpro-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const saved = localStorage.getItem(storageKey);
  const initial = saved === 'dark' || saved === 'light' ? saved : (media.matches ? 'dark' : 'light');

  function polishNavigation() {
    const nav = document.querySelector('.primary-nav');
    if (!nav) return;
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const authPage = page === 'login.html' || page === 'signup.html';
    const common = authPage
      ? [['index.html', 'Home'], ['jobs.html', 'Jobs']]
      : [['jobs.html', 'Jobs'], ['connections.html', 'Connections'], ['messages.html', 'Messages'], ['resume.html', 'Resume Builder'], ['profile.html', 'My Profile']];
    const existing = [...nav.querySelectorAll('a')];
    const byPath = new Map();
    for (const link of existing) {
      const key = new URL(link.getAttribute('href'), window.location.href).pathname.split('/').pop();
      if (!byPath.has(key)) byPath.set(key, link);
    }
    const ordered = [];
    const extras = [];
    for (const [href, label] of common) {
      let link = byPath.get(href);
      if (!link) {
        link = document.createElement('a');
        link.href = href;
      }
      link.textContent = label;
      if (page === href) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      ordered.push(link);
      byPath.delete(href);
    }
    for (const [href, label] of [
      ['post-job.html', 'Post an opportunity'],
      ['company-applications.html', 'Applicant inbox'],
      ['company-access.html', 'For employers'],
      ['admin-company-requests.html', 'Admin Requests']
    ]) {
      let link = byPath.get(href);
      if (page === href && !link) {
        link = document.createElement('a');
        link.href = href;
        link.textContent = label;
      }
      if (link) {
        if (page === href) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        extras.push(link);
        byPath.delete(href);
      }
    }
    for (const link of existing) {
      const key = new URL(link.getAttribute('href'), window.location.href).pathname.split('/').pop();
      if (!common.some(([href]) => href === key) && !extras.includes(link)) extras.push(link);
    }
    if (extras.length) {
      const more = document.createElement('details');
      more.className = 'nav-more';
      if (extras.some(link => link.getAttribute('aria-current') === 'page')) more.open = true;
      const summary = document.createElement('summary');
      summary.textContent = 'More';
      const menu = document.createElement('div');
      menu.className = 'nav-more-menu';
      for (const link of extras) menu.appendChild(link);
      more.append(summary, menu);
      ordered.push(more);
    }
    nav.replaceChildren(...ordered);
    const themeToggle = document.getElementById('theme-toggle');
    const navShell = nav.closest('.nav-shell');
    if (themeToggle && navShell) navShell.append(themeToggle);
  }

  function addSharedFooter() {
    if (!document.querySelector('.site-header') || !document.querySelector('main') || document.querySelector('.site-footer')) return;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const inner = document.createElement('div');
    inner.className = 'shell footer-inner';
    const brand = document.createElement('a');
    brand.className = 'brand brand-footer';
    brand.href = 'index.html';
    brand.setAttribute('aria-label', 'AIConnectPro home');
    brand.innerHTML = '<span class="brand-mark" aria-hidden="true">A</span> AIConnectPro';
    const copy = document.createElement('span');
    copy.textContent = 'Career tools and opportunities for your next step.';
    const privacy = document.createElement('a');
    privacy.href = 'privacy-policy.html';
    privacy.textContent = 'Privacy';
    privacy.className = 'footer-privacy';
    inner.append(brand, copy, privacy);
    footer.appendChild(inner);
    document.body.appendChild(footer);
  }

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
    polishNavigation();
    addSharedFooter();
    void addAdminNavigation().then(polishNavigation);
  });

  media.addEventListener?.('change', event => {
    if (!localStorage.getItem(storageKey)) applyTheme(event.matches ? 'dark' : 'light');
  });
})();
