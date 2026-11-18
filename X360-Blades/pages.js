(() => {
  if (window.__x360PagesStop) window.__x360PagesStop();
  const RGB = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g;
  function colours(value) {
    const out = [];
    RGB.lastIndex = 0;
    for (let m; (m = RGB.exec(value || ''));) out.push({ r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] });
    return out;
  }
  const isNavy = c => c.a >= 0.25 && Math.max(c.r, c.g, c.b) <= 130 && c.b >= c.r && c.b >= c.g - 6 && (c.r + c.g + c.b) > 12 && (c.b - c.r >= 5 || c.b < 60);
  const isBlue = c => c.a >= 0.5 && c.b >= 170 && c.r <= 130 && c.g >= 90 && c.b - c.r >= 80;
  const isDim = c => c.a >= 0.5 && Math.max(c.r, c.g, c.b) >= 85 && Math.max(c.r, c.g, c.b) <= 205 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 70;
  const SKIP = '#x360-blades, .x360-profile-panel, #x360-boot, #x360-defs, #header, #Footer, .BackgroundGlass, .Toggle, .DialogButton, ' +
    '.Tab, .TabHeaderRowWrapper, .PagedSettingsDialog_PageListItem, .MenuButton, .PlayButton, .BasicContextMenuContainer, .contextMenu, ' +
    '.LibraryItemBox, .GreyBackground, .FocusRingRoot, .ModalOverlayBackground, #MainNavMenuContainer, .QuickAccessMenu > .Tabs, ' +
    '[class*="VirtualKeyboard"], [class*="virtualkeyboard"], video, canvas, img, svg, iframe, [data-x360-skip]';
  const isLight = c => c.a >= 0.6 && Math.min(c.r, c.g, c.b) >= 190;
  const FRAME = 'html, body, .BasicUiRoot, #MainNavMenu-Rest, #GamepadUI_Full_Root, #Main, #popup_target, #QuickAccess-Menu';
  function classify(el, win) {
    if (el.matches(FRAME)) return;
    const cs = win.getComputedStyle(el);
    if (cs.display === 'none') return;
    const image = cs.backgroundImage;
    let list = null;
    if (image && image !== 'none') { if (!image.includes('url(') && image.includes('gradient')) list = colours(image); }
    else list = colours(cs.backgroundColor);
    const painted = list ? list.filter(c => c.a >= 0.25) : [];
    if (painted.length) {
      const rect = el.getBoundingClientRect();
      const blue = painted.every(isBlue);
      if (rect.height >= 3 && rect.width >= (blue ? 8 : 24)) {
        const doc = el.ownerDocument;
        const frame = (doc.getElementById('Main') || doc.documentElement).getBoundingClientRect();
        const thin = rect.height <= 14 && rect.width >= 40;
        let kind = '';
        if (painted.every(isLight)) {
          if (rect.width >= 60 && rect.height >= 18 && rect.height <= 220 && el.matches('.gpfocus, .Focusable.Active, .Focusable.Selected')) kind = 'focus';
        } else if (blue) {
          kind = thin ? 'fill' : (rect.width <= 520 && rect.height <= 90 ? 'plate' : 'glass');
        } else if (painted.every(isNavy)) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') kind = 'field';
          else if (thin) kind = 'track';
          else if (rect.width * rect.height >= frame.width * frame.height * 0.5 || (rect.width >= frame.width * 0.95 && rect.height >= 150)) kind = 'clear';
          else kind = 'glass';
        }
        if (kind) el.setAttribute('data-x360-bg', kind);
      }
    }
    const fg = colours(cs.color)[0];
    if (fg && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      if (isBlue(fg)) el.setAttribute('data-x360-fg', 'accent');
      else if (isDim(fg)) el.setAttribute('data-x360-fg', 'dim');
    }
  }
  const watched = new Map();
  let queue = [], scheduled = false, stopped = false;
  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    setTimeout(drain, 60);
  }
  function enqueue(root) {
    if (!root || root.nodeType !== 1 || !root.isConnected) return;
    if (root.closest(SKIP)) return;
    queue.push(root);
    schedule();
  }
  function drain() {
    scheduled = false;
    const started = performance.now();
    let budget = 700;
    while (queue.length && budget > 0 && performance.now() - started < 8) {
      const root = queue.shift();
      if (!root.isConnected) continue;
      const doc = root.ownerDocument, win = doc.defaultView;
      if (!win) continue;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, { acceptNode: el => el.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      let el = root;
      while (el && budget > 0) {
        if (!el.hasAttribute('data-x360-bg')) { classify(el, win); budget--; }
        el = walker.nextNode();
      }
      if (el) { queue.unshift(el); break; }
    }
    if (queue.length) schedule();
  }
  function recheck(el) {
    if (!el.isConnected) return;
    const win = el.ownerDocument.defaultView;
    if (!win) return;
    const before = el.style.getPropertyValue('transition'), priority = el.style.getPropertyPriority('transition');
    el.style.setProperty('transition', 'none', 'important');
    el.removeAttribute('data-x360-bg');
    el.removeAttribute('data-x360-fg');
    if (!el.closest(SKIP)) classify(el, win);
    void win.getComputedStyle(el).backgroundColor;
    if (before) el.style.setProperty('transition', before, priority); else el.style.removeProperty('transition');
  }
  function onHover(event) {
    const el = event.target?.closest?.('.Focusable, [role="button"], [role="menuitem"]');
    if (!el || el.hasAttribute('data-x360-hover') || el.closest(SKIP) || el.matches(FRAME)) return;
    setTimeout(() => {
      if (!el.isConnected || !el.matches(':hover')) return;
      const win = el.ownerDocument.defaultView;
      if (!win) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 220 || rect.width < 40) return;
      const cs = win.getComputedStyle(el);
      const image = cs.backgroundImage;
      const list = image && image !== 'none' ? (image.includes('url(') ? [] : colours(image)) : colours(cs.backgroundColor);
      const painted = list.filter(c => c.a >= 0.25);
      if (painted.length && (painted.every(isNavy) || painted.every(isLight) || painted.every(isBlue))) el.setAttribute('data-x360-hover', '');
    }, 260);
  }
  function watch(doc) {
    if (!doc?.body || watched.has(doc)) return;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const el = record.target;
          if (el.hasAttribute?.('data-x360-bg') || el.hasAttribute?.('data-x360-fg') || el.classList?.contains('gpfocus')) recheck(el);
          continue;
        }
        for (const node of record.addedNodes) enqueue(node);
      }
    });
    observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    watched.set(doc, observer);
    doc.addEventListener('mouseover', onHover, true);
    enqueue(doc.body);
  }
  function watchPopups() {
    let trees = [];
    try { trees = ((window.opener || window).SteamUIStore?.WindowStore?.GamepadUIMainWindowInstance?.m_FocusNavContext?.m_rgGamepadNavigationTrees) || []; } catch { return; }
    for (const tree of trees) {
      let doc;
      try { doc = tree?.m_window?.document; } catch { continue; }
      if (doc && doc !== document) watch(doc);
    }
    for (const doc of watched.keys()) if (!doc.defaultView) { watched.get(doc).disconnect(); watched.delete(doc); }
  }
  watch(document);
  watchPopups();
  const timer = setInterval(watchPopups, 1500);
  window.__x360PagesStop = () => {
    stopped = true;
    clearInterval(timer);
    for (const [doc, observer] of watched) {
      observer.disconnect();
      try { doc.removeEventListener('mouseover', onHover, true); } catch {  }
      try { for (const el of doc.querySelectorAll('[data-x360-bg], [data-x360-fg], [data-x360-hover]')) { el.removeAttribute('data-x360-bg'); el.removeAttribute('data-x360-fg'); el.removeAttribute('data-x360-hover'); } } catch {  }
    }
    watched.clear();
  };
  window.addEventListener('pagehide', () => window.__x360PagesStop?.(), { once: true });
})();
