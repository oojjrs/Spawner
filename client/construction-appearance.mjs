const root = "DesignAssets/Animations/Construction/v5/";

export const CONSTRUCTION_APPEARANCE_ASSETS = Object.freeze(["DesignAssets/Animations/Construction/v9/manifest.json",
  ...["bean", "spore", "pebble", "spring"].flatMap(tribe => [tribe === "bean" ? "DesignAssets/Animations/Construction/v7/bean/neutral.png" : root + tribe + "/neutral.png", root + tribe + "/unit-parts.webp",
    tribe === "bean" ? "DesignAssets/Animations/Construction/v9/bean/outpost-parts.webp" : root + tribe + "/stages.webp"])]);

export function createConstructionAppearance(assetSource, createSurface, loadImage) {
  const ready = new Map(), pending = new Map();
  let data = null, loading = null;

  function prepare(tribe) {
    if (!pending.has(tribe)) pending.set(tribe, (async () => {
      loading ||= fetch(assetSource(CONSTRUCTION_APPEARANCE_ASSETS[0])).then(response => {
        if (!response.ok) throw new Error("변태 외형 정보를 불러오지 못했습니다.");
        return response.json();
      });
      data = await loading;
      const rig = data.units[tribe];
      const [image, partsImage, growthImage] = await Promise.all([loadImage(rig.image), loadImage(rig.sheet), loadImage(rig.growth.image)]);
      const sprite = createSurface(512, 512);
      sprite.getContext("2d").drawImage(image, 0, 0, 512, 512);
      ready.set(tribe, { sprite, track: rig.track, rig, partsImage, growthImage });
      return true;
    })().catch(error => { pending.delete(tribe); throw error; }));
    return pending.get(tribe);
  }

  function unit(tribe) { return ready.get(tribe) || null; }

  function frame(tribe, pose) {
    const base = unit(tribe);
    return base ? { ...base, frame: (pose.action === "walk" ? 16 : 0) + Math.floor(pose.phase * 16) } : null;
  }

  return { prepare, unit, frame, manifest: () => data };
}
