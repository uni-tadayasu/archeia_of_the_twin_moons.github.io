import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {ROSTER,STAGES,getEncounter} from '../rebirth/catalog.mjs';
const root=process.cwd();
const exists=async p=>{try{await access(path.join(root,p));}catch{throw Error(`Missing local asset: ${p}`);}};
for(const file of (await readdir('rebirth')).filter(f=>f.endsWith('.mjs'))){const r=spawnSync(process.execPath,['--check',`rebirth/${file}`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
for(const file of ['index.html','classic.html','rebirth/style.css','assets/vendor/three/three.module.min.js','assets/vendor/three/three.core.min.js','assets/vendor/three/LICENSE','assets/vendor/draco/draco_decoder.wasm','assets/vendor/draco/draco_wasm_wrapper.js','assets/vendor/meshopt_decoder.module.js'])await exists(file);
const html=await readFile('index.html','utf8');
assert.match(html,/rebirth\/app\.mjs/,'New entry point must launch the independent engine');
assert.doesNotMatch(html,/src=["'](?:\.\/)?main\.js/,'Classic engine must not execute in Rebirth');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate DOM ids');
const app=await readFile('rebirth/app.mjs','utf8');
const optionalIds=new Set(['home-progress','selection-mode','stage-note','asset-progress','asset-message','favorite-button','boot-status']);
for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))if(!optionalIds.has(id))assert.ok(ids.includes(id),`Missing application DOM target ${id}`);
for(const [,url]of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){if(/^(https?:|#|data:|blob:)/.test(url))continue;await exists(url.split(/[?#]/)[0].replace(/^\.\//,''));}
const checked=new Set();
async function checkModule(file){if(checked.has(file))return;checked.add(file);const source=await readFile(file,'utf8');for(const [,spec]of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){if(!spec.startsWith('.'))continue;const resolved=path.normalize(path.join(path.dirname(file),spec.split('?')[0]));await exists(resolved);if(/\.(m?js)$/.test(resolved))await checkModule(resolved);}}
await checkModule('rebirth/app.mjs');await checkModule('rebirth/renderer.mjs');
const defs=[...ROSTER,...Array.from({length:4},(_,n)=>getEncounter('story',n).enemies).flat()];
for(const f of defs){assert.ok(f.hp>0&&f.skills.length>=4,`Invalid fighter ${f.id}`);await exists(f.model);await exists(f.face.split('?')[0]);const bytes=await readFile(f.model);assert.equal(bytes.readUInt32LE(0),0x46546c67,`Invalid GLB ${f.model}`);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());for(const b of [...gltf.buffers||[],...gltf.images||[]]){if(b.uri&&!b.uri.startsWith('data:'))await exists(path.join(path.dirname(f.model),b.uri));}}
for(const s of STAGES)await exists(s.image);
for(const name of ['title-theme','story-theme','battle-theme','event-theme'])await exists(`assets/audio/${name}.mp3`);
assert.equal(ROSTER.length,14,'Expected original public roster');
console.log(`Rebirth checks passed: ${checked.size} local modules, ${ROSTER.length} fighters, ${STAGES.length} stages, DOM contract and GLB dependencies.`);
