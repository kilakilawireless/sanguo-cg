// 從關山月（../guanshan-srpg，素材來自群俠江湖）搬動作圖過來，只讀不改原專案。node scripts/sync-art.mjs 角色id ...
// 搬完會用關山月的完整名冊重新產生 motion-index.mjs，只留 assets/motion-data 有的角色，再跑 split-idle.mjs 切待機小圖。
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const src=new URL('../../guanshan-srpg/www/',import.meta.url).pathname,dst=new URL('../www/',import.meta.url).pathname;
const {MOTION_INDEX}=await import(src+'src/motion-index.mjs');
for(const id of process.argv.slice(2)){
 const set=MOTION_INDEX.find(s=>s.characters.some(c=>c.id===id));if(!set){console.log('找不到',id);continue;}
 fs.copyFileSync(src+'assets/motion-data/'+id+'.json',dst+'assets/motion-data/'+id+'.json');
 for(const f of JSON.parse(fs.readFileSync(src+'assets/motion-data/'+id+'.json')).files){const rel=set.assets[f].replace('./','');fs.mkdirSync(dst+rel.replace(/[^/]+$/,''),{recursive:true});fs.copyFileSync(src+rel,dst+rel);}
 console.log('搬了',id);
}
fs.copyFileSync(src+'src/motion-index.mjs',dst+'src/motion-index.mjs');
execFileSync('node',[new URL('./trim-motion-index.mjs',import.meta.url).pathname],{stdio:'inherit'});
// 待機格切成小圖（城鎮只下載小圖），也把切好的小圖登記回剛重寫的 motion-index.mjs
execFileSync('node',[new URL('./split-idle.mjs',import.meta.url).pathname],{stdio:'inherit'});
