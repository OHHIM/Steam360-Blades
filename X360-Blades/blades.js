(() => {
  if (window.__x360Blades) return;
  window.__x360Blades = true;
  const BASE = 'https://millennium.host/v1/themes/X360-Blades/';
  const POPUP_SHEETS = ['font.css', 'glyphs.css', 'keyboard.css', 'guide.css'];
  const BLADES = [
    { label: 'marketplace', color: 5, web: 'https://store.steampowered.com/', match: /^\/(store|steamweb|browser)/ },
    { label: 'home', color: 1, path: '/library/home', match: /^\/library\/home/ },
    { label: 'games', color: 2, path: '/library', match: /^\/library/ },
    { label: 'media', color: 3, path: '/media/grid', match: /^\/media/ },
    { label: 'system', color: 4, path: '/settings', match: /^\/settings/ },
  ];
  const TRIGGER_LEFT = 7, TRIGGER_RIGHT = 8;
  let nav, title, jewel, active = -1, root;
  function instance() {
    try {
      const store = (window.opener || window).SteamUIStore || window.SteamUIStore;
      return store?.WindowStore?.GamepadUIMainWindowInstance;
    } catch { return undefined; }
  }
  function currentPath() {
    const inst = instance();
    return inst?.m_history?.location?.pathname || inst?.m_locationPathname || '';
  }
  function bladeForPath(path) {
    return BLADES.findIndex(b => b.match.test(path));
  }
  function select(index, hold) {
    if (index < 0 || !root) return;
    if (active >= 0 && index !== active) { if (hold) hideContent(); else slide(index > active ? 'right' : 'left'); }
    active = index;
    root.dataset.blade = String(BLADES[index].color);
    root.style.setProperty('--x360-left-count', String(index));
    root.style.setProperty('--x360-right-count', String(BLADES.length - 1 - index));
    title.textContent = BLADES[index].label;
    [...nav.querySelectorAll('button')].forEach((button, i) => {
      const side = i < index ? 'left' : i > index ? 'right' : 'open';
      button.dataset.side = side;
      button.style.setProperty('--slot', String(side === 'right' ? BLADES.length - 1 - i : i));
      button.tabIndex = side === 'open' ? -1 : 0;
      if (side === 'open') button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    jewel.style.setProperty('--slot', String(index));
  }
  let pendingUntil = 0;
  function go(index) {
    index = Math.max(0, Math.min(BLADES.length - 1, index));
    if (index === active) return;
    const inst = instance();
    if (!inst?.Navigate) return;
    const blade = BLADES[index];
    const direction = index > active ? 'right' : 'left';
    select(index, true);
    pendingUntil = performance.now() + 900;
    setTimeout(() => {
      const pageOf = () => document.querySelector('#Main .TopLevelTransitionSwitch > *');
      const oldPage = pageOf();
      if (blade.web && inst.NavigateToSteamWeb) inst.NavigateToSteamWeb(blade.web);
      else inst.Navigate(blade.path);
      const started = performance.now();
      (function wait() {
        const current = pageOf();
        const swapped = (current && current !== oldPage && (!oldPage || !oldPage.isConnected))
          || (blade.web && document.querySelector('#Main .BrowserContainer'));
        if (swapped || performance.now() - started > 1000) slide(direction);
        else setTimeout(wait, 16);
      })();
    }, 24);
  }
  let slideTimer;
  function hideContent() {
    root.dataset.x360Slide = 'out';
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => { if (root?.dataset.x360Slide === 'out') delete root.dataset.x360Slide; }, 1200);
  }
  function slide(direction) {
    root.dataset.x360Slide = direction;
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      if (root) delete root.dataset.x360Slide;
      try { window.dispatchEvent(new Event('resize')); } catch {  }
    }, 420);
  }
  function sound(file) {
    try {
      const store = (window.opener || window).SteamUIStore || window.SteamUIStore;
      store?.GamepadUIAudio?.AudioPlaybackManager?.PlayAudioURL?.('/sounds/' + file);
    } catch {  }
  }
  let card;
  function buildCard() {
    card = document.createElement('div');
    card.className = 'x360-card';
    card.innerHTML = '<img alt=""><div class="x360-card-text"><div class="x360-card-name"></div><div class="x360-card-status"></div></div>' +
      '<div class="x360-card-stats"><div class="x360-card-stat" data-stat="games"><b></b><span>games</span></div><div class="x360-card-stat" data-stat="installed"><b></b><span>installed</span></div></div>';
    nav.append(card);
  }
  function updateCard() {
    if (!card) return;
    const host = window.opener || window;
    let name = '';
    try {
      const ui = host.friendStore?.m_FriendsUIFriendStore;
      const self = ui?.self || ui?.m_self;
      name = self?.display_name || self?.persona?.m_strPlayerName || '';
      if (!name) {
        const id = String(host.App?.m_CurrentUser?.strSteamID || '');
        const cached = host.friendStore?.m_mapPlayerCache?.get?.(id);
        name = cached?.persona?.m_strPlayerName || cached?.display_name || '';
      }
    } catch {  }
const avatar = document.querySelector('#header_profile img')?.src || '';
    const img = card.querySelector('img');
    if (avatar && img.src !== avatar) img.src = avatar;
    card.querySelector('.x360-card-name').textContent = name;
    card.hidden = !avatar;
    card.querySelector('.x360-card-name').hidden = !name;
    const state = document.querySelector('#header_profile .CurrentUserAvatar')?.classList;
    const status = state?.contains('ingame') ? 'in-game' : state?.contains('online') ? 'online' : state?.contains('away') ? 'away' : 'offline';
    const statusEl = card.querySelector('.x360-card-status');
    if (statusEl) { statusEl.textContent = status; statusEl.dataset.state = status; }
    const counts = {};
    try { counts.games = host.collectionStore?.allGamesCollection?.allApps?.length; counts.installed = host.collectionStore?.localGamesCollection?.allApps?.length; } catch {  }
    for (const el of card.querySelectorAll('.x360-card-stat')) {
      const value = counts[el.dataset.stat];
      el.hidden = !Number.isFinite(value);
      if (Number.isFinite(value)) el.querySelector('b').textContent = String(value);
    }
  }
  function boot() {
    const host = window.opener || window;
    try { if (host.__x360Booted) return; host.__x360Booted = true; } catch { return; }
    const overlay = document.createElement('div');
    overlay.id = 'x360-boot';
    overlay.innerHTML = '<div class="x360-boot-ribbon r1"></div><div class="x360-boot-ribbon r2"></div><div class="x360-boot-ribbon r3"></div>' +
      '<div class="x360-boot-orb"><img alt="" src="https://steamloopback.host/steaminputglyphs/sc_button_steam.svg"></div>' +
      '<div class="x360-boot-word">STEAM <span>360</span></div>';
    document.body.append(overlay);
    setTimeout(() => sound('x360_launch.wav'), 900);
    setTimeout(() => overlay.classList.add('x360-boot-out'), 4300);
    setTimeout(() => overlay.remove(), 5200);
  }
  function bladeAt(x, fallback) {
    let best = fallback, distance = Infinity;
    [...nav.querySelectorAll('button')].forEach((button, i) => {
      if (button.dataset.side === 'open') return;
      const box = button.querySelector('span')?.getBoundingClientRect();
      if (!box || !box.width) return;
      const d = Math.abs(box.left + box.width / 2 - x);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  }
  function build() {
    nav = document.createElement('nav');
    nav.id = 'x360-blades';
    nav.setAttribute('aria-label', 'Dashboard blades');
    jewel = document.createElement('div');
    jewel.className = 'x360-jewel';
    nav.append(jewel);
    BLADES.forEach((blade, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      const text = document.createElement('span');
      text.textContent = blade.label;
      button.append(text);
      button.addEventListener('click', event => go(event.detail ? bladeAt(event.clientX, i) : i));
      nav.append(button);
    });
    nav.addEventListener('mousemove', event => {
      const hot = event.target?.closest?.('button') ? bladeAt(event.clientX, -1) : -1;
      [...nav.querySelectorAll('button')].forEach((button, i) => button.toggleAttribute('data-x360-hot', i === hot));
    });
    nav.addEventListener('mouseleave', () => nav.querySelectorAll('button[data-x360-hot]').forEach(button => button.removeAttribute('data-x360-hot')));
    title = document.createElement('div');
    title.className = 'x360-title';
    nav.append(title);
    buildCard();
  }
  function sync() {
    const found = document.querySelector('.BasicUiRoot');
    if (!found) return;
    if (!nav) build();
    ensureDefs(document);
    if (found !== root || nav.parentElement !== found) {
      root = found;
      root.prepend(nav);
      active = -1;
    }
    const path = currentPath();
    const off = !path || /^\/(login|init|oobe|update|shutdown|welcome)/.test(path) || !!instance()?.BViewingPreLoginRoute?.();
    root.toggleAttribute('data-x360-off', off);
    nav.hidden = off;
    if (!off) { updateCard(); }
    const next = bladeForPath(path);
    if (performance.now() < pendingUntil) { if (next === active) pendingUntil = 0; return; }
    if (next >= 0 && next !== active) select(next);
    else if (active < 0) select(1);
  }
  function ensureDefs(doc) {
    if (!doc?.body || doc.getElementById('x360-defs')) return;
    const holder = doc.createElement('div');
    holder.innerHTML = '<svg id="x360-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="x360-gloss-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#f1f5f6"/><stop offset=".52" stop-color="#cfd9dd"/><stop offset="1" stop-color="#9fb0b8"/></linearGradient>' +
      '<linearGradient id="x360-gloss-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7d87"/><stop offset=".48" stop-color="#43535c"/><stop offset=".52" stop-color="#2c3a42"/><stop offset="1" stop-color="#141d22"/></linearGradient>' +
      '</defs></svg>';
    doc.body.append(holder.firstChild);
  }
  function stylePopups() {
    const trees = instance()?.m_FocusNavContext?.m_rgGamepadNavigationTrees || [];
    for (const tree of trees) {
      let doc;
      try { doc = tree?.m_window?.document; } catch { continue; }
      if (!doc?.head || doc === document) continue;
      ensureDefs(doc);
      for (const file of POPUP_SHEETS) {
        if (doc.querySelector('link[data-x360="' + file + '"]')) continue;
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = BASE + file;
        link.dataset.x360 = file;
        doc.head.append(link);
      }
      doc.documentElement.dataset.x360Popup = (doc.title || '').replace(/_uid\d+$/, '');
    }
  }
  const TOAST_SHEETS = ['font.css', 'achievements.css'];
  function styleToasts() {
    let sources = [];
    try { sources = ((window.opener || window).SteamUIStore?.m_GamepadNavigationManager?.m_rgGamepadInputSources) || []; } catch { return; }
    for (const source of sources) {
      let doc;
      try { doc = source?.m_targetWindow?.document; } catch { continue; }
      if (!doc?.head || !/^notificationtoasts/i.test(doc.title || '')) continue;
      for (const file of TOAST_SHEETS) {
        if (doc.querySelector('link[data-x360="' + file + '"]')) continue;
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = BASE + file;
        link.dataset.x360 = file;
        doc.head.append(link);
      }
    }
  }
  window.addEventListener('vgp_onbuttondown', event => {
    const button = event.detail?.button;
    if (button !== TRIGGER_LEFT && button !== TRIGGER_RIGHT) return;
    if (!event.target?.closest?.('#GamepadUI_Full_Root') || active < 0) return;
    go(active + (button === TRIGGER_LEFT ? -1 : 1));
  }, true);
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; sync(); }, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(() => { sync(); stylePopups(); styleToasts(); }, 1000);
  window.addEventListener('pagehide', () => { observer.disconnect(); clearInterval(timer); }, { once: true });
  sync();
  stylePopups();
})();
