import fs from 'node:fs';
import {ATTRIBUTE_DNA as M} from '../../../../server/dna.mjs';
const ids=['gather','health','blade','movement','secretion'];
const original=Object.fromEntries(ids.map(id=>[id,M.lookup.get(id).steps]));
const cases=[{id:'fast',counts:{gather:3,movement:2}},{id:'gatherHealth',counts:{gather:3,health:2}},{id:'melee',counts:{blade:3,health:2}},{id:'ranged',counts:{secretion:3,health:2}},{id:'hybrid',counts:{blade:2,secretion:1,health:2}}];
const key=p=>p.q+','+p.r;
const edgeKey=(a,b)=>[key(a),key(b)].sort().join(':');
function transformed(q,r,k,mirror){if(mirror)[q,r]=[r,q];for(let i=0;i<k;i++)[q,r]=[-r,q+r];return [q,r];}
function aesthetic(trace){
 const points=[...trace.occupied.keys()].map(s=>{const [q,r]=s.split(',').map(Number);return {q,r};});
 const n=points.length,sq=points.reduce((s,p)=>s+p.q,0),sr=points.reduce((s,p)=>s+p.r,0);
 const edges=trace.paths.flatMap(p=>p.points.slice(1).map((x,i)=>({a:p.points[i],b:x,gene:p.gene})));
 const plain=new Set(edges.map(e=>edgeKey(e.a,e.b))),colored=new Set(edges.map(e=>edgeKey(e.a,e.b)+'|'+e.gene));
 let symmetry=0,coloredSymmetry=0;
 for(const mirror of [false,true])for(let k=0;k<6;k++){
  if(!mirror&&k===0)continue;
  const pointMap=new Map();let valid=true;
  for(const p of points){const [tq,tr]=transformed(p.q*n-sq,p.r*n-sr,k,mirror),q=(tq+sq)/n,r=(tr+sr)/n;if(!Number.isInteger(q)||!Number.isInteger(r)){valid=false;break;}pointMap.set(key(p),{q,r});}
  if(!valid)continue;
  let s=true,c=true;for(const e of edges){const id=edgeKey(pointMap.get(key(e.a)),pointMap.get(key(e.b)));if(!plain.has(id)){s=false;c=false;break;}if(!colored.has(id+'|'+e.gene))c=false;}
  if(s)symmetry++;if(c)coloredSymmetry++;
 }
 const spans=['q','r','s'].map(axis=>{const values=points.map(p=>axis==='s'?p.q+p.r:p[axis]);return Math.max(...values)-Math.min(...values);});
 const span=spans.reduce((a,b)=>a+b,0),moment=points.reduce((s,p)=>{const q=p.q-sq/n,r=p.r-sr/n;return s+q*q+q*r+r*r;},0);
 const closed=key(trace.nodes.at(-1))==='0,0',cycles=edges.length-points.length+1;
 const score=coloredSymmetry*100000+symmetry*10000+(closed?1000:0)+cycles*50-span*10-moment;
 return {score,coloredSymmetry,symmetry,closed,cycles,span,moment,occupied:points.length};
}
function bestFor(counts,mapping){
 let best=null,visited=0,validLayouts=0;
 const remaining={...counts},pieces=[],length=Object.values(counts).reduce((a,b)=>a+b,0);
 function visit(){
  if(pieces.length===length){
   const t=M.trace(pieces,1),a=aesthetic(t);validLayouts++;
   if(!best||a.score>best.aesthetic.score){best={pieces:pieces.map(p=>({...p,shape:[...p.shape]})),paths:t.paths.map((p,i)=>({...p,index:i+1})),aesthetic:a,price:3+M.price(pieces),stats:M.stats(pieces)};}return;
  }
  for(const gene of Object.keys(remaining)){
   if(!remaining[gene])continue;
   const rotations=pieces.length?6:1;
   for(let rotation=0;rotation<rotations;rotation++){
    pieces.push({gene,grade:1,rotation,shape:mapping[gene]});visited++;
    if(M.trace(pieces,1).valid){remaining[gene]--;visit();remaining[gene]++;}pieces.pop();
   }
  }
 }
 visit();return {...best,visited,validLayouts};
}
const mappings=[{id:'current',swap:[],shapes:original}];
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i],b=ids[j];mappings.push({id:a+'-'+b,swap:[a,b],shapes:{...original,[a]:original[b],[b]:original[a]}});}
const comparisons=[];
for(const mapping of mappings){
 const results=cases.map(c=>({id:c.id,counts:c.counts,...bestFor(c.counts,mapping.shapes)}));
 const summary={coloredSymmetricCases:results.filter(r=>r.aesthetic.coloredSymmetry>0).length,symmetricCases:results.filter(r=>r.aesthetic.symmetry>0).length,closedCases:results.filter(r=>r.aesthetic.closed).length,score:results.reduce((s,r)=>s+r.aesthetic.score,0)};
 comparisons.push({mapping,summary,results});
}
comparisons.sort((a,b)=>b.summary.score-a.summary.score);
const output={observedAt:new Date().toISOString(),boardRadius:2,original,cases,comparisons,limits:['Aesthetic order uses exact edge/gene symmetry, closed outline and compactness; it is a heuristic, not a user beauty score.','All five-piece cases keep identical counts and stats across mappings.','Hypothetical catalog assignment is not applied to product files.','Only one-pair exchanges evaluated; no global optimum claim.']};
fs.writeFileSync(new URL('./exchange.json',import.meta.url),JSON.stringify(output,null,2).replace(/\n/g,'\r\n'),'utf8');
console.log(JSON.stringify(comparisons.map(c=>({mapping:c.mapping.id,...c.summary,cases:c.results.map(r=>({id:r.id,a:r.aesthetic,validLayouts:r.validLayouts}))})),null,2));