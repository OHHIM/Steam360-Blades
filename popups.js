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
  // an SVG gradient the CSS can paint icons with: fill: url(#x360-green)
  const defs = () => {
    if (!document.body || document.getElementById('x360-defs-green')) return;
    const holder = document.createElement('div');
    holder.innerHTML = '<svg id="x360-defs-green" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="x360-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9d43c"/><stop offset="1" stop-color="#5a9612"/></linearGradient>' +
      '</defs></svg>';
    document.body.append(holder.firstChild);
  };
  read();
  defs();
  setInterval(() => { read(); defs(); }, 1000);

})();
