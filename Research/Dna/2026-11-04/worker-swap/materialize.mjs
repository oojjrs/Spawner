import fs from 'node:fs';
import {ATTRIBUTE_DNA as M} from '../../../../server/dna.mjs';
const examples=[
 [{gene:'gather',rotation:0,grade:1,shape:[0,1]},...([3,4,0].map(rotation=>({gene:'capacity',rotation,grade:1,shape:[0,0]})))],
 [{gene:'gather',rotation:0,grade:1,shape:[0,1]},{gene:'capacity',rotation:3,grade:1,shape:[0,0]},{gene:'movement',rotation:4,grade:1,shape:[0,5]},...([5,0,2,4].map(rotation=>({gene:'capacity',rotation,grade:1,shape:[0,0]})))]
];
const combos=examples.map(pieces=>{let start={q:0,r:0};const paths=pieces.map((p,i)=>{const points=M.route(start,M.lookup.get(p.gene),p.grade,p.rotation,p.shape);const path={...p,index:i+1,points,start,middle:points[1],end:points.at(-1)};start=path.end;return path;});return {pieces,paths,price:3+M.price(pieces),stats:M.stats(pieces)};});
fs.writeFileSync(new URL('./worker.json',import.meta.url),JSON.stringify({hypothetical:true,assumedMapping:{health:{grade:2,shape:[0,1,5]},capacity:{grade:1,shape:[0,0]},gather:{grade:1,shape:[0,1]}},combos},null,2).replace(/\n/g,'\r\n'),'utf8');