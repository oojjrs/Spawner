(() => {
  function position(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const margin = 10, gap = 8;
    tooltip.style.maxWidth = Math.max(0, window.innerWidth - margin * 2) + "px";
    const above = Math.max(0, rect.top - margin - gap);
    const below = Math.max(0, window.innerHeight - margin - rect.bottom - gap);
    const height = tooltip.scrollHeight + tooltip.offsetHeight - tooltip.clientHeight;
    const onTop = height <= above || height > below && above >= below;
    tooltip.style.maxHeight = (onTop ? above : below) + "px";
    const width = tooltip.offsetWidth;
    tooltip.style.left = Math.max(margin, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - margin)) + "px";
    tooltip.style.top = (onTop ? rect.top - tooltip.offsetHeight - gap : rect.bottom + gap) + "px";
    tooltip.dataset.placement = onTop ? "top" : "bottom";
  }

  function positionPointer(tooltip, pointer) {
    const margin = 10, gap = 16;
    tooltip.style.maxWidth = Math.max(0, window.innerWidth - margin * 2) + "px";
    tooltip.style.maxHeight = Math.max(0, window.innerHeight - margin * 2) + "px";
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const right = pointer.clientX + gap, below = pointer.clientY + gap;
    const left = right + width <= window.innerWidth - margin ? right : pointer.clientX - width - gap;
    const top = below + height <= window.innerHeight - margin ? below : pointer.clientY - height - gap;
    tooltip.style.left = Math.max(margin, Math.min(left, window.innerWidth - width - margin)) + "px";
    tooltip.style.top = Math.max(margin, Math.min(top, window.innerHeight - height - margin)) + "px";
  }

  const tooltip = document.createElement("div");
  tooltip.id = "control-tooltip";
  tooltip.className = "control-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  let target = null;

  function hide() {
    if (target) {
      const ids = (target.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== tooltip.id);
      if (ids.length) target.setAttribute("aria-describedby", ids.join(" "));
      else target.removeAttribute("aria-describedby");
    }
    target = null;
    tooltip.hidden = true;
  }

  function show(element) {
    if (!element?.dataset.tooltip || element.closest("[data-help]")) { hide(); return; }
    if (target !== element) hide();
    target = element;
    const host = target.closest("dialog[open]") || document.body;
    if (tooltip.parentElement !== host) host.append(tooltip);
    tooltip.textContent = target.dataset.tooltip;
    tooltip.hidden = false;
    const ids = new Set((target.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    ids.add(tooltip.id);
    target.setAttribute("aria-describedby", [...ids].join(" "));
    position(tooltip, target);
  }

  function convert(element) {
    if (!(element instanceof HTMLElement) || !element.hasAttribute("title")) return;
    const text = element.getAttribute("title");
    if (text) element.dataset.tooltip = text;
    else delete element.dataset.tooltip;
    element.removeAttribute("title");
    if (element === target) show(element);
  }

  function scan(root) {
    convert(root);
    for (const element of root.querySelectorAll("[title]")) convert(element);
  }

  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") convert(record.target);
      else for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
    }
    if (target && !target.isConnected) hide();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });

  document.addEventListener("pointerover", event => {
    if (event.pointerType === "touch") return;
    const element = event.target.closest("[data-tooltip]");
    if (element && element !== target) show(element);
  });
  document.addEventListener("pointerout", event => {
    if (target?.contains(event.target) && !target.contains(event.relatedTarget)) hide();
  });
  document.addEventListener("focusin", event => {
    const element = event.target.closest("[data-tooltip]");
    if (element) show(element);
  });
  document.addEventListener("focusout", event => {
    if (target?.contains(event.target) && !target.contains(event.relatedTarget)) hide();
  });
  document.addEventListener("pointerdown", hide);
  document.addEventListener("keydown", event => { if (event.key === "Escape") hide(); });
  document.addEventListener("scroll", hide, true);
  document.addEventListener("close", hide, true);
  window.addEventListener("resize", hide);
  globalThis.SpawnerTooltips = { position, positionPointer };
})();
