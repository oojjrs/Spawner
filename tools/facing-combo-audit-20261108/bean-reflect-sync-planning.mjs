// Refresh only the selected two bean families' embedded birth metadata and legacy source records.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {UNIT_ACTION_ART} from '../../client/unit-action-art-assets.mjs';
const root=new URL('../../',import.meta.url),forms=['blade-carapace','blade-secretion-carapace-antenna'];
if(!existsSync(new URL('tools/facing-combo-audit-20261108/bean-reflect-neutral-done.json',root)))throw Error('neutral source metadata is not ready');
const p=new URL('DesignAssets/sections/unit-appearance.js',root);let s=readFileSync(p,'utf8'),count=0;
s=s.split('\n').map(line=>{
 if(!forms.some(f=>line.includes('unit-bean-'+f+'\\"')))return line;
 const suffix=line.endsWith(' +')?' +':'';let html=JSON.parse(suffix?line.slice(0,-2):line);
 const form=forms.find(f=>html.includes('id="unit-bean-'+f+'"')),clip=UNIT_ACTION_ART['bean/'+form].actions.birth;
 html=html.replace(/data-birth-scene="([^"]*)"/g,(_,data)=>{
   const old=JSON.parse(data.replaceAll('&quot;','"').replaceAll('&amp;','&')),out={...old};
   for(const key of Object.keys(old)) if(key in clip) out[key]=clip[key];
   count++;return 'data-birth-scene="'+JSON.stringify(out).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"';
 });
 return JSON.stringify(html)+suffix;
}).join('\n');
if(count!==1)throw Error('expected one embedded birth scene; blade-carapace uses a native GIF, found '+count);writeFileSync(p,s);
// Only bean/17 neutral source changed. Bean/03 is intentionally untouched. All unrelated registry entries remain byte-equivalent.
const q=new URL('client/unit-appearance-assets.mjs',root);let r=readFileSync(q,'utf8');const prefix='export const UNIT_APPEARANCE_ASSETS = Object.freeze(',a=r.indexOf(prefix)+prefix.length,b=r.lastIndexOf('});');const object=JSON.parse(r.slice(a,b+1));
for(const mask of ['17']){
 const source=JSON.parse(readFileSync(new URL('DesignAssets/Animations/UnitAppearanceV1/bean/'+mask+'/source.json',root),'utf8'));
 const old=object['bean/'+mask].source;
 // The generated registry has a subset of the authoritative record. Preserve that shape.
 for(const key of Object.keys(old))if(key in source)old[key]=source[key];
 old.sourceFacing='left';
 delete old.sourceNormalization;
}
writeFileSync(q,r.slice(0,a)+JSON.stringify(object,null,2)+r.slice(b+1));
console.log(JSON.stringify({birthRows:count,neutralSources:1}));
// Refresh existing offline neutral-source wrappers without rebuilding unrelated appearance archives.
const {createHash}=await import('node:crypto');
const lazy=new URL('client/unit-appearance-lazy-assets.js',root);let l=readFileSync(lazy,'utf8'),start=l.indexOf('Object.freeze(')+'Object.freeze('.length,end=l.lastIndexOf('});');const catalog=JSON.parse(l.slice(start,end+1));
for(const mask of ['17']){
 const path='DesignAssets/Animations/UnitAppearanceV1/bean/'+mask+'/Source/neutral.png',bytes=readFileSync(new URL(path,root)),item=catalog[path];
 item.bytes=bytes.length;item.hash=createHash('sha256').update(bytes).digest('hex');
 writeFileSync(new URL(item.script,root),'globalThis.SpawnerUnitAppearanceData['+JSON.stringify(path)+'] = '+JSON.stringify('data:'+item.mime+';base64,'+bytes.toString('base64'))+';\n');
}
writeFileSync(lazy,l.slice(0,start)+JSON.stringify(catalog,null,2)+l.slice(end+1));
