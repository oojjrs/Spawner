import test from "node:test";
import assert from "node:assert/strict";
import { routeLandscape, selectContinentalSea } from "./landscape-fields.mjs";
import { routeTerrainSediment } from "./terrain-sediment.mjs";

test("배수는 내려가며 육지 집수 면적을 바다까지 보존한다",()=>{
  const size=5,height=new Float64Array(25),sea=new Uint8Array(25);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const index=y*size+x;sea[index]=!x||!y||x===size-1||y===size-1?1:0;height[index]=sea[index]?0:9-x-y;
  }
  const drainage=routeLandscape(height,sea,size);let exported=0;
  for(let index=0;index<height.length;index++){
    if(sea[index])exported+=drainage.area[index];
    const parent=drainage.parent[index];if(parent>=0)assert.ok(drainage.level[parent]<drainage.level[index]);
  }
  assert.equal(exported,9*80*80);
  const formed={size,height,sea,drainage,profile:{cellMeters:80,manning:.035},erosion:Float32Array.from(sea,value=>value?0:.001)};
  const result=routeTerrainSediment(formed,Uint8Array.from(sea,value=>value?3:0),new Uint8Array(25),new Float32Array(25).fill(.2),()=>({width:5,depth:.3,velocity:.2}));
  for(let grain=0;grain<3;grain++)assert.ok(Math.abs(result.budget.produced[grain]-result.budget.stored[grain]-result.budget.exported[grain])<1e-8);
});

test("320칸 대륙의 해수면 기준과 네 면의 바다를 먼저 확정한다",()=>{
  const size=320,values=Float32Array.from({length:size*size},(_,index)=>index%size/size);
  const result=selectContinentalSea(values,size);
  assert.ok(result.landFraction>.79&&result.landFraction<.81);
  for(let coordinate=0;coordinate<size;coordinate++)for(const index of[coordinate,(size-1)*size+coordinate,coordinate*size,coordinate*size+size-1])assert.equal(result.sea[index],1);
  for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++)assert.equal(Boolean(result.sea[y*size+x]),values[y*size+x]<=result.threshold);
});
