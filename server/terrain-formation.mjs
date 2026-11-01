import { createLandscapeField, normalProbability, routeLandscape, selectContinentalSea } from "./landscape-fields.mjs";
import { landscapeHash, quantizeLandscapeValue } from "./landscape-processes.mjs";
import { initializePlacementMaps, recordPlacementMap } from "./placement-maps.mjs";
import { routeTerrainSediment } from "./terrain-sediment.mjs";

export const TERRAIN_FORMATION_PROFILE = Object.freeze({
  version:33, size:320, cellMeters:80, landTarget:.8, landMinimum:.7, landMaximum:.85,
  continentCorrelation:80, continentSmoothness:.75, upliftCorrelation:64, resistanceCorrelation:32,
  magmaticCorrelation:10, hydrothermalCorrelation:15, vegetationCorrelation:5,
  upliftRate:.001, erodibility:.00002, drainageExponent:.4, slopeExponent:1,
  diffusion:.1, criticalSlope:.57, durationYears:1600000, stepYears:10000,
  precipitation:1, runoff:.35, riverArea:12000000, headwaterArea:320000, manning:.035,
  sources:{ terrain:"https://doi.org/10.1111/cgf.15033", wetness:"https://doi.org/10.5194/hess-10-101-2006",
    drainageHeight:"https://doi.org/10.1016/j.jhydrol.2011.03.051", sediment:"https://doi.org/10.1061/(ASCE)0733-9429(2003)129:2(120)",
    settling:"https://doi.org/10.1306/051204740933" },
  adopted:{upliftRate:.001,erodibility:.00002,drainageExponent:.4,slopeExponent:1,diffusion:.1,criticalSlope:.57},
  selected:{cellMeters:80,landTarget:.8,continentCorrelation:80,upliftCorrelation:64,resistanceCorrelation:32,
    upliftLow:.005,upliftHigh:2,upliftActivation:.45,continentContrast:1,continentSmoothness:.75,edgeFalloff:.03,durationYears:1600000,stepYears:10000,
    runoff:.35,riverArea:12000000,headwaterArea:320000,manning:.035,eventMultiplier:6,eventFraction:.05,
    sedimentExposureYears:1000,grainDiameters:[.032,.001,.00002],grainFractions:[.35,.5,.15]},
  assumptions:["spatial-input-priors","80-metre-grid","fixed-coast","uniform-annual-runoff","finite-time-implicit-stream-power","terrain-conditioned-resource-occurrence"]
});

function record(owner,id,layers,values,details) {
  recordPlacementMap(owner,id,layers,values,{schemaVersion:33,...details});
}

