import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,battleUnit,askLetter,takeJob,countItem,FIST_ATK,addItem,equip,stats} from '../www/src/core/player.mjs';
import {createBattle,resolveRound} from '../www/src/core/battle.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:10,str:12,tgh:4,qui:4},elem:{earth:10},seed:7}).player;
const pack=[['wolf',3],['wolf',3],['wolf',3],['wolf',3],['wolf',3]];
test('拳師：空手拿推薦信、就職、空手攻擊加成、不能拿兵器',()=>{
 const p=mk();assert.ok(askLetter(p).ok);assert.equal(countItem(p,'letterFist'),1);assert.ok(takeJob(p,'fighter').ok);
 const u=battleUnit(p);assert.equal(u.weaponType,'fist');assert.equal(u.atk,stats(p).atk+FIST_ATK(p.lv));
 addItem(p,'swordC');assert.equal(equip(p,'swordC').ok,false);
});
test('隔山打牛打多個不同敵人；開碑手破防禦；運氣調息回血',()=>{
 const p=mk();p.job='fighter';p.skills=[{id:'qigong',lv:10,exp:0},{id:'smash',lv:5,exp:0},{id:'meditate',lv:3,exp:0}];
 const u=battleUnit(p);u.mp=999;u.hp=u.maxHp=99999;u.agi=999;
 let b=createBattle({party:[u],enemies:pack,seed:2});let ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'qigong',target:'e0'},{actor:'p',kind:'defend'}]);
 const hit=new Set(ev.filter(e=>(e.t==='hit'||e.t==='miss')&&e.a==='p').map(e=>e.d));assert.equal(hit.size,4);assert.ok(!ev.some(e=>e.t==='counter'));
 b=createBattle({party:[{...u}],enemies:[['wolf',3]],seed:4});const me=b.units[0];me.hp=10;
 ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'meditate'},{actor:'p',kind:'defend'}]);assert.ok(ev.some(e=>e.t==='heal'&&e.d==='p'&&e.n>0));
});
test('甲士：穿重甲拿劍會多給推薦信；捨身護主替隊友擋；固守如山減傷',()=>{
 const p=mk();addItem(p,'swordC');equip(p,'swordC');addItem(p,'mailL');equip(p,'mailL');assert.ok(askLetter(p).ok);assert.equal(countItem(p,'letterGuard'),1);assert.ok(takeJob(p,'guard').ok);
 p.skills=[{id:'cover',lv:5,exp:0},{id:'wall',lv:5,exp:0}];const me=battleUnit(p);me.mp=999;me.hp=me.maxHp=99999;
 const mate={...battleUnit(mk()),uid:'o_x',kind:'officer',ai:true,skills:[],slot:1,hp:500,maxHp:500};
 const b=createBattle({party:[me,mate],enemies:[['wolf',20],['wolf',20],['wolf',20]],seed:9});
 const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'cover',target:'o_x'},{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(e=>e.t==='cover'));assert.ok(!ev.some(e=>e.t==='hit'&&e.d==='o_x'&&!e.counter));
});
test('刺客：一擊必殺會秒雜兵、對頭目無效；淬毒刃下毒',()=>{
 const p=mk();p.job='assassin';p.skills=[{id:'kill',lv:10,exp:0},{id:'venom',lv:10,exp:0}];const me=battleUnit(p);me.mp=9999;me.hp=me.maxHp=99999;me.agi=999;
 let kills=0;for(let s=0;s<60;s++){const b=createBattle({party:[{...me}],enemies:[['wolf',30]],seed:s});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'kill',target:'e0'},{actor:'p',kind:'defend'}]);if(ev.some(e=>e.kill))kills++;}
 assert.ok(kills>0);
 const b=createBattle({party:[{...me,atk:1}],enemies:[['treant',30]],seed:3});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'venom',target:'e0'},{actor:'p',kind:'defend'}]);assert.ok(ev.some(e=>e.t==='status'&&e.st==='poison'));
});
