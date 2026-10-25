export const PLAYER_TRIBES = Object.freeze([
  { key: "bean", name: "새싹콩", nest: "DesignAssets/Nests/nest-stage-01.png",
    idle: "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp", frames: 64, frameMs: 100 },
  ...[["spore", "포자버섯"], ["pebble", "몽돌"], ["spring", "샘방울"]].map(([key, name]) => ({
    key, name, nest: `DesignAssets/Tribes/${key}/Nests/nest-stage-01.png`,
    idle: key === "spore" ? "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp" :
      `DesignAssets/Tribes/${key}/Animations/Units/idle/idle.webp`,
    frames: key === "spore" ? 64 : 16, frameMs: key === "spore" ? 100 : 140,
    starter: `DesignAssets/Tribes/${key}/starter.png`,
    body: `DesignAssets/Tribes/${key}/BaseParts/body.png`,
    manifest: `DesignAssets/Tribes/${key}/manifest.json`,
    parts: ["shell-1", "shell-2"].map(part =>
      `DesignAssets/Tribes/${key}/${key === "spring" ? "Units/Parts" : "Parts"}/${part}.png`)
  }))
].map(tribe => Object.freeze(tribe)));

export const PLAYER_TRIBE_ASSETS = Object.freeze(PLAYER_TRIBES.flatMap(tribe =>
  [tribe.nest, tribe.idle, tribe.starter, tribe.body, tribe.manifest, ...(tribe.parts || [])].filter(Boolean)));
