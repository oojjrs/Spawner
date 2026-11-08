// Read tracked JavaScript directly from HEAD for a baseline test without a second checkout.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';
const root=resolve(process.cwd());
export async function load(url,context,nextLoad){
 if(url.startsWith('file:')){
  const file=fileURLToPath(url),path=relative(root,file);
  if(!path.startsWith('..')&&/\.(?:mjs|js)$/.test(path)){
   try{return {format:'module',shortCircuit:true,source:execFileSync('git',['show','HEAD:'+path],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','ignore']})};}catch{}
  }
 }
 return nextLoad(url,context);
}
