import { createHillslopeFlow } from "./landscape-processes.mjs";
import { recordPlacementMap } from "./placement-maps.mjs";

function bounded(value) { return Math.max(0, Math.min(1, value)); }



export function createLandscapeHabitats(world) {
  const { size, terrain, hydrology: h } = world, length = terrain.length;
  const hillslopeFlow = createHillslopeFlow(h.ground, h.rainfall, size, h.seaLevel, h.water);
  const fields = Object.fromEntries(["rainfall", "soilMoisture", "soilDepth", "soilFertility", "forestCover", "exposure", "parentRock", "sandySoil", "shelter", "terrainPosition", "topographicWetness"].map(key => [key, new Float32Array(length)]));
  const mountainDistance = new Uint8Array(length).fill(255), queue = new Int32Array(length);
  let end = 0;
  for (let index = 0; index < length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) { mountainDistance[index] = 0; queue[end++] = index; }
  for (let cursor = 0; cursor < end; cursor++) {
    const index = queue[cursor], x = index % size, y = Math.floor(index / size);
    if (mountainDistance[index] >= 12) continue;
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (mountainDistance[next] <= mountainDistance[index] + 1) continue;
      mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;
    }
  }
  for (let index = 0; index < length; index++) {
    const x = index % size, y = Math.floor(index / size), ground = h.ground[index];
    let neighbors = 0, samples = 0, canopy = 0, mean = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (x+dx < 0 || y+dy < 0 || x+dx >= size || y+dy >= size) continue;
      canopy += h.forestMask?.[(y+dy)*size+x+dx] ? 1 : 0; samples++;
    }
    for (const radius of [6, 18]) for (const [dx,dy] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,radius],[-radius,radius],[radius,-radius]]) {
      const nx = Math.max(0,Math.min(size-1,x+dx)),ny = Math.max(0,Math.min(size-1,y+dy));
      mean += h.ground[ny*size+nx]; neighbors++;
    }
    const position = mean/neighbors-ground, slope = bounded(h.slope[index]*14), mountain = terrain[index]>=6&&terrain[index]<=8?1:0;
    fields.parentRock[index] = h.bedrock[index];
    fields.terrainPosition[index] = position;
    fields.rainfall[index] = bounded((h.rainfall[index]-.25)/1.3);
    fields.shelter[index] = bounded(.5+position*5-slope*.15);
    fields.exposure[index] = bounded(.15+slope*.5+bounded(h.uplift[index]*.7)*.2-fields.shelter[index]*.1);
    const convergence = bounded((Math.log1p(hillslopeFlow[index])-Math.log(.002+h.slope[index])-4)/6);
    fields.topographicWetness[index] = convergence;
    fields.soilMoisture[index] = bounded(.16+fields.rainfall[index]*.6+fields.shelter[index]*.15+h.wetness[index]*.25+
      convergence*.18-fields.exposure[index]*.18-fields.parentRock[index]*.04);
    fields.soilDepth[index] = bounded(.14+fields.rainfall[index]*.4+fields.shelter[index]*.32+(1-fields.exposure[index])*.2+
      Math.min(.15,h.fertility[index]*.3)-bounded(h.uplift[index])*.15);
    fields.sandySoil[index] = bounded((1-fields.parentRock[index])*.65+h.sand[index]*1.2-fields.soilDepth[index]*.2);
    fields.forestCover[index] = canopy/samples;
    fields.soilFertility[index] = bounded(fields.soilDepth[index]*(.35+fields.parentRock[index]*.35+fields.forestCover[index]*.3)+h.fertility[index]*.3);
  }
  for (const [key,values] of Object.entries(fields)) recordPlacementMap(h,"habitat:"+key,["forest","swamp","resources"],values,
    {stage:"intermediate",...(key==='terrainPosition'?{}:{minimum:0,maximum:1})});
  recordPlacementMap(h,"habitat:mountain-distance",["mountains","resources"],mountainDistance,{minimum:0,maximum:12,excluded:255,stage:"intermediate"});
  recordPlacementMap(h,"habitat:hillslope-flow",["forest","swamp","resources"],hillslopeFlow,{minimum:0,logarithmic:true,stage:"intermediate"});
  return {...fields,mountainDistance,hillslopeFlow};
}

