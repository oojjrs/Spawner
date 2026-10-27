export const PLAYER_TRIBES = Object.freeze([
  { key: "bean", name: "새싹콩", nest: "DesignAssets/Nests/nest-stage-01.png",
    idle: "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp", frames: 64, frameMs: 100 },
  ...[["spore", "포자버섯"], ["pebble", "몽돌"], ["spring", "샘방울"]].map(([key, name]) => ({
    key, name, nest: `DesignAssets/Tribes/${key}/Nests/nest-stage-01.png`,
    idle: `DesignAssets/Tribes/${key}/AnimationStudies/idle-${key === "spore" ? "v8" : key === "pebble" ? "v3" : "v4"}/idle-${key === "spore" ? "v8" : key === "pebble" ? "v3" : "v4"}.webp`,
    frames: 64, frameMs: 100,
    starter: `DesignAssets/Tribes/${key}/starter.png`,
    body: `DesignAssets/Tribes/${key}/BaseParts/body.png`,
    manifest: `DesignAssets/Tribes/${key}/manifest.json`,
    parts: []
  }))
].map(tribe => Object.freeze(tribe)));

export const PLAYER_TRIBE_ASSETS = Object.freeze(PLAYER_TRIBES.flatMap(tribe =>
  [tribe.nest, tribe.idle, tribe.starter, tribe.body, tribe.manifest, ...(tribe.parts || [])].filter(Boolean)));