export function formContinentalTerrain(size, seed, capture, version) {
  const base = TERRAIN_FORMATION_PROFILE, scale = version !== undefined && version < 36 ? 1 : Math.min(1,size/base.size);
  let profile = scale === 1 ? base : { ...base, version:36, size,
    continentCorrelation:base.continentCorrelation*scale, upliftCorrelation:base.upliftCorrelation*scale,
    resistanceCorrelation:base.resistanceCorrelation*scale, vegetationCorrelation:Math.max(3,base.vegetationCorrelation*scale),
    magmaticCorrelation:base.magmaticCorrelation*scale, hydrothermalCorrelation:base.hydrothermalCorrelation*scale,
    upliftRate:base.upliftRate*scale, reliefScale:scale, riverArea:base.riverArea*scale*scale, headwaterArea:base.headwaterArea*scale*scale,
    mountainFraction:.2, forestFraction:.22, swampFraction:.07, dryLandFraction:.12, riverWidthMaximum:base.cellMeters*size/64,
    adopted:{...base.adopted,upliftRate:base.upliftRate*scale},
    selected:{...base.selected,continentCorrelation:base.continentCorrelation*scale,upliftCorrelation:base.upliftCorrelation*scale,
      resistanceCorrelation:base.resistanceCorrelation*scale,riverArea:base.riverArea*scale*scale,headwaterArea:base.headwaterArea*scale*scale} };
  if (version === undefined || version >= 37) profile = { ...profile, version:37,
    upliftCorrelation:24*scale, mountainFraction:.16,
    selected:{...profile.selected,upliftCorrelation:24*scale,upliftActivation:.6} };
  const length = size*size, owner = {};
  initializePlacementMaps(owner,capture);
  const continentField = createLandscapeField(size,seed+4001,profile.continentCorrelation,profile.continentSmoothness);
  const upliftField = createLandscapeField(size,seed+4127,profile.upliftCorrelation,1.5);
  const resistanceField = createLandscapeField(size,seed+17011,profile.resistanceCorrelation,1.5);
  const continentality = new Float32Array(length), uplift = new Float32Array(length), resistance = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const x=index%size,y=Math.floor(index/size);
    continentality[index] = normalProbability(continentField[index])-Math.exp(-x/(size*.03))-Math.exp(-(size-1-x)/(size*.03))-Math.exp(-y/(size*.03))-Math.exp(-(size-1-y)/(size*.03));
    const rise = Math.max(0,(normalProbability(upliftField[index])-profile.selected.upliftActivation)/(1-profile.selected.upliftActivation));
    uplift[index] = profile.upliftRate*(.005+1.995*rise*rise);
    resistance[index] = normalProbability(resistanceField[index]);
  }
  let selected = selectContinentalSea(continentality,size);
  if (scale < 1) for (let strength=2; strength<=64 && (selected.landFraction<profile.landMinimum || selected.landFraction>profile.landMaximum); strength*=2) {
    for (let index=0;index<length;index++) {
      const x=index%size,y=Math.floor(index/size);
      continentality[index]=normalProbability(continentField[index])-strength*(Math.exp(-x/(size*.03))+Math.exp(-(size-1-x)/(size*.03))+Math.exp(-y/(size*.03))+Math.exp(-(size-1-y)/(size*.03)));
    }
    selected=selectContinentalSea(continentality,size);
  }
  const {sea,threshold,landFraction}=selected;
  if (landFraction<profile.landMinimum||landFraction>profile.landMaximum) throw new Error("대륙 면적 비율을 만족하는 해수면 기준을 찾지 못했습니다.");
  let height = new Float64Array(length), nextHeight = new Float64Array(length);
  for (let index = 0; index < length; index++) height[index] = sea[index] ? -2-80*Math.max(0,threshold-continentality[index]) :
    Math.max(.01,80*(continentality[index]-threshold)+landscapeHash(index,0,seed+5119)*.5);
  const initialHeight = new Float64Array(height), erosion = new Float32Array(length), delta = new Float64Array(length);
  const dt=profile.stepYears, dx=profile.cellMeters, diffusion=profile.diffusion*dt/(dx*dx);
  const years = profile.durationYears/profile.stepYears;
  let drainage;
  for (let step=0;step<years;step++) {
    drainage=routeLandscape(height,sea,size);
    nextHeight.set(height);
    for (const index of drainage.order) {
      if(sea[index])continue;
      const parent=drainage.parent[index]; if(parent<0)continue;
      const distance=dx*Math.hypot(index%size-parent%size,Math.floor(index/size)-Math.floor(parent/size));
      const erodibility=profile.erodibility*(2-1.5*resistance[index]);
      const rate=erodibility*Math.pow(profile.runoff*drainage.area[index],profile.drainageExponent)*dt/distance;
      const base=sea[parent]?0:Math.max(0,nextHeight[parent]);
      const raised=Math.max(0,height[index])+uplift[index]*dt;
      nextHeight[index]=raised>base?(raised+rate*base)/(1+rate):raised;
      if(step===years-1)erosion[index]=Math.max(0,(raised-nextHeight[index])/dt);
    }
    delta.fill(0);
    for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
      const index=y*size+x;if(sea[index])continue;
      for(const other of [index+1,index+size]){
        const transfer=diffusion*(nextHeight[index]-(sea[other]?0:nextHeight[other]));
        delta[index]-=transfer;if(!sea[other])delta[other]+=transfer;
      }
    }
    for(let index=0;index<length;index++)if(!sea[index])height[index]=Math.max(.0001,nextHeight[index]+delta[index]);
    for(let relaxation=0;relaxation<2;relaxation++){
      delta.fill(0);
      for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
        const index=y*size+x;if(sea[index])continue;
        for(const other of [index+1,index+size]){
          const difference=height[index]-(sea[other]?0:height[other]),excess=Math.abs(difference)-profile.criticalSlope*dx;
          if(excess<=0)continue;
          const transfer=Math.sign(difference)*excess*.12;delta[index]-=transfer;if(!sea[other])delta[other]+=transfer;
        }
      }
      for(let index=0;index<length;index++)if(!sea[index])height[index]=Math.max(.0001,height[index]+delta[index]);
    }
    for(let index=0;index<length;index++)height[index]=quantizeLandscapeValue(height[index]);
  }
  drainage=routeLandscape(height,sea,size);
  const layers=["mountains","water","forest","swamp","resources","camps","units"];
  record(owner,"terrain:roughness",layers,continentField,{stage:"original"});
  record(owner,"relief:uplift",layers,upliftField,{stage:"original"});
  record(owner,"geology:bedrock-noise",layers,resistanceField,{stage:"original"});
  record(owner,"relief:uplift-rate",layers,uplift,{stage:"intermediate",minimum:0,maximum:.002});
  record(owner,"geology:resistance",layers,resistance,{stage:"intermediate",minimum:0,maximum:1});
  record(owner,"terrain:basement",["mountains","water"],initialHeight,{stage:"intermediate"});
  return {size,seed,profile,sea,landFraction,threshold,continentality,uplift,resistance,height,initialHeight,erosion,drainage,owner};
}

