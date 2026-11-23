(function start(tries = 0) {
  // Xbox 360 Blades for the normal (non Big Picture) Steam window.
  if (!document.body) { if (tries < 200) setTimeout(() => start(tries + 1), 50); return; }
  if (!document.body.classList.contains('DesktopUI')) { if (tries < 200) setTimeout(() => start(tries + 1), 50); return; }
  if (window.__x360DesktopStop) window.__x360DesktopStop();
  let needBoot = false;
  try { needBoot = !(window.opener || window).__x360DesktopBooted; } catch { }
  if (needBoot) {
    document.body.classList.add('x360-booting');
    setTimeout(() => { if (!document.getElementById('x360-boot')) document.body.classList.remove('x360-booting'); }, 20000);
  }

  const host = (() => { try { return window.opener || window; } catch { return window; } })();
  const BLADES = [
    { label: 'marketplace', color: 5, web: 'https://store.steampowered.com/', tab: 'store' },
    { label: 'home', color: 1, path: '/library/home' },
    { label: 'games', color: 2, path: '/library/collection/my-games', games: true },
    { label: 'community', color: 3, web: 'https://steamcommunity.com/', tab: 'community' },
    { label: 'system', color: 4, url: 'steam://settings' },
  ];
  const HOME = 1, GAMES = 2;
  // "Games blade" theme setting: grid (default) / downloads / friends / friends+downloads
  const GAMES_MODES = {
    'grid': { label: 'games', path: '/library/collection/my-games' },
    'downloads': { label: 'downloads', path: '/library/downloads' },
    'friends': { label: 'friends', path: '/library/downloads' },
    'friends+downloads': { label: 'friends', path: '/library/downloads' },
  };
  function gamesMode() {
    const v = getComputedStyle(document.body).getPropertyValue('--x360-games').trim().replace(/["']/g, '');
    return GAMES_MODES[v] ? v : 'grid';
  }
  function applyGamesMode() {
    const mode = gamesMode();
    Object.assign(BLADES[GAMES], GAMES_MODES[mode]);
    document.body.dataset.x360Games = mode;
    const label = BLADES[GAMES].label;
    const span = nav?.querySelectorAll(':scope > button span')[GAMES];
    if (span && span.textContent !== label) span.textContent = label;
    if (active === GAMES && title && title.textContent !== label) { title.textContent = label; jewel.querySelector('span').textContent = label; }
  }
  let nav, title, jewel, card, frame, active = -1, pendingUntil = 0, slideTimer, stopped = false;

  const instance = () => { try { return host.SteamUIStore?.WindowStore?.MainWindowInstance; } catch { return undefined; } };
  const browser = () => { try { return host.MainWindowBrowserManager; } catch { return undefined; } };
  const currentPath = () => instance()?.m_history?.location?.pathname || '';

  function bladeForPath(path) {
    if (/^\/browser/.test(path)) {
      const tab = browser()?.m_lastActiveTab;
      if (tab === 'store') return 0;
      if (tab === 'community' || tab === 'me') return 3;
      return -1;
    }
    if (/^\/library\/home/.test(path)) return HOME;
    // a game's page stays under whichever library blade you opened it from
    if (/^\/library\/app\//.test(path)) return active === HOME || active === GAMES ? active : GAMES;
    if (/^\/library/.test(path)) return GAMES;
    return -1;
  }

  const sounds = {};
  function sound(file, volume = 0.6) {
    try {
      const audio = sounds[file] ||= Object.assign(new Audio('/sounds/' + file), { preload: 'auto' });
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch { }
  }

  // Steam only re-measures the store/community view when its size changes, not when it moves,
  // so push the new rectangle to it ourselves whenever the blades shift the panel.
  function syncBrowserBounds() {
    try {
      const el = document.querySelector('.BrowserWrapper .Browser');
      const view = browser()?.m_browser;
      if (!el || !view?.SetBounds) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) view.SetBounds(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
    } catch { }
  }
  function resizeNudge() {
    syncBrowserBounds();
    try { window.dispatchEvent(new Event('resize')); } catch { }
  }

  const SYSTEM = BLADES.findIndex(b => b.url);
  // ---------- Steam's other windows (dialogs, chat, settings, menus) ----------
  // the theme's own folder, read from the tag Millennium injected this script with (store installs use the repo name, manual ones may not)
  const BASE = (document.querySelector('script[src^="https://millennium.host/v1/themes/"][src$="/desktop.js"]')?.src
    || 'https://millennium.host/v1/themes/Steam360-Blades/desktop.js').replace(/[^/]+$/, '');
  const POPUP_SHEETS = ['font.css', 'global.css', 'windows.css'];
  function popupWindows() {
    try {
      return [...host.g_PopupManager.GetPopups()].map(p => p.m_popup)
        .filter(w => { try { return w && !w.closed && w !== window && w.document?.documentElement; } catch { return false; } });
    } catch { return []; }
  }
  // the popup sheets are kept as text so a new window can be themed before it first paints
  const sheetText = {};
  for (const file of POPUP_SHEETS) {
    fetch(BASE + file).then(r => r.ok ? r.text() : '').then(text => {
      if (text) sheetText[file] = text.replace(/url\((["']?)(?!https?:|data:|#)([^"')]+)\1\)/g, (m, q, u) => 'url("' + BASE + u + '")');
    }).catch(() => { });
  }
  function themePopup(w) {
    try {
      const doc = w.document;
      const head = doc.head || doc.documentElement;
      if (!head) return;
      for (const file of POPUP_SHEETS) {
        if (doc.querySelector('[data-x360="' + file + '"], link[href="' + BASE + file + '"]')) continue;
        let el;
        if (sheetText[file]) { el = doc.createElement('style'); el.textContent = sheetText[file]; }
        else { el = doc.createElement('link'); el.rel = 'stylesheet'; el.href = BASE + file; }
        el.dataset.x360 = file;
        head.append(el);
      }
      if (active >= 0) doc.documentElement.dataset.x360Blade = String(BLADES[active].color);
      doc.documentElement.classList.toggle('x360-sharp', sharpCorners());
    } catch { }
  }
  // theme setting "Corners": round (default) / sharp
  const sharpCorners = () => getComputedStyle(document.documentElement).getPropertyValue('--x360-corners').replace(/["'\s]/g, '') === 'sharp';
  // theme setting "Steam Settings": locked (default) / free / off
  function settingsMode() {
    const v = getComputedStyle(document.body).getPropertyValue('--x360-settings').trim().replace(/["']/g, '');
    return v === 'off' ? 'off' : 'free';
  }
  // where the docked Settings window goes: exactly over the content panel
  function dockRect() {
    const frame = document.querySelector('.ContentFrame')?.getBoundingClientRect();
    if (!frame || frame.width < 200) return null;
    return {
      x: Math.round(window.screenX + frame.left), y: Math.round(window.screenY + frame.top),
      width: Math.round(frame.width), height: Math.round(frame.height), frame
    };
  }
  function canDock() {
    return settingsMode() !== 'off' && document.visibilityState === 'visible' && document.body.classList.contains('x360d');
  }
  const isSettingsPopup = p => p?.m_strTitle === 'Steam Settings' ||
    (p?.m_rgParams?.minWidth === 850 && p?.m_rgParams?.minHeight === 722 && /ModalDialogPopup/.test(p?.m_rgParams?.html_class || ''));
  // Steam creates Settings centred at its own size; rewrite that before the window exists so it opens docked
  function prepareSettings(popup) {
    if (!canDock()) return;
    // switch to the system blade first, so the panel is already where the window will sit
    if (!document.body.dataset.x360Millennium) { document.body.dataset.x360Millennium = String(active); select(SYSTEM, true); }
    const upd = popup.UpdateParamsBeforeShow;
    popup.UpdateParamsBeforeShow = function (params) {
      params = upd.call(this, params) || params;
      try {
        const r = dockRect();
        if (!r || !canDock()) return params;
        const mode = settingsMode();
        delete params.center_on_window;
        const id = window.SteamClient?.Browser?.GetBrowserID?.();
        if (id) params.window_opener_id = id;
        // square corners and no drop shadow, so it sits flush in the panel
        params.eCreationFlags = (params.eCreationFlags || 0) | 16384 | 262144;
        params.dimensions = { width: r.width, height: r.height };
        // Steam places new windows from "restore details" exactly, unlike window.open's left/top
        params.strRestoreDetails = '1&x=' + r.x + '&y=' + r.y + '&w=' + r.width + '&h=' + r.height;
        params.minWidth = mode === 'locked' ? r.width : Math.min(params.minWidth || 0, r.width);
        params.minHeight = mode === 'locked' ? r.height : Math.min(params.minHeight || 0, r.height);
        params.html_class = (params.html_class || '') + ' MillenniumWindow_Settings x360-docked' + (mode === 'locked' ? ' x360-locked' : '');
      } catch { }
      return params;
    };
    document.body.setAttribute('data-x360-settings-open', '');
    setBrowserVisible(false);
  }
  const owned = () => !window.__x360NoOwn;
  let popupBase = null, popupCreated = null;
  function hookPopups() {
    try {
      const pm = host.g_PopupManager;
      if (!popupBase) {
        let o = [...pm.GetPopups()][0];
        while (o && !Object.prototype.hasOwnProperty.call(o, 'Show')) o = Object.getPrototypeOf(o);
        if (o && !o.__x360Show) {
          const show = o.Show;
          o.__x360Show = show;
          o.Show = function (...args) {
            try { if (isSettingsPopup(this)) prepareSettings(this); } catch { }
            return show.apply(this, args);
          };
          popupBase = o;
        }
      }
      // theme every new window the moment it exists
      if (!popupCreated) popupCreated = pm.AddPopupCreatedCallback(p => {
        try {
          const w = p.m_popup;
          if (!w || w === window) return;
          themePopup(w);
          if (isSettingsPopup(p) && canDock()) {
            const r = dockRect();
            if (r) { try { w.SteamClient.Window.MoveTo(r.x, r.y, window.devicePixelRatio || 1); } catch { } }
            dockSettings(w);
          }
        } catch { }
      });
    } catch { }
  }
  function unhookPopups() {
    try { if (popupBase?.__x360Show) { popupBase.Show = popupBase.__x360Show; delete popupBase.__x360Show; } } catch { }
    try { popupCreated?.Unregister?.(); } catch { }
    popupBase = popupCreated = null;
  }
  function settingsWindow() {
    return popupWindows().find(w => { try { return /MillenniumWindow_Settings/.test(w.document.documentElement.className) || w.document.title === 'Steam Settings'; } catch { return false; } }) || null;
  }
  // Steam Settings is its own window: park it exactly over the dashboard panel so it reads as the "system" blade
  async function dockSettings(w) {
    try {
      const doc = w.document, root = doc.documentElement, mode = settingsMode();
      if (!canDock()) {
        root.classList.remove('x360-docked', 'x360-locked');
        return;
      }
      const r = dockRect();
      if (!r) return;
      const { x, y, width, height, frame } = r;
      root.classList.add('x360-docked');
      root.classList.toggle('x360-locked', mode === 'locked');
      // line the blade background up with the main window around it
      root.style.setProperty('--x360-bgx', -Math.round(frame.left) + 'px');
      root.style.setProperty('--x360-bgy', -Math.round(frame.top) + 'px');
      root.style.setProperty('--x360-bgw', window.innerWidth + 'px');
      root.style.setProperty('--x360-bgh', window.innerHeight + 'px');
      const win = w.SteamClient.Window;
      if (mode === 'free') {
        // dock once when it opens, then it's the user's to move and resize
        if (!w.__x360Docked) { w.__x360Docked = true; win.ResizeTo(width, height, true); win.MoveTo(x, y, window.devicePixelRatio || 1); }
        if (w.__x360Locked) { w.__x360Locked = false; try { win.SetMinSize(400, 300); win.SetMaxSize(16384, 16384); } catch { } }
        return;
      }
      // locked: same size and place as the panel, always
      const key = [width, height].join();
      if (w.__x360Size !== key) {
        w.__x360Size = key;
        try { win.SetMinSize(width, height); win.SetMaxSize(width, height); } catch { }
      }
      if (!w.__x360Grip) { w.__x360Grip = true; try { win.SetResizeGrip(24, 24); } catch { } }
      w.__x360Locked = true;
      let now = null;
      try { now = await win.GetWindowDimensions(); } catch { }
      if (!now || now.x !== x || now.y !== y || now.width !== width || now.height !== height) {
        win.ResizeTo(width, height, true);
        win.MoveTo(x, y, window.devicePixelRatio || 1);
      }
    } catch { }
  }
  function closeSettings() {
    const w = settingsWindow();
    if (!w) return;
    try { w.SteamClient.Window.Close(); } catch { try { w.close(); } catch { } }
  }
  function tendPopups() {
    for (const w of popupWindows()) themePopup(w);
    const settings = settingsMode() !== 'off' ? settingsWindow() : null;
    if (settings) {
      if (settings.__x360Path === undefined) settings.__x360Path = currentPath();
      else if (currentPath() !== settings.__x360Path) { closeSettings(); return; }
      dockSettings(settings);
    }
    // keep the panel underneath empty while Settings sits on top of it
    const open = !!settings;
    if (open !== document.body.hasAttribute('data-x360-settings-open')) {
      document.body.toggleAttribute('data-x360-settings-open', open);
      if (open) setBrowserVisible(false);
      else if (/^\/browser/.test(currentPath())) { setBrowserVisible(true); resizeNudge(); }
    }
  }
  function select(index, hold) {
    if (index < 0 || !nav) return;
    if (active >= 0 && index !== active) { if (hold) hideContent(); else slide(index > active ? 'right' : 'left'); }
    active = index;
    document.body.dataset.blade = String(BLADES[index].color);
    try { host.__x360Blade = BLADES[index].color; } catch { }
    document.body.style.setProperty('--x360-left-count', String(index));
    document.body.style.setProperty('--x360-right-count', String(BLADES.length - 1 - index));
    title.textContent = BLADES[index].label;
    [...nav.querySelectorAll(':scope > button')].forEach((button, i) => {
      const side = i < index ? 'left' : i > index ? 'right' : 'open';
      button.dataset.side = side;
      button.style.setProperty('--slot', String(side === 'right' ? BLADES.length - 1 - i : i));
      button.tabIndex = side === 'open' ? -1 : 0;
    });
    jewel.style.setProperty('--slot', String(index));
    jewel.querySelector('span').textContent = BLADES[index].label;
    resizeNudge();
    setTimeout(resizeNudge, 60);
    setTimeout(resizeNudge, 340);
  }

  function hideContent() {
    document.body.dataset.x360Slide = 'out';
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => { if (document.body.dataset.x360Slide === 'out') delete document.body.dataset.x360Slide; }, 1200);
  }
  function slide(direction) {
    document.body.dataset.x360Slide = direction;
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => { delete document.body.dataset.x360Slide; resizeNudge(); }, 320);
  }

  function go(index) {
    index = Math.max(0, Math.min(BLADES.length - 1, index));
    const blade = BLADES[index];
    if (blade.url) {
      sound('x360_select.wav');
      const open = settingsWindow();
      if (open) { try { open.SteamClient.Window.BringToFront(); } catch { } }
      else { try { host.SteamClient?.URL?.ExecuteSteamURL(blade.url); } catch { } }
      if (active !== index) select(index, false);
      return;
    }
    closeSettings();
    if (index === active) return;
    const inst = instance();
    if (!inst?.Navigate) return;
    sound('x360_select.wav');
    const direction = index > active ? 'right' : 'left';
    select(index, true);
    pendingUntil = performance.now() + 900;
    setTimeout(() => {
      const before = currentPath();
      try {
        if (blade.web && browser()?.ShowURL) browser().ShowURL(blade.web, blade.tab);
        else inst.Navigate(blade.path);
      } catch { }
      const started = performance.now();
      (function wait() {
        if (stopped) return;
        const now = currentPath();
        if (bladeForPath(now) === index || (now !== before && now) || performance.now() - started > 900) slide(direction);
        else setTimeout(wait, 16);
      })();
    }, 24);
  }

  function bladeAt(x, fallback) {
    let best = fallback, distance = Infinity;
    [...nav.querySelectorAll(':scope > button')].forEach((button, i) => {
      if (button.dataset.side === 'open') return;
      const box = button.querySelector('span')?.getBoundingClientRect();
      if (!box || !box.width) return;
      const d = Math.abs(box.left + box.width / 2 - x);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  }

  function buildCard() {
    card = document.createElement('div');
    card.className = 'x360-card';
    card.title = 'View profile';
    card.innerHTML = '<img alt=""><div class="x360-card-text"><div class="x360-card-name"></div><div class="x360-card-status"></div></div>' +
      '<div class="x360-card-stats"><div class="x360-card-stat" data-stat="games"><b></b><span>games</span></div><div class="x360-card-stat" data-stat="installed"><b></b><span>installed</span></div></div>';
    card.addEventListener('click', () => {
      sound('x360_select.wav');
      const id = String(host.App?.m_CurrentUser?.strSteamID || '');
      try { browser()?.ShowURL(id ? 'https://steamcommunity.com/profiles/' + id + '/' : 'https://steamcommunity.com/my/', 'me'); } catch { }
    });
    nav.append(card);
  }

  function updateCard() {
    if (!card) return;
    let name = '', avatar = '', state = 0, game = '';
    try {
      const ui = host.friendStore?.m_FriendsUIFriendStore;
      const persona = (ui?.self || ui?.m_self)?.persona;
      name = persona?.m_strPlayerName || '';
      avatar = persona?.avatar_url_full || '';
      state = persona?.m_ePersonaState || 0;
      game = persona?.m_gameid && persona.m_gameid !== '0' ? persona.m_gameid : '';
    } catch { }
    const menu = document.querySelector('.AccountMenu');
    if (!avatar) avatar = menu?.querySelector('img.avatar, img')?.src || '';
    if (!name) name = menu?.querySelector(':scope > div:not([class])')?.textContent || '';
    const img = card.querySelector('img');
    if (avatar && img.src !== avatar) img.src = avatar;
    card.hidden = !avatar && !name;
    card.querySelector('.x360-card-name').textContent = name;
    const status = game ? 'in-game' : state === 1 ? 'online' : (state === 2 || state === 3 || state === 4) ? 'away' : state ? 'online' : 'offline';
    const statusEl = card.querySelector('.x360-card-status');
    statusEl.textContent = status;
    statusEl.dataset.state = status;
    const counts = {};
    try {
      counts.games = host.collectionStore?.allGamesCollection?.allApps?.length;
      counts.installed = host.collectionStore?.localGamesCollection?.allApps?.length;
    } catch { }
    for (const el of card.querySelectorAll('.x360-card-stat')) {
      const value = counts[el.dataset.stat];
      el.hidden = !Number.isFinite(value);
      if (Number.isFinite(value)) el.querySelector('b').textContent = String(value);
    }
  }

  function build() {
    nav = document.createElement('nav');
    nav.id = 'x360-blades';
    nav.setAttribute('aria-label', 'Dashboard blades');
    jewel = document.createElement('div');
    jewel.className = 'x360-jewel';
    jewel.append(document.createElement('span'));
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
    let lastHot = -1;
    nav.addEventListener('mousemove', event => {
      const hot = event.target?.closest?.('button') ? bladeAt(event.clientX, -1) : -1;
      if (hot !== lastHot && hot >= 0) sound('x360_focus.wav', 0.45);
      lastHot = hot;
      [...nav.querySelectorAll(':scope > button')].forEach((button, i) => button.toggleAttribute('data-x360-hot', i === hot));
    });
    nav.addEventListener('mouseleave', () => {
      lastHot = -1;
      nav.querySelectorAll('button[data-x360-hot]').forEach(button => button.removeAttribute('data-x360-hot'));
    });
    title = document.createElement('div');
    title.className = 'x360-title';
    nav.append(title);
    buildCard();
  }

  // ---------- friends panel (games blade = friends / friends+downloads) ----------
  let friendsEl, friendsKey = '';
  function friendRows() {
    let list = [];
    try { list = host.friendStore?.allFriends || []; } catch { }
    return list.map(f => {
      const p = f.persona || f.m_persona || {};
      const appid = p.m_unGamePlayedAppID || 0;
      let game = '';
      if (p.is_ingame || (p.m_gameid && p.m_gameid !== '0')) {
        try { game = host.appStore?.GetAppOverviewByAppID?.(appid)?.display_name || ''; } catch { }
        game = game || p.m_strGameExtraInfo || 'a game';
      }
      const state = game ? 'ingame' : (p.is_online || p.m_ePersonaState > 0) ? 'online' : 'offline';
      const away = [2, 3, 4].includes(p.m_ePersonaState);
      let sid = '';
      try { sid = p.m_steamid?.ConvertTo64BitString?.() || ''; } catch { }
      return {
        sid, state, game, away,
        name: f.m_strNickname || p.m_strPlayerName || 'friend',
        avatar: p.avatar_url_medium || '',
      };
    }).sort((a, b) => ({ ingame: 0, online: 1, offline: 2 }[a.state] - { ingame: 0, online: 1, offline: 2 }[b.state]) || a.name.localeCompare(b.name));
  }
  function renderFriends() {
    const mode = document.body.dataset.x360Games;
    if (active !== GAMES || !/friends/.test(mode || '')) return;
    const content = document.querySelector('.ContentFrame');
    if (!content) return;
    if (!friendsEl) {
      friendsEl = document.createElement('div');
      friendsEl.id = 'x360-friends';
      friendsEl.addEventListener('click', event => {
        const row = event.target.closest?.('.x360-fr');
        if (!row?.dataset.sid) return;
        sound('x360_select.wav');
        try { host.SteamClient?.URL?.ExecuteSteamURL('steam://friends/message/' + row.dataset.sid); } catch { }
      });
    }
    if (friendsEl.parentElement !== content) content.append(friendsEl);
    const rows = friendRows();
    const key = mode + JSON.stringify(rows);
    if (key === friendsKey) return;
    friendsKey = key;
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const groups = [['in game', rows.filter(r => r.state === 'ingame')], ['online', rows.filter(r => r.state === 'online')], ['offline', rows.filter(r => r.state === 'offline')]];
    let html = '';
    for (const [label, list] of groups) {
      if (!list.length && label === 'offline') continue;
      html += '<div class="x360-fr-head">' + label + ' (' + list.length + ')</div>';
      if (!list.length) { html += '<div class="x360-fr-empty">nobody right now</div>'; continue; }
      for (const r of list) {
        const status = r.state === 'ingame' ? 'playing ' + r.game : r.state === 'online' ? (r.away ? 'away' : 'online') : 'offline';
        html += '<div class="x360-fr" data-state="' + r.state + '" data-sid="' + esc(r.sid) + '" title="Message ' + esc(r.name) + '">' +
          '<img alt="" src="' + esc(r.avatar) + '"><div class="x360-fr-text"><div class="x360-fr-name">' + esc(r.name) + '</div>' +
          '<div class="x360-fr-status">' + esc(status) + '</div></div></div>';
      }
    }
    friendsEl.innerHTML = html;
  }

  // ---------- tag leftover dark-grey Steam panels in the library as glass ----------
  const tagged = new WeakSet();
  const GLASS_SKIP = '#x360-blades, #x360-friends, .LeftListSizableContainer, .LibraryItemBox, .DialogButton, .MenuButton, .PlayButton, ' +
    '.PlayBar, .ChooseButton, .ReviewThumbButton, .ScrollToTopButton, .PartnerEventFeatured, button, input, textarea, img, video, canvas, svg, ' +
    '[role="menu"], .contextMenu, .LibraryItemBoxShine, .RecentGameFooter';
  const RGB = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/;
  function firstColour(cs) {
    const image = cs.backgroundImage;
    let m;
    if (image && image !== 'none') { if (image.includes('url(')) return null; m = RGB.exec(image); }
    else m = RGB.exec(cs.backgroundColor);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  function tagGlass() {
    const panel = document.querySelector('.MainPanel');
    if (!panel) return;
    let budget = 1500;
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, {
      acceptNode: el => el.matches(GLASS_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let el = walker.nextNode(); el && budget > 0; el = walker.nextNode()) {
      if (tagged.has(el)) continue;
      tagged.add(el);
      budget--;
      const c = firstColour(getComputedStyle(el));
      if (!c || c.a < 0.5) continue;
      const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
      if (max > 125 || max - min > 45 || c.r + c.g + c.b < 20) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 24) continue;
      el.setAttribute('data-x360d', 'glass');
    }
  }

  function setBrowserVisible(visible) {
    try { browser()?.m_browser?.SetVisible?.(visible); } catch { }
  }
  function boot() {
    try { if (host.__x360DesktopBooted) return; host.__x360DesktopBooted = true; } catch { return; }
    document.body.classList.add('x360-booting');
    // the store/community view is a separate native layer, keep it hidden until the intro is over
    setBrowserVisible(false);
    const hideTimer = setInterval(() => setBrowserVisible(false), 100);
    const overlay = document.createElement('div');
    overlay.id = 'x360-boot';
    overlay.innerHTML = '<div class="x360-boot-ribbon r1"></div><div class="x360-boot-ribbon r2"></div><div class="x360-boot-ribbon r3"></div>' +
      '<div class="x360-boot-orb"><img alt="" src="https://steamloopback.host/steaminputglyphs/sc_button_steam.svg"></div>' +
      '<div class="x360-boot-word">STEAM <span>360</span></div>';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.classList.add('x360-boot-out');
      setTimeout(() => {
        clearInterval(hideTimer);
        overlay.remove();
        document.body.classList.remove('x360-booting');
        if (/^\/browser/.test(currentPath())) setBrowserVisible(true);
        resizeNudge();
      }, 800);
    };
    overlay.addEventListener('click', finish, { once: true });
    document.body.append(overlay);
    setTimeout(() => sound('x360_launch.wav', 0.8), 900);
    setTimeout(finish, 4300);
  }

  function sync() {
    if (stopped) return;
    const found = document.querySelector('.OuterFrame');
    const ready = !!(found && found.querySelector('.ContentFrame'));
    const path = currentPath();
    const off = !ready || !path || /^\/(login|init|oobe|update|shutdown|welcome)/.test(path);
    document.body.classList.toggle('x360d', !off);
    if (!ready) return;
    if (!nav) build();
    if (found !== frame || nav.parentElement !== found) {
      frame = found;
      frame.prepend(nav);
      active = -1;
      resizeNudge();
    }
    nav.hidden = off;
    if (off) return;
    applyGamesMode();
    updateCard();
    renderFriends();
    tagGlass();
    if (document.visibilityState === 'visible') boot();
    // Millennium's settings panel replaces the content panel: show it as the "system" blade while it's open
    const millennium = !!document.querySelector('.ContentFrame .PagedSettingsDialog') || (settingsMode() !== 'off' && !!settingsWindow());
    if (millennium !== !!document.body.dataset.x360Millennium) {
      if (millennium) { document.body.dataset.x360Millennium = String(active); select(SYSTEM); }
      else { const back = +document.body.dataset.x360Millennium; delete document.body.dataset.x360Millennium; select(bladeForPath(path) >= 0 ? bladeForPath(path) : back >= 0 ? back : HOME); }
      return;
    }
    if (millennium) return;
    const next = bladeForPath(path);
    if (performance.now() < pendingUntil) { if (next === active) pendingUntil = 0; return; }
    if (next >= 0 && next !== active) select(next);
    else if (active < 0) select(next >= 0 ? next : HOME);
  }

  // ---------- dashboard sounds on everything clickable in the window ----------
  const HOT = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], .DialogButton, .Focusable, .RootMenuButton, ' +
    '.AddGameButton, .FriendsButton, .DownloadStatusContent, .URLBarText, .ReloadButton, .x360-fr, .x360-card';
  const MENUS = '.RootMenuButton, .AccountMenu, .NotificationsButton, .SearchBar .MenuHeader, .CollectionBar';
  let hot = null, hotAt = 0;
  const onOver = event => {
    if (document.body.classList.contains('x360-booting')) return;
    const target = event.target?.closest?.(HOT);
    if (!target || target === hot || target.closest('#x360-blades > button')) return;
    hot = target;
    const now = performance.now();
    if (now - hotAt < 50) return;
    hotAt = now;
    sound('x360_focus.wav', 0.4);
  };
  const onClick = event => {
    const target = event.target?.closest?.(HOT);
    if (!target || target.closest('#x360-blades, #x360-friends')) return;
    if (target.closest(MENUS)) sound('x360_guide_open.wav', 0.55);
    else sound('x360_select.wav', 0.6);
  };
  const onBack = event => { if (event.button === 3) sound('x360_back.wav', 0.6); };
  // clicking the main window would bury the docked Settings window behind it, so raise it again,
  // but never while one of the title bar menus is open (raising it closes the menu)
  const menuOpen = () => {
    try {
      return [...host.g_PopupManager.GetPopups()].some(p => {
        try { return p.m_popup && /ContextMenuPopup/.test(p.m_popup.document.documentElement.className) && p.BIsVisible() && !p.BIsClosed(); } catch { return false; }
      });
    } catch { return false; }
  };
  let raiseTimer = 0;
  // ---- keep docked Settings above the main window, and the title bar dropdowns above Settings ----
  // Clicking the main window raises it over Settings. Raise Settings back without giving it focus
  // ("without forcing OS"), so a dropdown that is opening keeps focus, then lift any open dropdown on top.
  const RAISE_QUIET = 2; // k_EWindowBringToFrontWithoutForcingOS
  const settingsPopup = () => { try { return [...host.g_PopupManager.GetPopups()].find(p => p.m_popup && p.m_popup === settingsWindow()); } catch { return null; } };
  const openMenus = () => {
    try {
      return [...host.g_PopupManager.GetPopups()].filter(p => {
        try { return /ContextMenuPopup/.test(p.m_popup.document.documentElement.className) && p.BIsVisible() && !p.BIsClosed(); } catch { return false; }
      });
    } catch { return []; }
  };
  function raiseSettingsQuietly() {
    const p = settingsPopup();
    if (!p || !document.body.hasAttribute('data-x360-settings-open')) return;
    try { p.m_popup.SteamClient.Window.BringToFront(RAISE_QUIET); } catch { }
  }
  // a click in the main window brings it in front of Settings: put Settings straight back, before any
  // dropdown the click opens appears (so the dropdown still lands on top). Dropdowns are never touched.
  const onMainDown = () => raiseSettingsQuietly();
  document.addEventListener('mousedown', onMainDown, true);
  function keepSettingsOnTop() {
    const p = settingsPopup();
    if (!p || !document.body.hasAttribute('data-x360-settings-open')) return;
    if (openMenus().length) return; // leave everything alone while a dropdown is open
    let covered = false;
    try { covered = p.m_popup.document.visibilityState === 'hidden'; } catch { }
    if (covered && document.hasFocus()) raiseSettingsQuietly();
  }
  const focusTimer = setInterval(keepSettingsOnTop, 150);
  const menuTimer = 0;
  const onFocus = () => {
    clearTimeout(raiseTimer);
    const attempt = (tries) => {
      const w = settingsWindow();
      if (!w || !document.body.hasAttribute('data-x360-settings-open')) return;
      return; // handled by keepSettingsOnTop
      if (menuOpen()) { if (tries < 200) raiseTimer = setTimeout(() => attempt(tries + 1), 150); return; }
      if (!document.hasFocus()) return; // focus went to a menu, dialog or other window
      try { w.SteamClient.Window.BringToFront(); } catch { }
    };
    raiseTimer = setTimeout(() => attempt(0), 250);
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseup', onBack, true);

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; sync(); }, 120);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(sync, 1000);
  hookPopups();
  const popupTimer = setInterval(() => { hookPopups(); tendPopups(); }, 400);
  let lastRect = '';
  const boundsTimer = setInterval(() => {
    const el = document.querySelector('.BrowserWrapper .Browser');
    const r = el?.getBoundingClientRect();
    const key = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() : '';
    if (key !== lastRect) { lastRect = key; syncBrowserBounds(); }
  }, 250);
  const onVisible = () => sync();
  document.addEventListener('visibilitychange', onVisible);

  window.__x360DesktopStop = () => {
    stopped = true;
    observer.disconnect();
    clearInterval(timer);
    clearInterval(boundsTimer);
    clearInterval(popupTimer);
    unhookPopups();
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mouseup', onBack, true);
    window.removeEventListener('focus', onFocus);
    clearInterval(focusTimer);
    clearInterval(menuTimer);
    document.removeEventListener('mousedown', onMainDown, true);
    clearTimeout(raiseTimer);
    clearInterval(focusTimer);
    nav?.remove();
    friendsEl?.remove();
    document.body.classList.remove('x360d');
    delete document.body.dataset.blade;
    delete document.body.dataset.x360Games;
    delete document.body.dataset.x360Millennium;
    document.body.removeAttribute('data-x360-settings-open');
    delete document.body.dataset.x360Slide;
    window.__x360DesktopStop = undefined;
  };
  window.addEventListener('pagehide', () => window.__x360DesktopStop?.(), { once: true });
  sync();
})();