export function distributeLandscapeBiomes(world, fields) {
  const { terrain, hydrology: h } = world;
  const land = terrain.reduce((count, type) => count + (type >= 2 && type !== 10 ? 1 : 0), 0), forest = [], wetlands = [];
  h.forestMask = new Uint8Array(terrain.length);
  const swampScore = new Float32Array(terrain.length).fill(NaN), forestScore = new Float32Array(terrain.length).fill(NaN);
  for (let index = 0; index < terrain.length; index++) {
    const type = terrain[index];
    if (type < 3 || type > 7) continue;
    if (type <= 5) terrain[index] = 4;
    const flatness = 1 / (1 + h.slope[index] * 100), convergence = bounded(Math.log1p(fields.hillslopeFlow[index]) / 8);
    const wet = fields.soilMoisture[index] * .4 + flatness * .25 + h.wetness[index] * .15 + fields.shelter[index] * .15 + convergence * .05;
    if (type <= 5 && h.slope[index] < .025 && fields.soilMoisture[index] > .5 &&
        (h.wetness[index] > .28 || fields.terrainPosition[index] > .015 || fields.topographicWetness[index] > .65) && wet > .55) {
      swampScore[index] = wet; wetlands.push({ index, score: wet });
    }
    const score = fields.soilMoisture[index] * .5 + fields.soilDepth[index] * .15 + fields.rainfall[index] * .2 +
      fields.shelter[index] * .15 - fields.exposure[index] * .05;
    if (h.slope[index] < .1 && h.ground[index] < h.seaLevel + .7 && fields.soilMoisture[index] > .48 &&
        fields.soilDepth[index] > .38 && fields.rainfall[index] > .28) {
      forestScore[index] = score;
      if (score > .49) forest.push({ index, score });
    }
  }
  wetlands.sort((left, right) => right.score - left.score || left.index - right.index);
  for (const { index } of wetlands.slice(0, Math.round(land * .085))) terrain[index] = 9;
  forest.sort((left, right) => right.score - left.score || left.index - right.index);
  const trees = forest.filter(item => terrain[item.index] !== 9).slice(0, Math.round(land * .28));
  for (const { index } of trees) {
    h.forestMask[index] = 1;
    if (terrain[index] <= 5) terrain[index] = 5;
  }
  for (let index = 0; index < terrain.length; index++) if (terrain[index] === 4 &&
      (1 - fields.soilMoisture[index]) * .75 + fields.exposure[index] * .15 + fields.sandySoil[index] * .1 > .58) terrain[index] = 3;
  for (const [id, layer, values] of [["swamp", "swamp", swampScore], ["forest", "forest", forestScore]])
    recordPlacementMap(h, "biome:" + id + "-score", [layer], values, { stage: "intermediate" });
}

export function landscapeResourceSuitability(key,index,terrain,h) {
  const type=terrain[index],f=h.resourceHabitats;if(type<2||type===10)return 0;
  const moisture=f.soilMoisture[index],depth=f.soilDepth[index],canopy=f.forestCover[index];
  if(key==='tree')return h.forestMask[index]?depth*(.35+moisture*.65):0;
  if(key==='dew')return type===4||type===9?(.2+moisture*.6+f.shelter[index]*.2)*(.6+canopy*.4):0;
  if(key==='clay')return [3,4,5,9].includes(type)?f.soilFertility[index]*(.5+depth*.5):0;
  if(key==='pebbles'){
    if(![2,3,4,6].includes(type))return 0;
    const distance=f.mountainDistance[index],talus=distance<=3?Math.exp(-distance/2)*f.exposure[index]*f.parentRock[index]*.25:0;
    const fan=distance<=10&&h.flow[index]>35&&h.slope[index]<.03?Math.min(1,Math.log1p(h.flow[index])/6)*.1:0;
    return h.gravel[index]*18+talus+fan;
  }
  return 0;
}
