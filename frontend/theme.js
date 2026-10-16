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

  applyTheme(initial);
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(document.body.dataset.theme || initial);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  });

  media.addEventListener?.('change', event => {
    if (!localStorage.getItem(storageKey)) applyTheme(event.matches ? 'dark' : 'light');
  });
})();
