import { resourceDefinition, resourceHarvestMultiplier } from "../server/resources.mjs";

export function attributeEffect(attribute, level, tribe) {
  const effect = attribute.effect;
  if (!attribute.harvests?.length) return effect;
  const resource = resourceDefinition(attribute.harvests[0]);
  const multiplier = resourceHarvestMultiplier(resource.key, { [attribute.key]: level }, tribe);
  return [effect, multiplier < 1 ? resource.name + " 채집 시간 −" + Math.round((1 - multiplier) * 100) + "%" : ""].filter(Boolean).join(" · ") || "채집 가능";
}

export function createHealthIcon(source) {
  const image = document.createElement("img");
  image.src = source("DesignAssets/UI/hp-heart.png");
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}
