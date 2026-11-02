import { createLandscapeField } from "./landscape-fields.mjs";
import { createHillslopeFlow, landscapeHash, quantizeLandscapeValue } from "./landscape-processes.mjs";
import { recordPlacementMap } from "./placement-maps.mjs";

function bounded(value) { return Math.max(0,Math.min(1,value)); }

function ranks(values,water) {
  const sorted=[];for(let index=0;index<values.length;index++)if(!water[index])sorted.push(index);
  sorted.sort((a,b)=>values[a]-values[b]||a-b);const result=new Float32Array(values.length);
  for(let rank=0;rank<sorted.length;rank++)result[sorted[rank]]=rank/Math.max(1,sorted.length-1);
  return result;
}

function record(h,id,layers,values,details) {
  recordPlacementMap(h,id,layers,values,{schemaVersion:33,...details});
}

export function createFormedHabitats(world) {
  const {size,seed,terrain,hydrology:h}=world,length=terrain.length;
  const vegetation=createLandscapeField(size,seed+3001,h.profile.vegetationCorrelation,1.5);
  const hillslopeFlow=createHillslopeFlow(h.ground,h.rainfall,size,h.seaLevel,h.water);
  const wetness=new Float32Array(length),drainageHeight=new Float32Array(length),referenceHeight=new Float64Array(length);
  const fields=Object.fromEntries(["rainfall","soilMoisture","soilDepth","soilFertility","forestCover","exposure","parentRock","sandySoil","shelter","terrainPosition","topographicWetness"].map(key=>[key,new Float32Array(length)]));
  for(let cursor=0;cursor<h.ground.length;cursor++){
    const index=h.downstreamOrder[cursor],parent=h.downstream[index];
    referenceHeight[index]=h.water[index]?h.waterSurface[index]:parent<0?0:referenceHeight[parent];
    drainageHeight[index]=Math.max(0,h.ground[index]-referenceHeight[index]);
  }
  for(let index=0;index<length;index++)wetness[index]=Math.log((hillslopeFlow[index]*h.profile.cellMeters)/Math.max(.001,h.slope[index]));
  const wetnessRank=ranks(wetness,h.water),mountainDistance=new Uint8Array(length).fill(255),queue=new Int32Array(length);let end=0;
  for(let index=0;index<length;index++)if(terrain[index]>=6&&terrain[index]<=8){mountainDistance[index]=0;queue[end++]=index;}
  for(let cursor=0;cursor<end;cursor++){
    const index=queue[cursor],x=index%size,y=Math.floor(index/size);if(mountainDistance[index]>=12)continue;
    for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(nx<0||ny<0||nx>=size||ny>=size)continue;const next=ny*size+nx;
      if(mountainDistance[next]<=mountainDistance[index]+1)continue;mountainDistance[next]=mountainDistance[index]+1;queue[end++]=next;
    }
  }
  for(let index=0;index<length;index++){
    const x=index%size,y=Math.floor(index/size),slope=h.slope[index];let surrounding=0;
    for(const[dx,dy]of[[-8,0],[8,0],[0,-8],[0,8]])surrounding+=h.ground[Math.max(0,Math.min(size-1,y+dy))*size+Math.max(0,Math.min(size-1,x+dx))];
    const position=surrounding/4-h.ground[index],shelter=bounded(.5+position/160);
    fields.terrainPosition[index]=position;fields.shelter[index]=shelter;
    fields.rainfall[index]=1;fields.parentRock[index]=h.bedrock[index];
    fields.topographicWetness[index]=wetnessRank[index];
    fields.soilMoisture[index]=bounded(.35+.35*wetnessRank[index]+.2*Math.exp(-drainageHeight[index]/4)-slope*.1);
    fields.soilDepth[index]=bounded((.35+.35*(1-h.bedrock[index])+.3*shelter)/(1+slope*4));
    fields.exposure[index]=bounded(slope*1.4+(1-shelter)*.3);
    fields.sandySoil[index]=1-Math.exp(-h.sand[index]/.02);
    fields.soilFertility[index]=bounded(.5*fields.soilDepth[index]+.35*(1-Math.exp(-h.fines[index]/.01))+.15*fields.soilMoisture[index]);
  }
  for(const[key,values]of Object.entries(fields))if(!["soilFertility","parentRock"].includes(key))record(h,"habitat:"+key,["forest","swamp","resources"],values,{stage:"intermediate",...(key==="terrainPosition"?{}:{minimum:0,maximum:1})});
  record(h,"habitat:drainage-height",["forest","swamp","resources"],drainageHeight,{stage:"intermediate",minimum:0});
  record(h,"habitat:hillslope-flow",["forest","swamp","resources"],hillslopeFlow,{stage:"intermediate",minimum:0,logarithmic:true});
  record(h,"habitat:mountain-distance",["mountains","resources"],mountainDistance,{stage:"intermediate",minimum:0,maximum:12,excluded:255});
  record(h,"resource:tree:suitability",["forest","resources"],vegetation,{resource:"tree",stage:"original"});
  return {...fields,mountainDistance,hillslopeFlow,vegetation,drainageHeight,wetness,
    fieldSemantics:{soilDepth:"relative-rooting-suitability",soilFertility:"relative-resource-suitability",soilMoisture:"relative-moisture-index",topographicWetness:"land-percentile"}};
}

