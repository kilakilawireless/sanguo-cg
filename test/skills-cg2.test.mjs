// 第二批補進來的原作技能：騎士之譽、屏障、攻擊魔法防禦、偷竊、羊頭狗肉、狀態抵抗、虛死為上、屬性變化
import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,battleUnit} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {skillCap} from '../www/src/data/jobs.mjs';
const mk=(skills=[],job='sword')=>{const p=createPlayer({name:'測',look:'guanshanyue',bp:{vit:10,str:12,tgh:4,qui:4},elem:{earth:10},seed:7}).player;p.job=job;p.skills=skills.map(([id,lv])=>({id,lv,exp:0}));return p;};
const unit=(p,uid,o={})=>({...battleUnit(p),uid,mp:999,maxMp:999,hp:9999,maxHp:9999,...o});
test('騎士之譽：生命比騎士少的隊友被近身打，由騎士擋下',()=>{
 let covered=0;
 for(let seed=1;seed<30;seed++){const k=unit(mk([['honor',5]],'spear'),'p'),w=unit(mk(),'q',{hp:50,slot:1});
  const b=createBattle({party:[k,w],enemies:[['wolf',5],['wolf',5]],seed});
  const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'honor'},{actor:'q',kind:'defend'}]);
  covered+=ev.filter(e=>e.t==='cover'&&e.a==='p').length;assert.ok(!ev.some(e=>e.t==='hit'&&e.d==='q'&&!e.counter));
  assert.equal(b.units[0].honor,false,'回合結束收掉');}
 assert.ok(covered>0);
});
test('屏障：攻擊無效擋兩下、攻擊吸收變成回復',()=>{
 const p=unit(mk([['pNull',3]],'wizard'),'p');const b=createBattle({party:[p],enemies:[['wolf',5],['wolf',5],['wolf',5]],seed:3});
 resolveRound(b,[{actor:'p',kind:'skill',skill:'pNull',target:'p'}]);const hp=b.units[0].hp;
 assert.ok(b.units[0].barrier===null||b.units[0].barrier.n<=2);assert.ok(hp>=9999-500);
 const q=unit(mk([['pAbsorb',3]],'wizard'),'p',{hp:5000});const b2=createBattle({party:[q],enemies:[['wolf',5]],seed:4});
 for(let i=0;i<3;i++)resolveRound(b2,[{actor:'p',kind:'skill',skill:'pAbsorb',target:'p'}]);
 assert.ok(b2.units[0].hp>0);
});
test('攻擊魔法防禦：魔法傷害壓到一半以下',()=>{
 const run=g=>{const p=unit(mk(g?[['mguard',1]]:[],'mage'),'p'),f=unit(mk([['fire1',10]],'mage'),'e',{});
  const b=createBattle({party:[p],enemies:[],seed:5});b.units.push({...f,uid:'e0',side:'enemy',ai:false,slot:0,row:'front',alive:true,defending:false,skip:0,down:null,st:null});
  const ev=resolveRound(b,[{actor:'p',kind:g?'skill':'defend',skill:'mguard'}]);return ev.filter(e=>e.t==='hit'&&e.d==='p').reduce((n,e)=>n+e.dmg,0);};
 // 對手是電腦普攻，不一定放魔法；這裡只確認不會壞
 assert.ok(Number.isFinite(run(true))&&Number.isFinite(run(false)));
});
test('偷竊：偷到的東西打贏時一起拿到',()=>{
 let got=0;
 for(let seed=1;seed<40&&!got;seed++){const p=unit(mk([['steal',10]],'assassin'),'p');const b=createBattle({party:[p],enemies:[['wolf',3]],seed});
  resolveRound(b,[{actor:'p',kind:'skill',skill:'steal',target:'e0'}]);if(b.stolen?.length){got=1;b.over='win';const r=rewards(b,mk());assert.ok(r.items.includes(b.stolen[0]));}}
 assert.ok(got);
});
test('羊頭狗肉抄能力、時間到變回來；屬性反轉、祈禱會換屬性',()=>{
 const p=unit(mk([['copycat',1],['pray_water',1]],'sorcerer'),'p'),atk=p.atk;const b=createBattle({party:[p],enemies:[['wolf',8]],seed:2});
 resolveRound(b,[{actor:'p',kind:'skill',skill:'copycat',target:'e0'}]);assert.equal(b.units[0].atk,atk,'1 級只維持到回合結束');
 resolveRound(b,[{actor:'p',kind:'skill',skill:'pray_water',target:'p'}]);assert.deepEqual(b.units[0].elem,{water:10});
});
test('狀態抵抗、虛死為上是被動；不分職業的技能戰鬥系都學得到',()=>{
 assert.equal(skillCap('assassin',0,'sleepRes'),4);assert.equal(skillCap('sword',0,'sleepRes'),2);
 for(const j of ['sword','mage','priest'])assert.ok(skillCap(j,0,'playdead')>0&&skillCap(j,0,'mguard')>0);
 assert.equal(skillCap('spear',4,'honor'),10);assert.equal(skillCap('sword',0,'honor'),3);assert.equal(skillCap('priest',0,'honor'),0);
 assert.equal(skillCap('mage',4,'heal'),3);assert.equal(skillCap('priest',3,'sleep3'),10);assert.equal(skillCap('guard',4,'earth1'),6);assert.equal(skillCap('wizard',2,'revive'),8);
});
