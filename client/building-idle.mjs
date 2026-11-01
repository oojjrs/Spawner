import { BUILDING_TYPES, buildingDefinition } from "../server/buildings.mjs";

const root = tribe => "DesignAssets/Animations/Buildings/" + (tribe === "bean" ? "BeanIdleV2" : tribe === "spring" ? "IdleV4" : "IdleV1") + "/";
const tribes = ["bean", "spore", "pebble", "spring"];

export const BUILDING_IDLE_ASSETS = Object.freeze(tribes.flatMap(tribe =>
  BUILDING_TYPES.map(building => root(tribe) + tribe + "/" + building.key + "/idle.webp")));

const watchpostBounds = Object.freeze({
  bean: [79, 41, 274, 242], spore: [76, 17, 280, 394],
  pebble: [87, 22, 258, 388], spring: [139, 23, 154, 386]
});

export function buildingPlacement(building) {
  if (building.key !== "watchpost") return { x: 0, y: 0, width: 1, height: 1 };
  const bounds = watchpostBounds[building.tribe] || watchpostBounds.bean;
  const size = .84 * 432 / bounds[3];
  return { x: .5 - (bounds[0] + bounds[2] / 2) / 432 * size,
    y: .94 - (bounds[1] + bounds[3]) / 432 * size, width: size, height: size };
}

export function createBuildingPreview(building, source) {
  const canvas = document.createElement("canvas"), image = new Image();
  canvas.width = canvas.height = 432;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", buildingDefinition(building.key).name);
  image.addEventListener("load", () => {
    const placement = buildingPlacement(building), context = canvas.getContext("2d");
    context.clearRect(0, 0, 432, 432);
    context.drawImage(image, placement.x * 432, placement.y * 432, placement.width * 432, placement.height * 432);
  }, { once: true });
  image.src = source;
  return canvas;
}

export function buildingIdleFrame(building, time, reducedMotion) {
  if (!buildingDefinition(building.key) || building.health <= 0) return null;
  const tribe = tribes.includes(building.tribe) ? building.tribe : "bean";
  const elapsed = Math.max(0, (Number.isFinite(time) ? time : 0) - (building.completedAt || 0));
  const frame = reducedMotion ? 0 : Math.floor(elapsed * 10 + .000001) % 48;
  return { key: tribe + ":" + building.key, path: root(tribe) + tribe + "/" + building.key + "/idle.webp",
    frame, x: frame % 8 * 432, y: Math.floor(frame / 8) * 432, width: 432, height: 432 };
}

export function createBuildingIdleAnimation(loadImage, onError) {
  const ready = new Map(), pending = new Map(), failures = new Set();

  function prepare(building) {
    const pose = buildingIdleFrame(building, 0, true);
    if (!pose || failures.has(pose.key)) return Promise.resolve(false);
    if (ready.has(pose.key)) return Promise.resolve(true);
    if (!pending.has(pose.key)) pending.set(pose.key, loadImage(pose.path).then(image => {
      ready.set(pose.key, image); pending.delete(pose.key); return true;
    }).catch(error => {
      pending.delete(pose.key); failures.add(pose.key);
      if (typeof onError === "function") onError(error);
      return false;
    }));
    return pending.get(pose.key);
  }

  function frame(building, time, reducedMotion) {
    const pose = buildingIdleFrame(building, time, reducedMotion);
    if (!pose) return null;
    const image = ready.get(pose.key);
    if (!image) { prepare(building); return null; }
    return { ...pose, image };
  }

  return { prepare, frame };
}
