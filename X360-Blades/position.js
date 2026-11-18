(() => {
  if (!/steamloopback\.host$/.test(location.hostname)) return;
  const channel = new BroadcastChannel("nxe-achievement-position-v1");
  const active = new Map();
  const token = crypto.randomUUID();
  const selector = "._3YTh805w3-xgPkHE_22XcA:has(.mJ3Nu2ja1CSqf_qU1GD_b):not(:has(._6MT2UJrz5bk1FX-saHB-i))";
  let current;
  function mark(id, visible) {
    clearTimeout(active.get(id));
    active.delete(id);
    if (visible) active.set(id, setTimeout(() => mark(id, false), 15000));
    document.documentElement.toggleAttribute("data-nxe-achievement", active.size > 0);
  }
  channel.onmessage = ({data}) => {
    if (typeof data?.id === "string" && typeof data.visible === "boolean") mark(data.id, data.visible);
  };
  function update() {
    const toast = document.querySelector(selector);
    if (toast === current) return;
    current = toast;
    mark(token, !!toast);
    channel.postMessage({id:token, visible:!!toast});
  }
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  update();
  window.addEventListener("pagehide", () => {
    observer.disconnect();
    channel.postMessage({id:token, visible:false});
    channel.close();
  }, {once:true});
})();
