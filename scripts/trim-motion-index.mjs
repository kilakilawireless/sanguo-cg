// 只留下 assets/motion-data 有的角色，縮小 motion-index.mjs。
import fs from 'node:fs';
const root=new URL('../www/',import.meta.url).pathname;
const {MOTION_INDEX}=await import(root+'src/motion-index.mjs');
const ids=new Set(fs.readdirSync(root+'assets/motion-data').map(f=>f.replace('.json','')));
const out=MOTION_INDEX.map(s=>{const characters=s.characters.filter(c=>ids.has(c.id));
 const files=new Set(characters.flatMap(c=>JSON.parse(fs.readFileSync(root+'assets/motion-data/'+c.id+'.json')).files));
 const sourceFiles=s.sourceFiles.filter(f=>files.has(f));return {...s,sourceFiles,assets:Object.fromEntries(sourceFiles.map(f=>[f,s.assets[f]])),characters};}).filter(s=>s.characters.length);
fs.writeFileSync(root+'src/motion-index.mjs','// 由 scripts/split-motions.mjs 產生（群俠江湖），scripts/trim-motion-index.mjs 只留本作用到的角色。請勿手改。\nexport const MOTION_INDEX='+JSON.stringify(out)+';\n');
console.log(out.reduce((n,s)=>n+s.characters.length,0),'characters');
