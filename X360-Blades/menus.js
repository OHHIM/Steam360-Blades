(() => {
  // Xbox 360 Blades: dashboard sounds in Steam's desktop popup menus and the Settings window.
  if (window.__x360MenuSounds || !document.documentElement) return;
  window.__x360MenuSounds = true;
  const BASE = 'https://steamloopback.host/sounds/';
  const HOT = '.contextMenuItem, [role="menuitem"], [role="menuitemcheckbox"], [role="option"], [role="tab"], button, a[href], ' +
    '.DialogButton, .PagedSettingsDialog_PageListItem, .Toggle, .DialogDropDown, .Focusable';
  const audio = {};
  let last = null, lastAt = 0;
  function sound(file, volume) {
    try {
      const a = audio[file] ||= Object.assign(new Audio(BASE + file), { preload: 'auto' });
      a.volume = volume;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch { }
  }
  document.addEventListener('mouseover', event => {
    const target = event.target?.closest?.(HOT);
    if (!target || target === last) return;
    last = target;
    const now = performance.now();
    if (now - lastAt < 50) return;
    lastAt = now;
    sound('x360_focus.wav', 0.4);
  }, true);
  document.addEventListener('click', event => {
    if (event.target?.closest?.(HOT)) sound('x360_select.wav', 0.6);
  }, true);
})();