export function formedResourceSuitability(key,index,terrain,h) {
  if(h.water[index]||terrain[index]===10)return 0;
  const f=h.resourceHabitats,slope=h.slope[index],type=terrain[index],moisture=f.soilMoisture[index];
  const flat=1/(1+slope*8),open=1-f.forestCover[index];
  if(key==="tree")return h.forestMask?.[index]?1:0;
  if(key==="clay")return type<=5||type===9?flat*(.35+.45*(1-h.bedrock[index])+.2*(1-Math.exp(-h.fines[index]/.005))):0;
  if(key==="dew")return type===4||type===9?moisture*(.6+.4*open)*(type===9?2.5:1):0;
  if(key==="pebbles"){
    if(type===9||type>=7)return 0;
    const alluvium=h.bankGravel[index]*16;
    const talus=type===6?.005*f.exposure[index]*h.bedrock[index]:0;
    return alluvium+talus;
  }
  return 0;
}

export function populateFormedResources(world) {
  const {terrain,hydrology:h,seed,size}=world,length=terrain.length;
  const fields=createFormedHabitats(world);h.resourceHabitats=fields;h.forestMask=new Uint8Array(length);
  const forestScore=new Float32Array(length).fill(NaN),swampScore=new Float32Array(length).fill(NaN);
  for(let index=0;index<length;index++){
    if(h.water[index]||terrain[index]===2||terrain[index]===10)continue;
    const slope=h.slope[index],wetness=fields.topographicWetness[index],hand=fields.drainageHeight[index];
    const swamp=wetness*Math.exp(-hand/12)/(1+slope*30);swampScore[index]=swamp;
    if(!h.profile.swampFraction&&terrain[index]===4&&wetness>.78&&slope<.035&&hand<8&&swamp>.54&&h.bankGravel[index]<.08){terrain[index]=9;continue;}
    const score=1/(1+Math.exp(-(-1.1+fields.vegetation[index]*1.1+fields.soilMoisture[index]*.7+fields.shelter[index]*.5-slope*2-Math.max(0,h.ground[index]-700)*.0008)));
    forestScore[index]=score;
    if(!h.profile.forestFraction&&slope<.8&&terrain[index]!==8&&score>.62&&h.bankGravel[index]<.08){h.forestMask[index]=1;if(terrain[index]===4)terrain[index]=5;}
    else if(!h.profile.dryLandFraction&&terrain[index]===4&&fields.soilMoisture[index]<.47)terrain[index]=3;
  }
  if(h.profile.forestFraction) {
    const lowlands=[],wetlands=[];let land=0;
    for(let index=0;index<length;index++) {
      if(h.water[index])continue;land++;
      if(terrain[index]!==4)continue;
      lowlands.push(index);
      if(fields.topographicWetness[index]>.78&&h.slope[index]<.035&&fields.drainageHeight[index]<8&&swampScore[index]>.54&&h.bankGravel[index]<.08)wetlands.push(index);
    }
    wetlands.sort((a,b)=>swampScore[b]-swampScore[a]||a-b);
    for(const index of wetlands.slice(0,Math.round(land*h.profile.swampFraction)))terrain[index]=9;
    const forests=lowlands.filter(index=>terrain[index]===4&&h.slope[index]<.8&&h.bankGravel[index]<.08);
    forests.sort((a,b)=>forestScore[b]-forestScore[a]||a-b);
    for(const index of forests.slice(0,Math.round(land*h.profile.forestFraction))){h.forestMask[index]=1;terrain[index]=5;}
    const dry=lowlands.filter(index=>terrain[index]===4);
    const dryness=index=>1-fields.soilMoisture[index]+fields.sandySoil[index]*.2+fields.exposure[index]*.1;
    dry.sort((a,b)=>dryness(b)-dryness(a)||a-b);
    for(const index of dry.slice(0,Math.round(land*h.profile.dryLandFraction)))terrain[index]=3;
  }
  for(let index=0;index<length;index++){
    const x=index%size,y=Math.floor(index/size);let canopy=0,count=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<size&&y+dy<size){canopy+=h.forestMask[(y+dy)*size+x+dx];count++;}
    fields.forestCover[index]=canopy/count;
  }
  for(const[id,layer,values]of[["forest-score","forest",forestScore],["swamp-score","swamp",swampScore]])record(h,"biome:"+id,[layer],values,{stage:"intermediate",minimum:0,maximum:1});
  world.resources=[];world.food=[];
  const occupied=new Uint8Array(length);
  for(let index=0;index<length;index++)if(h.forestMask[index]){
    const amount=Math.round(30+fields.soilMoisture[index]*35+fields.soilDepth[index]*20);
    world.resources.push([index%size,Math.floor(index/size),amount,"tree"]);occupied[index]=1;
  }
  const definitions=[["clay",.11,12,28],["pebbles",1.1,12,42],["dew",.11,3,10]];
  for(const[order,[key,intensity,base,richness]]of definitions.entries()){
    const suitability=new Float32Array(length),probability=new Float32Array(length);
    const draw=(x,y)=>landscapeHash(x,y,seed+3083+order*41);
    for(let index=0;index<length;index++){
      suitability[index]=formedResourceSuitability(key,index,terrain,h);
      if(occupied[index]||world.hazards[index])continue;
      const chance=quantizeLandscapeValue(1-Math.exp(-intensity*suitability[index]));probability[index]=chance;
      const x=index%size,y=Math.floor(index/size);if(draw(x,y)>=chance)continue;
      let amount=Math.round(base+richness*suitability[index]*(.5+landscapeHash(x,y,seed+3089+order*43)));
      if(terrain[index]===9){if(key==="dew")amount=Math.round(24+36*fields.soilMoisture[index]+20*landscapeHash(x,y,seed+3359));if(key==="clay")amount*=2;}
      world.resources.push([x,y,amount,key]);occupied[index]=1;
    }
    record(h,"resource:"+key+":suitability",["resources"],suitability,{resource:key,stage:"intermediate",minimum:0});
    record(h,"resource:"+key+":draw",["resources"],null,{resource:key,stage:"original",sample:draw,minimum:0,maximum:1});
    record(h,"resource:"+key+":probability",["resources"],probability,{resource:key,stage:"intermediate",minimum:0,maximum:1});
  }
  if(h.placementMaps){
    const total=new Float32Array(length);for(const[x,y,amount]of world.resources)total[y*size+x]=amount;
    record(h,"resource:amount",["resources"],total,{minimum:0,scope:"all",stage:"final"});
    for(const key of["tree",...definitions.map(item=>item[0])]){
      const amounts=new Float32Array(length);for(const[x,y,amount,type]of world.resources)if(type===key)amounts[y*size+x]=amount;
      record(h,"resource:"+key+":amount",["resources"],amounts,{resource:key,minimum:0,stage:"final"});
    }
  }
  for(const[id,layer,values]of[["forest","forest",h.forestMask],["swamp","swamp",Uint8Array.from(terrain,type=>type===9?1:0)]])record(h,"biome:"+id+"-mask",[layer],values,{stage:"final",minimum:0,maximum:1});
  h.resourceProfile={model:"conditional-intensity",selected:{forestThreshold:.62,swampWetness:.78,swampSlope:.035,swampDrainageHeight:8,activeBarExclusion:.08,definitions}};
}
