import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

test('generated runtime parses import aliases as destructuring aliases',()=>{
 const code=readFileSync(new URL('./runtime.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(code));
 assert.match(code,/SPRING_BIRTH_ANIMATION:\s*birth/);
 assert.match(code,/combatDodgePose/);
});
test('generated combat laboratory inline scripts parse with the approved shared dodge',()=>{
 const html=readFileSync(new URL('../Combat.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
 assert.ok(scripts.length>0);for(const code of scripts)assert.doesNotThrow(()=>new Script(code));
 assert.ok(scripts.some(code=>code.includes('combatDodgePose')));
});
