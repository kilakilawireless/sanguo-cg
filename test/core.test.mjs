import test from 'node:test';import assert from 'node:assert/strict';
import {derive,validElement,singleCapAt,expFor} from '../www/src/core/stats.mjs';
import {physBase,elemMod,raceMod,dodgeRate,escapeRate,expFrom} from '../www/src/core/combat.mjs';
import {createPlayer,stats,addItem,equip,givePainkiller,askLetter,takeJob,learnSkill,promoteCheck,gainExp,allocBp,gainRep,tickRep,answerQuiz,QUIZ,battleUnit,countItem} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:15,str:15,tgh:0,qui:0,mgc:0},elem:{fire:10},seed:7}).player;
test('衍生值照原作係數',()=>{const s=derive({vit:1500,str:1500});assert.equal(s.hp,20+120+30);assert.equal(s.atk,51);});
test('屬性必須相鄰',()=>{assert.ok(validElement({earth:5,wind:5}));assert.ok(!validElement({earth:5,fire:5}));assert.ok(!validElement({fire:9}));});
test('單項上限與經驗',()=>{assert.equal(singleCapAt(1),15);assert.equal(singleCapAt(11),35);assert.equal(expFor(10),10000);});
test('物理公式',()=>{assert.equal(Math.round(physBase(60,20)),90);assert.equal(elemMod({fire:10},{wind:10}),30);assert.equal(elemMod({fire:10},{water:10}),-30);});
test('種族剋制',()=>{assert.equal(raceMod('human','beast'),20);assert.equal(raceMod('beast','human'),-20);});
test('閃躲、逃跑、經驗',()=>{assert.equal(dodgeRate(50,50),1);assert.equal(dodgeRate(50,100),50);assert.ok(escapeRate(1,3,5,5)>.3);assert.equal(expFrom(1,1),7);});
test('創角驗證',()=>{assert.ok(!createPlayer({name:'a',look:'x',bp:{vit:16,str:14},elem:{fire:10}}).ok);assert.ok(!createPlayer({name:'a',look:'x',bp:{vit:10,str:10},elem:{fire:10}}).ok);});
test('就職流程：止痛藥→通行證→推薦信→就職',()=>{
 const p=mk();assert.ok(!givePainkiller(p).ok);addItem(p,'painkiller');assert.ok(givePainkiller(p).ok);assert.equal(countItem(p,'trialPass'),1);
 assert.ok(!askLetter(p).ok);addItem(p,'swordC');assert.ok(equip(p,'swordC').ok);assert.ok(askLetter(p).ok);
 assert.ok(!takeJob(p,'axe').ok);const r=takeJob(p,'sword');assert.ok(r.ok,r.msg);assert.equal(p.job,'sword');assert.equal(countItem(p,'letterSword'),0);
 assert.ok(learnSkill(p,'combo').ok);
 // 轉職道士：答題、付錢、聲望歸零
 assert.ok(!answerQuiz(p,[1,0,0]).ok);assert.ok(answerQuiz(p,QUIZ.map(q=>q[2])).ok);p.gold=5000;p.rep=3000;
 const r2=takeJob(p,'priest');assert.ok(r2.ok,r2.msg);assert.equal(p.rep,0);assert.equal(p.equip.weapon,null);
});
test('晉級條件',()=>{const p=mk();p.job='sword';const c=promoteCheck(p);assert.equal(c.ok,false);p.lv=20;p.rep=10000;p.flags.treant=true;p.gold=1000;assert.ok(promoteCheck(p).ok);});
test('升級配點有單項上限',()=>{const p=mk();assert.deepEqual(gainExp(p,16),[2]);assert.equal(p.freeBp,4);assert.ok(allocBp(p,'vit',2).ok);assert.ok(!allocBp(p,'vit',1).ok);});
test('聲望每日上限',()=>{const p=mk();p.job='sword';const t=Date.now();assert.equal(gainRep(p,1000,t),800);assert.equal(gainRep(p,10,t),0);tickRep(p,t+864e5*10);assert.equal(p.repPool,4800);});
test('戰鬥可重播且會結束',()=>{
 const run=()=>{const p=mk();addItem(p,'swordC');equip(p,'swordC');const b=createBattle({party:[battleUnit(p)],enemies:[['wolf',2],['bat',1]],seed:42});
  const all=[];for(let i=0;i<50&&!b.over;i++)all.push(...resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]));return {b,all};};
 const a=run(),c=run();assert.deepEqual(a.all,c.all);assert.ok(a.b.over);if(a.b.over==='win')assert.ok(rewards(a.b,mk()).exp>0);
});
