import test from 'node:test';import assert from 'node:assert/strict';
import {derive,validElement,singleCapAt,expFor} from '../www/src/core/stats.mjs';
import {physBase,elemMod,raceMod,dodgeRate,escapeRate,expFrom} from '../www/src/core/combat.mjs';
import {createPlayer,stats,addItem,equip,givePainkiller,askLetter,takeJob,learnSkill,promoteCheck,gainExp,allocBp,gainRep,answerQuiz,QUIZ,battleUnit,countItem} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards,actionsOf} from '../www/src/core/battle.mjs';
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
 assert.ok(askLetter(p).ok);assert.equal(countItem(p,'letterFist'),1);addItem(p,'swordC');assert.ok(equip(p,'swordC').ok);assert.ok(askLetter(p).ok);
 assert.ok(!takeJob(p,'axe').ok);const r=takeJob(p,'sword');assert.ok(r.ok,r.msg);assert.equal(p.job,'sword');assert.equal(countItem(p,'letterSword'),0);
 assert.ok(learnSkill(p,'combo').ok);
 // 轉職傳教士：答題、付錢、聲望歸零
 assert.ok(!answerQuiz(p,[1,0,0]).ok);assert.ok(answerQuiz(p,QUIZ.map(q=>q[2])).ok);p.gold=5000;p.rep=3000;
 const r2=takeJob(p,'priest');assert.ok(r2.ok,r2.msg);assert.equal(p.rep,0);assert.equal(p.equip.weapon,null);
});
test('晉級條件',()=>{const p=mk();p.job='sword';const c=promoteCheck(p);assert.equal(c.ok,false);p.lv=20;p.rep=10000;p.flags.treant=true;p.gold=1000;assert.ok(promoteCheck(p).ok);});
test('升級配點有單項上限',()=>{const p=mk();assert.deepEqual(gainExp(p,16),[2]);assert.equal(p.freeBp,4);assert.ok(allocBp(p,'vit',2).ok);assert.ok(!allocBp(p,'vit',1).ok);});
test('聲望不設每日上限，遊民不累積',()=>{const p=mk();assert.equal(gainRep(p,1000),0);p.job='sword';const r=p.rep;assert.equal(gainRep(p,5000),5000);assert.equal(p.rep,r+5000);});
test('戰鬥可重播且會結束',()=>{
 const run=()=>{const p=mk();addItem(p,'swordC');equip(p,'swordC');const b=createBattle({party:[battleUnit(p)],enemies:[['wolf',2],['bat',1]],seed:42});
  const all=[];for(let i=0;i<50&&!b.over;i++)all.push(...resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]));return {b,all};};
 const a=run(),c=run();assert.deepEqual(a.all,c.all);assert.ok(a.b.over);if(a.b.over==='win')assert.ok(rewards(a.b,mk()).exp>0);
});
import {recruit,dismiss,partyUnits,restCost,rest,syncParty} from '../www/src/core/player.mjs';
import {officerBp,officerGainExp} from '../www/src/core/officer.mjs';
import {singleCapAt as cap,totalBpAt} from '../www/src/core/stats.mjs';
test('傭兵招募、站位、點數上限',()=>{
 const p=mk();assert.ok(recruit(p,'dianwei').ok);assert.ok(!recruit(p,'taishici').ok);p.job='sword';p.gold=5000;
 for(const id of ['huatuo','taishici','zuoci'])assert.ok(recruit(p,id).ok);
 const us=partyUnits(p);assert.equal(us.length,5);assert.ok(us.every(u=>u.row==='back'));assert.equal(us[0].slot,0);
 const slots=us.filter(u=>u.row==='back').map(u=>u.slot);assert.equal(new Set(slots).size,slots.length);
 for(const lv of [1,10,40]){const bp=officerBp('zuoci',lv),vals=Object.values(bp).map(v=>v/100);assert.equal(vals.reduce((a,b)=>a+b,0),totalBpAt(lv));assert.ok(vals.every(v=>v<=cap(lv)));}
 const o=p.officers.dianwei;o.hp=1;assert.ok(restCost(p)>0);rest(p);assert.ok(o.hp>1);assert.ok(officerGainExp(o,10**4));
 assert.ok(dismiss(p,'zuoci').ok);assert.ok(p.officers.zuoci);assert.equal(partyUnits(p).length,4);
});
test('五人戰鬥：傭兵自己行動、羅蘭會補血',()=>{
 const p=mk();p.job='sword';p.gold=5000;for(const id of ['dianwei','huatuo'])recruit(p,id);
 const us=partyUnits(p);us[0].hp=10;const b=createBattle({party:us,enemies:[['wolf',1]],seed:3});
 const ev=resolveRound(b,[{actor:'p',kind:'defend'},{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(e=>e.t==='act'&&e.a==='o_huatuo'&&e.skill==='heal'));assert.ok(ev.some(e=>e.a==='o_dianwei'));
});
import {addPet,petOutOf,releasePet} from '../www/src/core/player.mjs';
import {captureRate,petStats,petGainExp} from '../www/src/core/pet.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
test('寵物：捕捉、出戰時主角只行動一次、經驗',()=>{
 const p=mk();const pet=addPet(p,'wolf',3,makeRng(1));assert.equal(petOutOf(p),pet);assert.ok(pet.grade.every((g,i)=>Math.abs(g-[26,40,20,30,4][i])<=2));
 const us=partyUnits(p);assert.equal(us.find(u=>u.kind==='pet').row,'front');
 const b=createBattle({party:us,enemies:[['bat',1],['chief',3]],seed:9,captureRoom:4});assert.equal(actionsOf(b,us[0]),1);
 const bat=b.units.find(u=>u.mon==='bat'),chief=b.units.find(u=>u.mon==='chief');assert.equal(captureRate(us[0],chief),0);bat.hp=1;
 let got=false;for(let i=0;i<20&&!got;i++){if(!bat.alive)break;const ev=resolveRound(b,[{actor:'p',kind:'capture',target:bat.uid},{actor:'pet',kind:'defend'}]);got=ev.some(e=>e.t==='capture'&&e.ok);}
 assert.ok(got||!bat.alive);const lv=pet.lv;petGainExp(pet,10**4);assert.ok(pet.lv>lv);assert.ok(releasePet(p,pet.uid).ok);assert.equal(p.petOut,null);
});
import {petLearn,petForget} from '../www/src/core/player.mjs';
test('寵物學技能：技能欄 4 格含天生的，天生的忘不掉',()=>{
 const p=mk();p.gold=1e4;const x=addPet(p,'bee',12,makeRng(1));
 assert.ok(petLearn(p,x.uid,'combo').ok);assert.ok(!petLearn(p,x.uid,'combo').ok);assert.equal(x.learned[0].lv,2);assert.equal(p.gold,1e4-300*2); // 學費×學到的等級
 assert.ok(petLearn(p,x.uid,'heal').ok);assert.ok(petLearn(p,x.uid,'fire1').ok);assert.ok(!petLearn(p,x.uid,'allin').ok);
 assert.ok(!petForget(p,x.uid,'poison1').ok);assert.ok(petForget(p,x.uid,'heal').ok);
 assert.deepEqual(partyUnits(p).find(u=>u.kind==='pet').skills.map(s=>s.id),['poison1','combo','fire1']);
});
