// 每個戰鬥技能都在戰鬥裡實際放一次（Lv1 和 Lv10），不能丟例外、血魔不能變成 NaN 或負數（第 13 輪補）
import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,battleUnit} from '../www/src/core/player.mjs';
import {createBattle,resolveRound} from '../www/src/core/battle.mjs';
import {SKILLS} from '../www/src/data/skills.mjs';
import {JOBS} from '../www/src/data/jobs.mjs';
import {ITEMS} from '../www/src/data/items.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:10,str:12,tgh:4,qui:4},elem:{earth:10},seed:7}).player;
const OFF_FIELD=['gather','field','craft'];
const ids=Object.keys(SKILLS).filter(id=>!OFF_FIELD.includes(SKILLS[id].kind)&&SKILLS[id].target);
test(`全部 ${ids.length} 個戰鬥技能都放得出來`,()=>{
 for(const id of ids)for(const lv of [1,10]){
  const s=SKILLS[id],p=mk();p.job=JOBS[s.teacher]?s.teacher:'sword';p.skills=[{id,lv,exp:0}];p.mp=9999;
  if(s.weapons&&!s.weapons.includes('fist'))p.equip.weapon=Object.keys(ITEMS).find(k=>ITEMS[k].slot==='weapon'&&ITEMS[k].type===s.weapons[0]); // 限定武器的技能
  const me={...battleUnit(p),uid:'p',mp:9999,maxMp:9999,hp:9999,maxHp:9999},mate={...battleUnit(mk()),uid:'q',slot:1};
  if(s.target==='dead')mate.hp=0;else if(s.kind==='heal'||s.kind==='cure')mate.hp=Math.max(1,mate.hp>>1);
  const b=createBattle({party:[me,mate],enemies:[['wolf',3],['wolf',3],['bat',3]],seed:lv*31+id.length});
  const target=s.target==='enemy'?'e0':s.target==='ally'||s.target==='dead'?'q':undefined;
  let ev;assert.doesNotThrow(()=>{ev=resolveRound(b,[{actor:'p',kind:'skill',skill:id,target},...(mate.hp?[{actor:'q',kind:'defend'}]:[])]);},`${id} Lv${lv}`);
  for(const u of b.units)assert.ok(Number.isFinite(u.hp)&&u.hp>=0&&Number.isFinite(u.mp)&&u.mp>=0,`${id} Lv${lv} 之後 ${u.uid} 血魔 ${u.hp}/${u.mp}`);
  assert.ok(ev.some(e=>e.t==='act'&&e.a==='p'&&e.skill===id),`${id} Lv${lv} 沒有放出來：${JSON.stringify(ev.filter(e=>e.a==='p'))}`);
 }
});
test('照原作可以選低等級放技能：耗魔照選的等級算，不能超過學會的等級',()=>{
 for(const [lv,want] of [[1,15],[3,45],[9,75]]){
  const p=mk();p.job='mage';p.rank=3;p.skills=[{id:'fire1',lv:5,exp:0}];
  const me={...battleUnit(p),uid:'p',mp:500,maxMp:500,hp:999,maxHp:999};
  const b=createBattle({party:[me],enemies:[['wolf',3]],seed:5});
  const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'fire1',lv,target:'e0'}]);
  const a=ev.find(e=>e.t==='act'&&e.a==='p');assert.equal(a.lv,Math.min(lv,5));assert.equal(500-a.mp,Math.min(want,75));
 }
});
test('原作補進來的技能：反擊必定回敬、戰慄襲心削魔、武器不合改普攻、一擊必中加必殺',()=>{
 const run=(id,lv,weapon,enemies=[['wolf',3]])=>{const p=mk();p.job='sword';p.skills=[{id,lv,exp:0}];if(weapon)p.equip.weapon=weapon;
  const me={...battleUnit(p),uid:'p',mp:999,maxMp:999,hp:9999,maxHp:9999};const b=createBattle({party:[me],enemies,seed:9});
  return {b,ev:resolveRound(b,[{actor:'p',kind:'skill',skill:id,target:id==='counter'?'p':'e0'}])};};
 const c=run('counter',5);const hits=c.ev.filter(e=>e.t==='hit'&&e.d==='p'&&!e.counter).length,cnt=c.ev.filter(e=>e.t==='counter'&&e.a==='p').length;
 assert.equal(cnt,hits,'被打幾次就反擊幾次');assert.equal(c.b.units[0].counterSt,0,'回合結束就收掉');
 const t=run('terror',4);const e0=t.b.units.find(u=>u.uid==='e0');assert.ok(t.ev.some(e=>e.t==='mpLoss'));assert.ok(e0.mp<e0.maxMp||e0.maxMp===0);
 const s=run('sure',3,'swordC');assert.ok(s.ev.some(e=>e.t==='msg'&&/用不了/.test(e.text)));
 assert.ok(run('sure',3,'bowW').ev.some(e=>e.t==='act'&&e.skill==='sure'));
 const tb=run('twobird',5,'swordC',[['wolf',3],['wolf',3],['bat',3],['bat',3],['bat',3],['wolf',3]]);
 assert.ok(tb.ev.filter(e=>e.t==='hit'||e.t==='miss').length>=1);
});
