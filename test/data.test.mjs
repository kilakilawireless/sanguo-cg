// 資料一致性：各資料檔互相引用的代號都要存在，原始碼裡也不能有重複代號（JS 物件重複的鍵會靜靜蓋掉前一個）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ITEMS,SHOPS} from '../www/src/data/items.mjs';
import {MONSTERS} from '../www/src/data/monsters.mjs';
import {SKILLS} from '../www/src/data/skills.mjs';
import {JOBS} from '../www/src/data/jobs.mjs';
import {PLACES,ROADS,TOWNS} from '../www/src/data/places.mjs';
import {QUESTS,QUEST_ORDER} from '../www/src/data/quests.mjs';
import {OFFICERS,OFFICER_ORDER} from '../www/src/data/officers.mjs';
import {RECIPES} from '../www/src/data/recipes.mjs';
import {PET_SKILL_SHOP} from '../www/src/core/pet.mjs';

test('資料檔沒有重複代號',()=>{
 for(const f of ['items','monsters','skills','jobs','quests','officers']){
  const src=readFileSync(new URL(`../www/src/data/${f}.mjs`,import.meta.url),'utf8');
  const ids=[...src.matchAll(/^ {1,2}([A-Za-z0-9_]+):\{/gm)].map(m=>m[1]).filter(k=>!['need','reward','boss','gather'].includes(k));
  assert.deepEqual(ids.filter((x,i)=>ids.indexOf(x)!==i),[],f);
 }
});
test('怪物、地點、任務引用的代號都存在',()=>{
 for(const [id,m] of Object.entries(MONSTERS))for(const [s] of m.skills||[])assert.ok(SKILLS[s],`${id} 技能 ${s}`);
 const flags=new Set(Object.values(PLACES).map(p=>p.flag).filter(Boolean));
 for(const [id,p] of Object.entries(PLACES)){
  const groups=[...(p.mons||[]),...(p.boss?.group||[])];
  for(let f=1;f<=(p.floors||1);f++)groups.push(...(p.floorMons?.(f)||[]));
  for(const [m] of groups)assert.ok(MONSTERS[m],`${id} 怪物 ${m}`);
  if(p.reward)assert.ok(ITEMS[p.reward],`${id} 獎勵 ${p.reward}`);
  if(p.needFlag)assert.ok(flags.has(p.needFlag),`${id} 需要旗標 ${p.needFlag}`);
  if(p.home)assert.ok(TOWNS.includes(p.home),`${id} 回城 ${p.home}`);
 }
 for(const r of ROADS)for(const id of r)assert.ok(PLACES[id],`路 ${id}`);
 assert.deepEqual([...QUEST_ORDER].sort(),Object.keys(QUESTS).sort());
 for(const [id,q] of Object.entries(QUESTS)){
  assert.ok(PLACES[q.town],`${id} 城 ${q.town}`);
  if(q.need.kill)assert.ok(MONSTERS[q.need.kill],`${id} 要打 ${q.need.kill}`);
  if(q.need.item)assert.ok(ITEMS[q.need.item],`${id} 要交 ${q.need.item}`);
  if(q.reward.item)assert.ok(ITEMS[q.reward.item[0]],`${id} 獎勵 ${q.reward.item[0]}`);
 }
});
test('商店、配方、職業、傭兵、寵物技能引用的代號都存在',()=>{
 for(const s of Object.values(SHOPS))for(const id of s.stock)assert.ok(ITEMS[id]?.price>0,`商店 ${id}`);
 for(const [id,r] of Object.entries(RECIPES)){assert.ok(ITEMS[id],`配方 ${id}`);assert.equal(SKILLS[r.skill]?.kind,'craft',`配方 ${id} 技能 ${r.skill}`);}
 for(const [id,j] of Object.entries(JOBS)){for(const s of [...j.main,...j.sub])assert.ok(SKILLS[s],`${id} 技能 ${s}`);if(j.letter)assert.ok(ITEMS[j.letter],`${id} 推薦信 ${j.letter}`);}
 assert.deepEqual([...OFFICER_ORDER].sort(),Object.keys(OFFICERS).sort());
 for(const [id,o] of Object.entries(OFFICERS)){assert.ok(JOBS[o.job],`${id} 職業`);for(const s of o.skills)assert.ok(SKILLS[s],`${id} 技能 ${s}`);}
 for(const id of Object.keys(PET_SKILL_SHOP))assert.ok(SKILLS[id],`寵物技能 ${id}`);
 for(const [id,s] of Object.entries(SKILLS))if(s.teacher)assert.ok(JOBS[s.teacher],`${id} 老師 ${s.teacher}`);
 for(const id of ['crystalS','crystalM','crystalL','potion','potion2'])assert.ok(ITEMS[id],`掉落 ${id}`);
});
