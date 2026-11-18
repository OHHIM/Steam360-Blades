(() => {
  // Xbox 360 Blades: Steam's desktop popup windows (dialogs, chat) take the colour of the blade you're on,
  if (window.__x360Popup) return;
  const html = document.documentElement;
  if (!html || !/ModalDialogPopup|ChatPopup|SavedDimensionsPopup/.test(html.className)) return;
  window.__x360Popup = true;
  const host = (() => { try { return window.opener || window; } catch { return window; } })();
  const read = () => {
    let blade;
    try { blade = host.__x360Blade; } catch { }
    if (blade && html.dataset.x360Blade !== String(blade)) html.dataset.x360Blade = String(blade);
  };
  read();
  setInterval(read, 1000);

})();
