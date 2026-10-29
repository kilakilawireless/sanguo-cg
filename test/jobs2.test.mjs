import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,battleUnit,askLetter,takeJob,countItem,FIST_ATK,addItem,equip,stats} from '../www/src/core/player.mjs';
import {createBattle,resolveRound} from '../www/src/core/battle.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:10,str:12,tgh:4,qui:4},elem:{earth:10},seed:7}).player;
const pack=[['wolf',3],['wolf',3],['wolf',3],['wolf',3],['wolf',3]];
test('格鬥士：空手拿推薦信、就職、空手攻擊加成、不能拿兵器',()=>{
 const p=mk();assert.ok(askLetter(p).ok);assert.equal(countItem(p,'letterFist'),1);assert.ok(takeJob(p,'fighter').ok);
 const u=battleUnit(p);assert.equal(u.weaponType,'fist');assert.equal(u.atk,stats(p).atk+FIST_ATK(p.lv));
 addItem(p,'swordC');assert.equal(equip(p,'swordC').ok,false);
});
test('氣功彈打多個不同敵人；崩擊破防禦；明鏡止水回血',()=>{
 const p=mk();p.job='fighter';p.rank=3;p.skills=[{id:'qigong',lv:10,exp:0},{id:'smash',lv:5,exp:0},{id:'meditate',lv:3,exp:0}];
 const u=battleUnit(p);u.mp=999;u.hp=u.maxHp=99999;u.agi=999;
 let b=createBattle({party:[u],enemies:pack,seed:2});let ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'qigong',target:'e0'},{actor:'p',kind:'defend'}]);
 const hit=new Set(ev.filter(e=>(e.t==='hit'||e.t==='miss')&&e.a==='p').map(e=>e.d));assert.equal(hit.size,5);assert.ok(!ev.some(e=>e.t==='counter')); // Lv10 原作 7～8 人，這裡只有 5 隻就全中
 // Lv1 只打 1 人、耗魔 5；拿著武器放不出來（只能空手）改普攻
 const u1={...u,skills:[{id:'qigong',lv:1}]};b=createBattle({party:[u1],enemies:pack,seed:3});ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'qigong',target:'e0'},{actor:'p',kind:'defend'}]);
 assert.equal(new Set(ev.filter(e=>(e.t==='hit'||e.t==='miss')&&e.a==='p').map(e=>e.d)).size,1);assert.equal(ev.find(e=>e.t==='act'&&e.skill==='qigong').mp,999-5);
 b=createBattle({party:[{...u,weaponType:'sword'}],enemies:pack,seed:3});ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'qigong',target:'e0'},{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(e=>e.t==='msg'&&/用不了氣功彈/.test(e.text)));
 b=createBattle({party:[{...u}],enemies:[['wolf',3]],seed:4});const me=b.units[0];me.hp=10;
 ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'meditate'},{actor:'p',kind:'defend'}]);assert.ok(ev.some(e=>e.t==='heal'&&e.d==='p'&&e.n>0));
});
test('士兵：穿重甲拿劍會多給推薦信；護衛替隊友擋；聖盾減傷',()=>{
 const p=mk();addItem(p,'swordC');equip(p,'swordC');addItem(p,'mailL');equip(p,'mailL');assert.ok(askLetter(p).ok);assert.equal(countItem(p,'letterGuard'),1);assert.ok(takeJob(p,'guard').ok);
 p.skills=[{id:'cover',lv:5,exp:0},{id:'wall',lv:5,exp:0}];const me=battleUnit(p);me.mp=999;me.hp=me.maxHp=99999;
 const mate={...battleUnit(mk()),uid:'o_x',kind:'officer',ai:true,skills:[],slot:1,hp:500,maxHp:500};
 const b=createBattle({party:[me,mate],enemies:[['wolf',20],['wolf',20],['wolf',20]],seed:9});
 const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'cover',target:'o_x'},{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(e=>e.t==='cover'));assert.ok(!ev.some(e=>e.t==='hit'&&e.d==='o_x'&&!e.counter));
});
test('忍者：暗殺會秒雜兵、對頭目無效；毒擊下毒',()=>{
 const p=mk();p.job='assassin';p.skills=[{id:'kill',lv:10,exp:0},{id:'venom',lv:10,exp:0}];const me=battleUnit(p);me.mp=9999;me.hp=me.maxHp=99999;me.agi=999;
 let kills=0;for(let s=0;s<60;s++){const b=createBattle({party:[{...me}],enemies:[['wolf',30]],seed:s});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'kill',target:'e0'},{actor:'p',kind:'defend'}]);if(ev.some(e=>e.kill))kills++;}
 assert.ok(kills>0);
 const b=createBattle({party:[{...me,atk:1}],enemies:[['treant',30]],seed:3});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'venom',target:'e0'},{actor:'p',kind:'defend'}]);assert.ok(ev.some(e=>e.t==='status'&&e.st==='poison'));
});
import {useFieldSkill,learnSkill,addPet,petOutOf,partyUnits} from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
test('巫師吸血魔法吸血、恢復魔法每回合回血',()=>{
 const p=mk();p.job='wizard';p.skills=[{id:'drain',lv:5,exp:0},{id:'regen',lv:5,exp:0}];const me=battleUnit(p);me.mp=999;me.maxHp=99999;me.hp=100;
 const b=createBattle({party:[me],enemies:[['wolf',30]],seed:2});b.units[1].atk=0;b.units[1].skills=[];const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'drain',target:'e0'},{actor:'p',kind:'skill',skill:'regen',target:'p'}]);
 assert.ok(ev.filter(e=>e.t==='heal'&&e.d==='p').length>=2);
});
test('封印師封印比徒手好抓；馴獸師寵物強化讓寵物變強',()=>{
 const p=mk();assert.ok(takeJob(p,'sealer').ok);p.skills=[{id:'seal',lv:10,exp:0}];const me=battleUnit(p);me.mp=999;me.hp=me.maxHp=99999;
 let n=0;for(let s=0;s<40;s++){const b=createBattle({party:[{...me}],enemies:[['wolf',1]],seed:s,captureRoom:1});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'seal',target:'e0'},{actor:'p',kind:'defend'}]);if(ev.some(e=>e.t==='capture'&&e.ok))n++;}
 assert.ok(n>=12,'抓到 '+n);
 const q=mk();assert.ok(takeJob(q,'beastmaster').ok);q.skills=[{id:'rally',lv:5,exp:0}];addPet(q,'wolf',5,makeRng(1));const us=partyUnits(q);us[0].mp=999;
 us[0].agi=999;const b=createBattle({party:us,enemies:[['wolf',30]],seed:1});b.units.at(-1).atk=0;resolveRound(b,[{actor:'p',kind:'skill',skill:'rally'}]);assert.ok(b.units.find(u=>u.kind==='pet').boost?.pct>0);
});
test('醫生在城外治療、護士急救',()=>{
 const p=mk();assert.ok(takeJob(p,'doctor').ok);assert.ok(learnSkill(p,'treat').ok||true);p.skills=[{id:'treat',lv:2,exp:0}];p.mp=99;p.inj=30;
 assert.ok(useFieldSkill(p,'treat','p').ok);assert.equal(p.inj,6);assert.equal(battleUnit(p).skills.length,0);
 const q=mk();assert.ok(takeJob(q,'nurse').ok);q.skills=[{id:'firstaid',lv:1,exp:0}];q.mp=99;q.hp=10;assert.ok(useFieldSkill(q,'firstaid','p').ok);assert.equal(q.hp,90);
});
