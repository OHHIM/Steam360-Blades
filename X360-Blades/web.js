(() => {
  // Xbox 360 Blades: small helpers for Steam web pages shown inside the desktop client.
  if (window.__x360Web || !document.documentElement.classList.contains('DesktopUI')) return;
  window.__x360Web = true;
  const html = document.documentElement;
  // pages shown inside a small dialog (update news / special offers) instead of the main window
  if (/^\/marketingmessages/.test(location.pathname)) html.classList.add('x360-embedded');
  if (location.hostname === 'help.steampowered.com') html.classList.add('x360-help');
  function tag() {
    // points shop item cards are frosted glass panels with hashed class names
    if (/^\/points/.test(location.pathname)) {
      for (const el of document.querySelectorAll('div:not([data-x360-card])')) {
        const cs = getComputedStyle(el);
        if (!cs.backdropFilter || !cs.backdropFilter.includes('blur')) continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 120 && r.width <= 420 && r.height >= 150) el.setAttribute('data-x360-card', '');
      }
    }
    // community "edit profile" side navigation
    if (/\/edit\//.test(location.pathname)) {
      const link = [...document.querySelectorAll('a')].find(a => /\/edit\/(info|avatar|settings)/.test(a.getAttribute('href') || '') || /^(General|Avatar|Privacy Settings)$/.test(a.textContent.trim()));
      const nav = link?.parentElement;
      if (nav && !nav.hasAttribute('data-x360-nav')) nav.setAttribute('data-x360-nav', '');
    }
  }
  tag();
  new MutationObserver(() => { clearTimeout(tag.t); tag.t = setTimeout(tag, 250); }).observe(document.documentElement, { childList: true, subtree: true });
})();
