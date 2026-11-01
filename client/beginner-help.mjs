export function createBeginnerHelp(document, onAction) {
  const panel = document.getElementById("beginner-help"), button = document.getElementById("beginner-construction");
  const message = document.getElementById("beginner-help-message"), text = document.createElement("span"), details = document.createElement("small");
  details.style.display = "block"; details.style.opacity = ".8";
  message.replaceChildren(text, details);
  let view = null, pending = false;
  function render() {
    const offer = view?.offer;
    panel.hidden = !view?.active || !offer;
    if (panel.hidden) return;
    const last = offer.buildingName.charCodeAt(offer.buildingName.length - 1) - 0xac00;
    const particle = last >= 0 && last <= 11171 && last % 28 ? "을" : "를";
    const content = offer.kind === "upgrade" ? "둥지를 성장시킬 수 있습니다." :
      offer.kind === "military" ? "확장한 영역을 지킬 군사 개체를 준비해볼까요?" : offer.buildingName + particle + " 마련할 개체를 준비해볼까요?";
    if (text.textContent !== content) text.textContent = content;
    const requirements = offer.kind === "upgrade" ? "Lv." + (offer.level - 1) + " → Lv." + offer.level : (offer.requirements || []).filter(item => offer.kind === "harvest" ? item.missing > 0 : item.amount > 0).map(item => item.name + " " + (offer.kind === "harvest" ? item.missing : item.amount))
      .concat(offer.attributes || []).join(" · ");
    if (details.textContent !== requirements) details.textContent = requirements;
    details.hidden = !requirements;
    const label = offer.name + (offer.kind === "upgrade" ? " · " : " 생산 · ") + offer.cost + "P";
    if (button.textContent !== label) button.textContent = label;
    button.disabled = pending || view.busy || !offer.canProduce;
    button.title = offer.issue || "";
    panel.setAttribute("aria-busy", String(pending || view.busy));
  }
  button.addEventListener("click", async () => {
    if (pending || button.disabled || panel.hidden) return;
    const roomId = view.roomId, offered = view.offer;
    pending = true; render();
    try {
      const result = await onAction(offered);
      if ((result?.agentId || offered.kind === "upgrade" && result?.nestLevel === offered.level) &&
          view.roomId === roomId && view.offer?.step === offered.step) view = {...view,offer:null};
    } finally { pending = false; render(); }
  });
  return {update(roomId, offer, active, busy) {view = {roomId,offer,active,busy}; render();}};
}
