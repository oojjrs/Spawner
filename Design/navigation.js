const designAnchors = {"world": "world", "world-map-preview": "world", "map-canvas": "world", "map-progress": "world", "map-controls": "world", "map-seed": "world", "map-apply": "world", "map-prev": "world", "map-next": "world", "map-grid": "world", "map-camp-type": "world", "map-resource-type": "world", "map-resource-key": "world", "map-water-type": "world", "map-water-key": "world", "map-unit-count": "world", "map-unit-type": "world", "map-logic": "world", "map-logic-title": "world", "map-logic-body": "world", "conquest-rules": "world", "world-encounter-rules": "world", "map-encounter-rule-rows": "world", "map-mountain-textures": "world", "design-world-model": "world", "design-world-view": "world", "art-terrain": "art-terrain", "terrain-floors": "art-terrain", "terrain-objects": "art-terrain", "terrain-overlays": "art-terrain", "terrain-layer-order": "art-terrain", "codex-units": "codex-units", "codex-unit-appearance": "codex-units", "attribute-images-style": "codex-units", "approved-tribes-art": "codex-units", "tribe-ecology": "codex-units", "world-creatures": "codex-units", "unit-sprout-runtime": "codex-units", "tribes-idle-study": "codex-units", "approved-tribes-movement": "codex-units", "tribes-attack-study": "codex-units", "tribes-hurt-study": "codex-units", "tribes-death-study": "codex-units", "unit-sprout-bean": "codex-units", "unit-spore-tribe": "codex-units", "unit-pebble-tribe": "codex-units", "unit-spring-tribe": "codex-units", "attribute-blade": "codex-units", "attribute-piercing": "codex-units", "attribute-carapace": "codex-units", "unit-spiny-back-beetle": "codex-units", "unit-flower-tail-bird": "codex-units", "unit-dew-rabbit": "codex-units", "unit-soil-mole": "codex-units", "unit-bundle-snail": "codex-units", "unit-cotton-sheep": "codex-units", "unit-rolling-acorn": "codex-units", "unit-soil-boar": "codex-units", "unit-bubble-toad": "codex-units", "unit-vine-turtle": "codex-units", "unit-shadow-weasel": "codex-units", "unit-snare-vine": "codex-units", "unit-talon-owl": "codex-units", "unit-spring-keeper": "codex-units", "unit-lantern-keeper": "codex-units", "unit-old-garden-snail": "codex-units", "unit-walking-forest": "codex-units", "unit-white-paw": "codex-units", "unit-spiny-back-leader": "codex-units", "combat-attributes-playback": "codex-units", "codex-unit-tiers": "codex-unit-tiers", "neutral-unit-stats": "codex-unit-tiers", "neutral-unit-stat-design": "codex-unit-tiers", "neutral-unit-tiers": "codex-unit-tiers", "neutral-unit-tier-design": "codex-unit-tiers", "tier-unit-name-1": "codex-unit-tiers", "tier-unit-name-2": "codex-unit-tiers", "tier-unit-name-3": "codex-unit-tiers", "tier-unit-name-4": "codex-unit-tiers", "tier-unit-name-5": "codex-unit-tiers", "tier-unit-name-6": "codex-unit-tiers", "tier-unit-name-7": "codex-unit-tiers", "tier-unit-name-8": "codex-unit-tiers", "tier-unit-name-9": "codex-unit-tiers", "tier-unit-name-10": "codex-unit-tiers", "tier-unit-name-11": "codex-unit-tiers", "tier-unit-name-12": "codex-unit-tiers", "tier-unit-name-13": "codex-unit-tiers", "tier-unit-name-14": "codex-unit-tiers", "tier-unit-name-15": "codex-unit-tiers", "tier-unit-name-16": "codex-unit-tiers", "tier-unit-name-17": "codex-unit-tiers", "tier-unit-name-18": "codex-unit-tiers", "tier-unit-name-19": "codex-unit-tiers", "codex-food": "codex-food", "art-food-plan": "codex-food", "art-food": "codex-food", "art-resource-plan": "codex-food", "codex-attributes": "codex-attributes", "dna-catalog-style": "codex-attributes", "codex-nest": "codex-nest", "additional-tribe-nests": "codex-nest", "nest-sprout-tribe": "codex-nest", "nest-spore-tribe": "codex-nest", "nest-pebble-tribe": "codex-nest", "nest-spring-tribe": "codex-nest"};
(() => {
  const frame = document.getElementById("design-frame");
  let current = null;
  function activate() {
    const id = decodeURIComponent(location.hash.slice(1)) || "world";
    const page = designAnchors[id] || "world";
    if (page !== current) {
      frame.src = "Design/" + page + ".html#" + encodeURIComponent(id);
      current = page;
    } else if (frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "spawner-design-anchor", id }, "*");
    }
    for (const link of document.querySelectorAll(".side-nav a")) {
      const selected = link.hash === "#" + page;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }
  window.addEventListener("message", event => {
    if (event.source === frame.contentWindow && event.data?.type === "spawner-design-route" && designAnchors[event.data.id]) location.hash = event.data.id;
  });
  window.addEventListener("hashchange", activate);
  frame.addEventListener("load", activate);
  activate();
})();
