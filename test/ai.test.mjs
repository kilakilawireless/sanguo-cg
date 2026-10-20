import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseEnemyAction} from '../www/src/core/ai.mjs';

const rng={chance:()=>true,next:()=>0};
const foe=(skill,st)=>({uid:'e1',side:'enemy',alive:true,mp:999,st,skills:[{id:skill,lv:3,pct:100}]});
const pl=(uid,st)=>({uid,side:'player',alive:true,st});

test('敵人遺忘中不放招', ()=>{
 const u=foe('combo',{k:'forget',n:2});
 assert.equal(chooseEnemyAction({units:[u,pl('p1')]},u,rng).kind,'attack');
});
test('敵人的異常魔法只對還沒中異常的人放', ()=>{
 const u=foe('sleep1');
 const c=chooseEnemyAction({units:[u,pl('p1',{k:'poison',n:2}),pl('p2')]},u,rng);
 assert.deepEqual([c.kind,c.skill,c.target],['skill','sleep1','p2']);
});
test('我方全員都中異常時，敵人不再放異常魔法', ()=>{
 const u=foe('stone1');
 assert.equal(chooseEnemyAction({units:[u,pl('p1',{k:'sleep',n:2})]},u,rng).kind,'attack');
});

import {chooseAllyAction} from '../www/src/core/ai.mjs';
const ally=(uid,skills,st)=>({uid,side:'player',alive:true,hp:100,maxHp:100,mp:999,st,skills:skills.map(id=>({id,lv:3}))});
test('傭兵遺忘中只普攻',()=>{
 const u=ally('a1',['heal','fire1'],{k:'forget',n:2}),hurt={...ally('a2',[]),hp:10};
 assert.equal(chooseAllyAction({units:[u,hurt,{uid:'e1',side:'enemy',alive:true}]},u,rng).kind,'attack');
});
test('傭兵會幫會用技能的隊友解遺忘，沒技能的不浪費',()=>{
 const u=ally('a1',['cure']),e={uid:'e1',side:'enemy',alive:true};
 let c=chooseAllyAction({units:[u,ally('a2',['fire1'],{k:'forget',n:2}),e]},u,rng);
 assert.deepEqual([c.skill,c.target],['cure','a2']);
 c=chooseAllyAction({units:[u,ally('a2',[],{k:'forget',n:2}),e]},u,rng);
 assert.notEqual(c.skill,'cure');
});