function normalDepth(discharge,slope,leftSlope,rightSlope,roughness) {
  const gradient=Math.max(.00001,slope),left=Math.max(.0001,leftSlope),right=Math.max(.0001,rightSlope);
  function section(depth){
    const width=depth/left+depth/right,area=depth*width*.5,perimeter=depth*Math.sqrt(1+1/(left*left))+depth*Math.sqrt(1+1/(right*right));
    const velocity=Math.pow(area/Math.max(1e-9,perimeter),2/3)*Math.sqrt(gradient)/roughness;
    return {width,velocity,flow:area*velocity};
  }
  let lower=0,upper=.05;while(section(upper).flow<discharge&&upper<1000)upper*=2;
  for(let step=0;step<30;step++){const middle=(lower+upper)/2;if(section(middle).flow<discharge)lower=middle;else upper=middle;}
  return {depth:upper,...section(upper)};
}

export function generateFormedLandscape(terrain,moisture,heightField,size,seed,capture,version) {
  const formed=formContinentalTerrain(size,seed,capture,version),{height,sea,drainage,profile}=formed,length=height.length,dx=profile.cellMeters;
  const water=new Uint8Array(length),river=new Uint8Array(length),lake=new Uint8Array(length),slope=new Float32Array(length);
  const waterSurface=new Float64Array(length),waterDistance=new Uint8Array(length).fill(255),queue=new Int32Array(length);
  const gravel=new Float32Array(length),sand=new Float32Array(length),fines=new Float32Array(length),cover=new Float32Array(length);
  const discharge=new Float32Array(length),depth=new Float32Array(length),velocity=new Float32Array(length),width=new Float32Array(length);
  const basin=new Int32Array(length).fill(-1),childCount=new Uint8Array(length),headwaters=[],confluences=[],fordCandidates=[];
  const channels=[],riverMouths=[],basinSizes=new Map(),pondDepth=new Float32Array(length),rainfall=new Float32Array(length).fill(1);
  const ground=new Float64Array(height),flow=new Float64Array(length),sediment=new Float64Array(length),wetness=new Float32Array(length),rock=new Float32Array(length);
  for(const index of drainage.order){
    const parent=drainage.parent[index];
    flow[index]=drainage.area[index]/(dx*dx);discharge[index]=drainage.area[index]*profile.precipitation*profile.runoff/31557600;
    if(sea[index]){water[index]=3;waterSurface[index]=0;terrain[index]=0;continue;}
    const x=index%size,y=Math.floor(index/size);let maximum=0;
    for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<size&&ny<size)maximum=Math.max(maximum,Math.abs(height[index]-Math.max(0,height[ny*size+nx]))/dx);
    slope[index]=maximum;pondDepth[index]=Math.max(0,drainage.level[index]-height[index]);
    basin[index]=parent<0||sea[parent]?index:basin[parent];
    sediment[index]=formed.erosion[index]*dx*dx;
    const radius=Math.max(3,Math.round((profile.version>=37?6:10)*(profile.reliefScale||1))),west=y*size+Math.max(0,x-radius),east=y*size+Math.min(size-1,x+radius);
    const north=Math.max(0,y-radius)*size+x,south=Math.min(size-1,y+radius)*size+x;
    const neighborhood=(height[west]+height[east]+height[north]+height[south])/4;
    const relief=height[index]-neighborhood,range=Math.max(height[west],height[east],height[north],height[south])-Math.min(height[west],height[east],height[north],height[south]);
    terrain[index]=relief>250*(profile.reliefScale||1)&&maximum>.35?8:relief>120*(profile.reliefScale||1)&&maximum>.22?7:(range>=120*(profile.reliefScale||1)&&maximum>=.12||relief>=40*(profile.reliefScale||1)&&maximum>=.08)?6:4;
    if(pondDepth[index]>.5){water[index]=2;lake[index]=1;waterSurface[index]=drainage.level[index];terrain[index]=1;}
  }
  const marked=new Uint8Array(length);
  for(let index=0;index<length;index++)if(!sea[index]&&!lake[index]&&drainage.area[index]>=profile.riverArea)marked[index]=1;
  const mainTributary=new Int32Array(length).fill(-1),trunkHeads=[];
  for(let index=0;index<length;index++){
    if(sea[index])continue;const parent=drainage.parent[index];if(parent<0)continue;
    if(mainTributary[parent]<0||drainage.area[index]>drainage.area[mainTributary[parent]])mainTributary[parent]=index;
  }
  for(let index=0;index<length;index++)if(marked[index]&&(mainTributary[index]<0||!marked[mainTributary[index]]))trunkHeads.push(index);
  for(const head of trunkHeads){
    let next=mainTributary[head];
    while(next>=0&&!sea[next]&&!lake[next]&&drainage.area[next]>=profile.headwaterArea){marked[next]=1;next=mainTributary[next];}
  }
  for(let index=0;index<length;index++)if(marked[index]){
    const parent=drainage.parent[index];if(parent>=0&&marked[parent])childCount[parent]++;
  }
  for(const index of drainage.order){
    if(!marked[index])continue;
    const parent=drainage.parent[index],x=index%size,y=Math.floor(index/size);
    if(!childCount[index])headwaters.push(index);if(childCount[index]>1)confluences.push(index);
    const nx=parent>=0?parent%size:x,ny=parent>=0?Math.floor(parent/size):y,along=Math.max(1,Math.hypot(nx-x,ny-y));
    const tx=-(ny-y)/along,ty=(nx-x)/along;
    const leftIndex=Math.max(0,Math.min(size-1,Math.round(y+ty)))*size+Math.max(0,Math.min(size-1,Math.round(x+tx)));
    const rightIndex=Math.max(0,Math.min(size-1,Math.round(y-ty)))*size+Math.max(0,Math.min(size-1,Math.round(x-tx)));
    const bedSlope=parent>=0?Math.max(.00001,(drainage.level[index]-(sea[parent]?0:drainage.level[parent]))/(dx*along)):.00001;
    const leftSlope=Math.max(.0001,(height[leftIndex]-height[index])/dx),rightSlope=Math.max(.0001,(height[rightIndex]-height[index])/dx);
    const cross=normalDepth(discharge[index]*4/9,bedSlope,leftSlope,rightSlope,profile.manning);
    cross.depth=Math.max(cross.depth,parent>=0?waterSurface[parent]-height[index]+.00001:0);
    cross.width=cross.depth*(1/leftSlope+1/rightSlope);
    if (profile.reliefScale) cross.width=Math.min(profile.riverWidthMaximum,Math.max(cross.width,dx*size/160*(.35+.65*Math.min(1,Math.sqrt(drainage.area[index]/(profile.riverArea*6))))));
    cross.velocity=(discharge[index]*4/9)/Math.max(.000000001,cross.depth*cross.width/2);
    width[index]=cross.width;depth[index]=cross.depth;velocity[index]=cross.velocity;
    water[index]=1;river[index]=1;terrain[index]=cross.depth>.7?0:1;waterSurface[index]=height[index]+cross.depth;
    basinSizes.set(basin[index],(basinSizes.get(basin[index])||0)+1);
    const point={x:x+.5,y:y+.5,surface:waterSurface[index],bed:height[index],flow:flow[index],discharge:discharge[index],width:cross.width,radius:cross.width/(2*dx),sediment:sediment[index]};
    const tail=parent>=0?{...point,x:nx+.5,y:ny+.5,surface:sea[parent]?0:Math.min(point.surface,height[parent]+cross.depth),bed:height[parent]}:point;
    channels.push({basin:basin[index],points:[point,tail]});
    if(parent>=0&&sea[parent])riverMouths.push({...tail,surface:0});
    if(cross.depth<=.3&&cross.velocity<=.6&&bedSlope<=.01)fordCandidates.push({index,x,y,cross,tx,ty});
  }
  for(const channel of channels){
    const point=channel.points[0],tail=channel.points[1],radius=point.radius;
    if(radius<=.5)continue;
    for(let y=Math.max(0,Math.floor(point.y-radius-1));y<=Math.min(size-1,Math.ceil(point.y+radius+1));y++)for(let x=Math.max(0,Math.floor(point.x-radius-1));x<=Math.min(size-1,Math.ceil(point.x+radius+1));x++){
      const index=y*size+x;if(sea[index]||lake[index]||height[index]>=point.surface)continue;
      const sx=tail.x-point.x,sy=tail.y-point.y,t=Math.max(0,Math.min(1,((x+.5-point.x)*sx+(y+.5-point.y)*sy)/(sx*sx+sy*sy)));
      if(Math.hypot(x+.5-point.x-t*sx,y+.5-point.y-t*sy)>radius)continue;
      water[index]=1;river[index]=1;waterSurface[index]=Math.max(waterSurface[index],point.surface);terrain[index]=point.surface-height[index]>.7?0:1;
    }
  }
  const sedimentTransport=routeTerrainSediment(formed,water,river,discharge,normalDepth);
  gravel.set(sedimentTransport.gravel);sand.set(sedimentTransport.sand);fines.set(sedimentTransport.fines);cover.set(sedimentTransport.cover);sediment.set(sedimentTransport.flux);
  for(const channel of channels)for(const point of channel.points)point.sediment=sediment[Math.floor(point.y)*size+Math.floor(point.x)];
  let end=0;
  for(let index=0;index<length;index++)if(water[index]){waterDistance[index]=0;queue[end++]=index;}
  for(let cursor=0;cursor<end;cursor++){
    const index=queue[cursor],x=index%size,y=Math.floor(index/size);
    for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<size&&ny<size){const next=ny*size+nx;if(waterDistance[next]<=waterDistance[index]+1)continue;waterDistance[next]=waterDistance[index]+1;queue[end++]=next;}
  }
  const fords=[];
  for(const candidate of fordCandidates){
    if(fords.some(other=>Math.hypot(other.x-candidate.x,other.y-candidate.y)<10))continue;
    const a=Math.round(candidate.y+candidate.ty)*size+Math.round(candidate.x+candidate.tx),b=Math.round(candidate.y-candidate.ty)*size+Math.round(candidate.x-candidate.tx);
    if(a<0||b<0||a>=length||b>=length||water[a]||water[b])continue;
    terrain[candidate.index]=10;fords.push({x:candidate.x,y:candidate.y,cells:[candidate.index],width:width[candidate.index],depth:depth[candidate.index],velocity:velocity[candidate.index]});
  }
  for(let index=0;index<length;index++){
    heightField[index]=height[index];wetness[index]=Math.exp(-waterDistance[index]/8);moisture[index]=wetness[index]-.5;
    rock[index]=formed.resistance[index];
    if(!water[index]&&waterDistance[index]<=2&&slope[index]<.1&&(sand[index]>.02||Array.from([index-1,index+1,index-size,index+size]).some(next=>next>=0&&next<length&&sea[next])))terrain[index]=2;
  }
  if (profile.mountainFraction) {
    const mountains=[];let land=0;
    for(let index=0;index<length;index++) {
      if(water[index])continue;land++;
      if(terrain[index]<6||terrain[index]>8)continue;
      const x=index%size,y=Math.floor(index/size),radius=Math.max(3,Math.round(size/32));
      const neighbors=[height[y*size+Math.max(0,x-radius)],height[y*size+Math.min(size-1,x+radius)],height[Math.max(0,y-radius)*size+x],height[Math.min(size-1,y+radius)*size+x]];
      const prominence=Math.max(0,height[index]-neighbors.reduce((sum,value)=>sum+value,0)/4);
      mountains.push({index,score:prominence+slope[index]*80+height[index]*.05});
    }
    mountains.sort((a,b)=>b.score-a.score||a.index-b.index);
    for(const {index} of mountains.slice(Math.round(land*profile.mountainFraction)))terrain[index]=4;
  }
  const result={size,seed,generationVersion:profile.version,profile,height:ground,ground,surface:drainage.level,waterSurface,
    downstream:drainage.parent,downstreamOrder:drainage.order,flow,drainageArea:drainage.area,sediment,water,river,lake,slope,gravel,sand,fines,cover,rock,wetness,
    fertility:fines,waterDistance,fordCandidates,fords,lakeCount:0,waterBudget:water.reduce((sum,v)=>sum+(v?1:0),0),
    riverThreshold:profile.riverArea/6400,island:false,uplifts:[],uplift:formed.uplift,basement:formed.initialHeight,bedrock:formed.resistance,
    rainfall,seaLevel:0,seaMask:sea,continent:{natural:true,direction:0,erosionPasses:160,landFraction:formed.landFraction,threshold:formed.threshold},
    channels,headwaters,confluences,riverMouths,riverBasins:[...basinSizes].map(([outlet,cells])=>({outlet,cells})),
    riverWidth:width,riverDepth:depth,riverVelocity:velocity,discharge,bankGravel:sedimentTransport.bankGravel,sedimentBudget:sedimentTransport.budget};
  const visited=new Uint8Array(length);
  for(let index=0;index<length;index++)if(lake[index]&&!visited[index]){result.lakeCount++;const items=[index];visited[index]=1;for(let c=0;c<items.length;c++){const n=items[c];for(const next of [n-1,n+1,n-size,n+size])if(next>=0&&next<length&&Math.abs(next%size-n%size)<=1&&lake[next]&&!visited[next]){visited[next]=1;items.push(next);}}}
  if(capture){initializePlacementMaps(result,true);result.placementMaps.push(...formed.owner.placementMaps);
    for(const [id,values,layers,details]of [
      ["hydrology:ground",ground,["mountains","water","forest","resources"],{}],
      ["hydrology:surface",drainage.level,["water"],{}],["hydrology:pond-depth",pondDepth,["water","swamp"],{minimum:0}],
      ["hydrology:sea-depth",Float32Array.from(height,value=>-value),["water"],{}],
      ["hydrology:flow",discharge,["water","resources"],{minimum:0,logarithmic:true}],
      ["hydrology:sediment",sediment,["water","resources"],{minimum:0,logarithmic:true}],
      ["hydrology:slope",slope,["mountains","forest","swamp","resources"],{minimum:0}],
      ["hydrology:gravel",gravel,["water","resources"],{minimum:0,resource:"pebbles"}],
      ["hydrology:sand",sand,["water","resources"],{minimum:0,resource:"sand"}],
      ["hydrology:fines",fines,["water","resources"],{minimum:0,resource:"clay"}],
      ["hydrology:cover",cover,["water","resources"],{minimum:0}],
      ["hydrology:bank-gravel",sedimentTransport.bankGravel,["water","resources","forest","swamp"],{minimum:0,maximum:1}],
      ["hydrology:river-width",width,["water"],{minimum:0}],
      ["hydrology:river-depth",depth,["water"],{minimum:0}],
      ["hydrology:river-velocity",velocity,["water"],{minimum:0}],
      ["hydrology:ford-candidates",Uint8Array.from({length},(_,index)=>fordCandidates.some(candidate=>candidate.index===index)?1:0),["water"],{minimum:0,maximum:1,water:"ford"}],
      ["hydrology:water",water,["water"],{categorical:true,stage:"final"}],
      ["hydrology:river",river,["water"],{minimum:0,maximum:1,water:"river",stage:"final"}],
      ["hydrology:lake",lake,["water"],{minimum:0,maximum:1,water:"lake",stage:"final"}],
      ["hydrology:ford",Uint8Array.from(terrain,type=>type===10?1:0),["water"],{minimum:0,maximum:1,water:"ford",stage:"final"}],
      ["hydrology:shore",Uint8Array.from(terrain,type=>type===2?1:0),["water"],{minimum:0,maximum:1,stage:"final"}],
      ["terrain:mountains",Uint8Array.from(terrain,type=>type>=6&&type<=8?1:0),["mountains"],{minimum:0,maximum:1,stage:"final"}],
      ["river:basins",basin,["water"],{categorical:true,excluded:-1,water:"river"}]
    ])record(result,id,layers,values,details);
  }
  return result;
}
