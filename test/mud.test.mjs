// 文字版擂台：一個人出戰、擂台電腦代打、常駐好手
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {ITEMS} from '../www/src/data/items.mjs';
import * as B from '../www/src/core/battle.mjs';
import * as S from '../www/src/data/skills.mjs';
import {GENERALS} from '../www/src/mud/generals.mjs';

const hero=job=>{const p=R.newHero({name:'測試',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:3}).player;R.joinJob(p,job);return p;};

test('公會直接就職，不留推薦信', ()=>{
 const p=hero('sword');assert.equal(p.job,'sword');assert.equal(P.countItem(p,'letterSword'),0);
 assert.equal(R.joinJob(p,'priest').ok,false); // 轉職要 1000 金
});
test('3 級以前一次只遇 1 隻，怪最多高 1 級', ()=>{
 for(let i=0;i<100;i++){const {enemies}=R.encounter('suburb',makeRng(i),1);assert.equal(enemies.length,1);assert.ok(enemies[0][1]<=2);}
});
test('練功一群最多 2 隻', ()=>{
 for(let i=0;i<200;i++){const {enemies}=R.encounter(['suburb','trial','camp','forest'][i%4],makeRng(i));assert.ok(enemies.length>=1&&enemies.length<=R.SOLO_GROUP_MAX);}
});
test('擂台：對面一回合也動兩次，30 回合內分出結果', ()=>{
 const [a,b]=R.npcRivals().slice(4,6);
 const t=R.startBout(a.fighter,b.fighter,7);t.units[0].ai=true;
 let acts=0;while(!t.over){for(const e of R.resolveRound(t,[]))if(e.t==='act'&&e.a==='e0')acts++;R.boutTimeout(t);}
 assert.ok(['win','lose','draw'].includes(t.over));assert.ok(t.round<=R.BOUT_ROUNDS);assert.ok(acts>=t.round);
});
test('公開資料讀回來打得起來', ()=>{
 const p=hero('mage'),f=R.fighterFrom(R.publicOf(p));assert.equal(f.job,'mage');assert.equal(R.fighterFrom({v:1,hero:'{}'}),null);
 const b=R.startBout(p,f,1);assert.equal(b.units.length,2);
});
test('擂台的諸刃比原作多三成、聖盾低等級撐兩回合', ()=>{
 const p=hero('guard');p.skills=[{id:'wall',lv:1,exp:0}];
 const b=R.startHunt(p,'suburb',5),u=R.allies(b)[0];u.mp=999;u.hp=u.maxHp=99999;
 R.resolveRound(b,[{actor:'p',kind:'skill',skill:'wall',target:'p'}]);assert.equal(u.wallLeft,1);assert.ok(u.wall>0);
 R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(u.wall,0);
 assert.match(R.skillDesc('blade',2),/攻擊 \+18%/);assert.match(R.skillDesc('combo',10),/平均普攻的 180%/);assert.match(R.skillDesc('allin',10),/傷害 230%/);
});
test('隨行夥伴：一起練功、各自拿經驗、可以換人帶頭', ()=>{
 const p=hero('sword');p.lv=5;p.gold=0;
 assert.equal(R.addMate(p,{name:'關羽',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:9}).ok,false); // 不能同一位
 assert.ok(R.addMate(p,{name:'關羽',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{water:10},seed:9}).ok);
 p.mate.job='sword';p.mate.rep=0;p.rep=0; // 聲望每個出戰的人都加（Leo 2026-10-28）
 let won=false;
 for(let i=0;i<30&&!won;i++){const b=R.startHunt(p,'suburb',i);assert.equal(R.allies(b).length,2);
  for(let r=0;r<40&&!b.over;r++)R.resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
  if(b.over==='win'&&b.units.find(u=>u.uid==='m').alive){R.finishHunt(p,b);won=true;}else R.finishHunt(p,b);}
 assert.ok(won);assert.ok(p.mate.exp>0);assert.ok(p.mate.rep>0);assert.ok(p.rep>0);
 const mateName=p.mate.name;p.gold=7;R.swapMate(p);assert.equal(p.name,mateName);assert.equal(p.mate.name,'測試');assert.equal(p.gold,7); // 錢共用
 R.swapMate(p);assert.equal(p.name,'測試');
});
test('技能大師只教自己那一行', ()=>{
 const m=R.MASTERS.find(x=>x.job==='axe');assert.deepEqual(m.skills,['blade','focus']);
 assert.ok(R.MASTERS.every(x=>x.skills.every(id=>!['seal','rally'].includes(id))));
});
import * as D from '../www/src/mud/dungeon.mjs';
import * as E from '../www/src/mud/events.mjs';
test('打造：材料夠、錢夠才做得出來', ()=>{
 const p=hero('sword');p.gold=1000;
 assert.equal(D.forge(p,'cg_sword_1').ok,false);
 P.addItem(p,'copper',6);P.addItem(p,'pine',1);
 const f1=D.forge(p,'cg_sword_1');assert.ok(f1.ok);assert.equal(P.countItem(p,f1.out),1);assert.equal(P.countItem(p,'copper'),0);
 const [lo,hi]=ITEMS.cg_sword_1.rng.atk;assert.ok(ITEMS[f1.out].atk>=lo&&ITEMS[f1.out].atk<=hi,'攻擊在範圍內浮動');
 assert.deepEqual(D.RECIPES.dragonSword.mats,[['rustySword',1],['knightOre',2],['demonCrystal',2],['phantomBar',20]]); // 照原作
 assert.equal(ITEMS.dragonSword.atk,210);assert.equal(ITEMS.dragonSword.lv,7);
 // 加寶石：藍寶石 5 級＝攻擊 +11%
 D.addMat(p,'copper',6);D.addMat(p,'pine',1);D.addMat(p,'gem_blue_5',1);p.gold=1000;
 const f2=D.forge(p,'cg_sword_1','gem_blue_5',()=>.5);assert.ok(f2.ok);const r2=f2.out.split('@')[0];assert.equal(ITEMS[f2.out].atk,ITEMS[r2].atk+Math.round(ITEMS[r2].atk*11/100));
 assert.equal(p.mats.gem_blue_5,undefined);
 assert.ok(R.shopStock('weapon').every(id=>ITEMS[id].cheap));
});
test('地下城：三層，最深處是王，打倒掉寶石', ()=>{
 assert.equal(D.DUNGEONS.length,26);assert.equal(D.DUNGEONS[0].boss,'楓楓洋洋');assert.equal(D.DUNGEONS[1].boss,'笑死人');
 const p=hero('sword');p.lv=10;assert.ok(D.enterDungeon(p,'d1').ok);
 let b=D.startFloor(p,1);assert.ok(R.foes(b).every(u=>u.kind==='monster'));
 p.dg.floor=3;b=D.startFloor(p,2);const boss=R.foes(b)[0];assert.equal(boss.name,'楓楓洋洋');assert.ok(boss.boss&&boss.ai);
 boss.hp=0;boss.alive=false;b.over='win';const r=D.finishFight(p,b);
 assert.ok(r.cleared);assert.equal(p.dg,null);assert.ok(Object.keys(p.mats).some(id=>D.parseGem(id)));
});
test('晉級：等級、聲望、錢，加上通關 Damonk 的地下城', ()=>{
 const p=hero('axe');p.lv=20;p.rep=10000;p.gold=1000;
 assert.equal(D.promoteCheck(p).ok,false);assert.ok(D.promoteCheck(p).rows.some(r=>r[0].includes('Damonk')));
 p.flags.treant=true;assert.ok(D.promote(p).ok);assert.equal(p.rank,1);
 p.rank=2;p.equip.weapon='dragonAxe';assert.equal(P.battleUnit(p).critMod,18); // 水龍之斧必殺 +18
});
test('盾：照原作的職業上限、可以打造、水龍之盾', ()=>{
 const s=hero('sword'),m=hero('mage'),b=hero('bow');
 assert.ok(P.canEquip(s,'shieldR').ok);assert.equal(P.canEquip(m,'shieldR').ok,false);
 assert.ok(P.canEquip(b,'shieldV').ok);assert.equal(P.canEquip(b,'shieldS').ok,false); // 弓箭手的盾只到 3 級
 assert.ok(D.RECIPES.shieldR&&D.RECIPES.dragonShield);assert.equal(D.recipeKind('dragonShield'),'dragon');
 P.addItem(s,'shieldR');assert.ok(P.equip(s,'shieldR').ok);assert.equal(s.equip.shield,'shieldR');
 assert.equal(P.stats(s).def,P.stats({...s,equip:{...s.equip,shield:null}}).def+9);assert.ok(P.battleUnit(s).avoidMod<0);
});
test('陳小白的地下城有兩個王（陳小白與 KLY）', ()=>{
 const d=D.DUNGEONS.find(x=>x.boss1==='陳小白'),p=hero('sword');p.lv=60;assert.ok(D.enterDungeon(p,d.id).ok);p.dg.floor=3;
 const b=D.startFloor(p,4),bs=R.foes(b);assert.deepEqual(bs.map(u=>u.name),['陳小白','KLY']);assert.ok(bs.every(u=>u.boss&&u.ai));
 assert.ok(['小吃','鮭魚','學測'].every(n=>D.DUNGEONS.some(x=>x.boss===n)));assert.equal(new Set(D.DUNGEONS.map(x=>x.id)).size,26);
});
test('近戰只打得到前排、弓打得到後排', ()=>{
 for(const [job,w,want] of [['sword','cg_sword_1','e1'],['bow','cg_bow_1','e0']]){
  const p=hero(job);p.lv=60;p.equip.weapon=w;D.enterDungeon(p,D.DUNGEONS.find(x=>x.pair).id);p.dg.floor=3;const b=D.startFloor(p,7),me=R.allies(b)[0];me.hp=me.maxHp=99999;
  const ev=R.resolveRound(b,[{actor:me.uid,kind:'attack',target:'e0'},{actor:me.uid,kind:'attack',target:'e0'}]);
  const first=ev.find(e=>(e.t==='hit'||e.t==='miss')&&e.a===me.uid);assert.equal(first.d,want,job);
 }
});
test('寶石：原作三組＋任務活動寵物寶石都在；合成三顆同種升級、不同種隨機同等級', ()=>{
 assert.ok(Object.keys(D.GEM_TYPES).length>=35);assert.ok(D.parseGem('gem_pearl_10')&&D.parseGem('gem_mouse_2')&&!D.parseGem('gem_mouse_4')&&D.parseGem('gem_pet_fire_6'));
 const p=hero('sword');p.mats={gem_blue_3:3,gem_pearl_2:1,gem_opal_2:1,gem_tin_2:1,gem_mouse_1:1};p.gold=0;
 assert.match(D.fuseGems(p,['gem_blue_3','gem_blue_3','gem_blue_3']).msg,/工錢要 900 金/);p.gold=1300;
 assert.ok(D.fuseGems(p,['gem_blue_3','gem_blue_3','gem_blue_3']).ok);assert.equal(p.mats.gem_blue_4,1);assert.ok(!p.mats.gem_blue_3);
 const r=D.fuseGems(p,['gem_pearl_2','gem_opal_2','gem_tin_2'],()=>0);assert.ok(r.ok);assert.equal(D.parseGem(r.out).g,2);
 assert.ok(!D.fuseGems(p,['gem_blue_4','gem_mouse_1','gem_mouse_1']).ok,'等級不同、數量不夠都不行');assert.equal(p.gold,0,'工錢 900＋400');
 assert.ok(ITEMS[D.withGem('cg_sword_1','gem_tin_5')].rstone>0,'抗異常寶石加在兵器上');
});
test('連擊：每下固定 50%，次數隨機，平均約 100+8L%', ()=>{
 const p=hero('sword');p.skills=[{id:'combo',lv:10,exp:0}];const counts={};
 for(let s=1;s<200;s++){const b=R.startHunt(p,'suburb',s),u=R.allies(b)[0];u.mp=999;u.hitMod=999;
  const ev=R.resolveRound(b,[{actor:'p',kind:'skill',skill:'combo',target:R.foes(b)[0].uid}]);const n=ev.filter(e=>e.a==='p'&&(e.t==='hit'||e.t==='miss')&&!e.counter).length;counts[n]=(counts[n]||0)+1;}
 const keys=Object.keys(counts).map(Number);assert.ok(Math.min(...keys)>=1&&Math.max(...keys)<=6&&keys.length>=3,JSON.stringify(counts));
});
test('咒術師併進傳教士：咒術在傳教士本行、大師那邊學得到，舊存檔轉傳教士', async ()=>{
 const {skillCap,CAPS}=await import('../www/src/data/jobs.mjs');
 for(const id of ['poison3','stone2','pray_fire','reverse','heal3'])assert.equal(skillCap('priest',4,id),CAPS.main[4],id);
 assert.ok(!R.MUD_JOBS.includes('sorcerer'));assert.ok(R.MASTERS.find(m=>m.job==='priest').skills.includes('poison1'));
 const {fixHero}=await import('../www/src/mud/online.mjs');const p=hero('sword');p.job='sorcerer';p.rank=2;p.mud=1;assert.equal(fixHero(p).job,'priest');assert.equal(p.rank,2);
});
test('文字版中毒會毒死人，扣血看技能等級', async ()=>{
 const {createBattle,resolveRound}=await import('../www/src/core/battle.mjs');
 const b=createBattle({party:[{...P.battleUnit(hero('sword')),uid:'p'}],enemies:[['wolf',3]],seed:1});b.mods=R.MODS;
 const e=b.units.find(u=>u.uid==='e0');e.hp=3;e.st={k:'poison',n:3,L:10};
 const ev=resolveRound(b,[{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(x=>x.t==='die'&&x.d==='e0'));assert.equal(b.over,'win');
 e.alive=true;e.hp=e.maxHp=1000;e.st={k:'poison',n:3,L:4};b.over=null;resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(e.hp,900);
});
test('文字版一回合技能只能放一次，第二個技能改普攻', async ()=>{
 const {createBattle,resolveRound}=await import('../www/src/core/battle.mjs');
 const p=hero('sword');p.skills=[{id:'combo',lv:3,exp:0}];
 const b=createBattle({party:[{...P.battleUnit(p),uid:'p',mp:999,maxMp:999,hp:99999,maxHp:99999}],enemies:[['wolf',30]],seed:4});b.mods=R.MODS;
 const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'combo',target:'e0'},{actor:'p',kind:'skill',skill:'combo',target:'e0'}]);
 const acts=ev.filter(e=>e.t==='act'&&e.a==='p');assert.equal(acts.filter(e=>e.kind==='skill').length,1);assert.equal(acts.length,2);
});
test('一鍵換最好的：每格挑等級高、數值高的，武器只換同一類', ()=>{
 const p=hero('sword');p.equip.weapon='swordN';for(const id of ['helmN','helmL','axeN'])P.addItem(p,id);
 const r=R.equipBest(p);assert.ok(r.ok);assert.equal(p.equip.head,'helmL');assert.equal(p.equip.weapon,'swordN');assert.ok(!R.equipBest(p).ok);
});
test('50 級起可以帶第二位夥伴，三個人一起出門', ()=>{
 const p=hero('sword');assert.ok(R.addMate(p,{name:'甲',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:5}).ok);
 assert.ok(R.addMate(p,{name:'乙',look:'zhangfei',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:6}).ok);assert.equal(p.roster.length,1,'沒到 50 級先住酒館');
 p.lv=50;assert.ok(R.trioOpen(p));assert.ok(R.takeFromRoster(p,0).ok);assert.equal(p.mate2.name,'乙');
 const b=R.startHunt(p,R.HUNT_SPOTS[0],3);assert.deepEqual(b.units.filter(u=>u.side==='ally').map(u=>u.uid),['p','m','m2']);
 R.swapMate(p,2);assert.equal(p.name,'乙');assert.equal(p.mate2.name,'測試');R.swapMate(p,2);
 assert.ok(R.stashMate(p,1).ok);assert.equal(p.mate.name,'乙','第一位走了第二位補上');assert.equal(p.mate2,null);
});

test('重裝（鎧甲、頭盔）防禦 ×1.35，打造擲完再乘', ()=>{
 assert.equal(ITEMS.cg_mail_7.def,Math.round(70*1.35));assert.equal(ITEMS.cg_boots_1.def>0,true);
 const r=D.rollGear('cg_mail_7',()=>0.99);assert.equal(ITEMS[r].def,Math.round(84*1.35));assert.equal(D.rollQuality(r),1);
 assert.ok(D.ensureItem('cg_mail_7~55'),'舊存檔擲出來的值還認得');
});

test('寶石的必殺、反擊 ×1.5、命中 ×1.35（捨去），不扣能力（Leo 2026-10-27）', ()=>{
 const g=(t,n)=>ITEMS[D.withGem('cg_sword_1',D.gemId(t,n))],base=ITEMS.cg_sword_1;
 assert.equal(g('peridot',1).counter,1);assert.equal(g('peridot',2).counter,3);assert.equal(g('peridot',2).crit,base.crit);assert.ok(!D.GEM_TYPES.peridot.wt.includes('－'));
 assert.equal(g('knight',3).hit,Math.floor(3*1.35));
});

test('護衛撐三回合，護的人倒下就斷', ()=>{
 const p=hero('guard');p.skills=[{id:'cover',lv:1,exp:0}];
 assert.ok(R.addMate(p,{name:'關羽',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{water:10},seed:9}).ok);
 const b=R.startHunt(p,'suburb',5),[u,m]=R.allies(b);u.mp=999;u.hp=u.maxHp=m.hp=m.maxHp=99999;
 R.resolveRound(b,[{actor:'p',kind:'skill',skill:'cover',target:m.uid},{actor:m.uid,kind:'defend'}]);assert.equal(u.coverLeft,2);assert.equal(m.coveredBy,'p');
 R.resolveRound(b,[{actor:'p',kind:'defend'},{actor:m.uid,kind:'defend'}]);assert.equal(u.coverLeft,1);assert.equal(m.coveredBy,'p');
 R.resolveRound(b,[{actor:'p',kind:'defend'},{actor:m.uid,kind:'defend'}]);assert.equal(m.coveredBy,null);
 assert.match(R.skillDesc('cover',1),/撐 3 回合/);
 assert.match(R.skillDesc('wall',1),/物理和魔法/);
});

test('讓錢有用：工錢照等級、重置點數變貴；材料不能跟商店買賣；20 級起經驗加倍數', ()=>{
 assert.equal(D.RECIPES.cg_sword_1.fee,150);assert.equal(D.RECIPES.dragonSword.fee,60000);assert.equal(R.resetBpCost({lv:50}),50000);
 const p=hero('sword');P.addItem(p,'copper');assert.ok(!R.sell(p,'copper').ok);
 assert.equal(R.expMult(10),1);assert.equal(R.expMult(20),1.3);assert.equal(R.expMult(50),2);assert.equal(R.expMult(80),2.5);assert.ok(Math.abs(R.expMult(35)-1.7)<1e-9);
});

test('抗魔：鎧甲頭盔靴子盾有、魔法減傷照表；槍有反擊命中、斧有必殺', ()=>{
 const mail=Object.entries(ITEMS).find(([,it])=>it.name==='鋼鐵鎧甲')[0];assert.equal(ITEMS[mail].mres,45,'抗魔 28 ×1.6');assert.deepEqual(ITEMS[mail].rng.mres,[24,32]);
 assert.ok(D.ensureItem(mail+'~84'),'舊存檔只擲了防禦，抗魔取中間');assert.equal(ITEMS[mail+'~84'].mres,45);
 const spear=Object.values(ITEMS).find(it=>it.name==='短矛');assert.equal(spear.counter,6);assert.equal(spear.hit,3);
 assert.equal(Object.values(ITEMS).find(it=>it.name==='手斧').crit,18);
 const r={next:()=>.5};assert.equal(B.mresCut(280,10,r),26,'280 抗魔、10 級魔法：中間那格 26%');assert.equal(B.mresCut(5,10,r),9);assert.equal(B.mresPct(R.MODS,280,10,r),31,'文字版抗魔效果 ×1.2');assert.equal(B.mresPct({mres:true},280,10,r),26);
});

test('抗異常、減少耗魔照表；聖盾沒有反擊、效果強三成、等級越高越久', ()=>{
 const by=n=>Object.values(ITEMS).find(it=>it.name===n);
 assert.equal(by('神官帽').rpoison,20);assert.equal(by('死神之袍').rforget,4);assert.deepEqual(by('處刑斧').mpPct,{allin:-20});assert.equal(ITEMS.dragonMail.rpoison,65);
 const {mpCost,SKILLS}=S;assert.equal(mpCost({mpPct:{allin:-20}},'allin',10),Math.round(SKILLS.allin.mp(10)*.8));
 const p=hero('guard');p.skills=[{id:'wall',lv:8,exp:0}];const b=R.startHunt(p,'suburb',5),u=R.allies(b)[0];u.mp=999;u.hp=u.maxHp=99999;
 R.resolveRound(b,[{actor:'p',kind:'skill',skill:'wall',target:'p'}]);assert.equal(u.wallCounter,0);assert.equal(u.wallLeft,3);assert.ok(Math.abs(u.wall-SKILLS.wall.rate(8)*.85)<1e-9);
});

test('隊伍人數：20 級 3 人、30 級 4 人、50 級 5 人；借將要隊伍沒滿', ()=>{
 const p=R.newHero({name:'甲',look:'zhaoyun',bp:{vit:10,str:15,tgh:0,qui:5,mgc:0},elem:{fire:10},seed:1}).player;p.roster=[];
 assert.equal(R.mateSlots(p),1);
 for(const [n,lv] of [['乙',1],['丙',1],['丁',1],['戊',1]])assert.ok(R.addMate(p,{name:n,look:['guanyu','zhangfei','machao','huangzhong'][p.roster.length+R.mateIds(p).length-1],bp:{vit:10,str:15,tgh:0,qui:5,mgc:0},elem:{fire:10},seed:2}).ok);
 assert.equal(R.mateIds(p).length,1);assert.equal(p.roster.length,3);
 p.lv=20;assert.equal(R.mateSlots(p),2);assert.ok(R.takeFromRoster(p,0).ok);assert.equal(R.mateIds(p).length,2);
 p.lv=30;assert.ok(R.takeFromRoster(p,0).ok);assert.equal(p.mate3.name,'丁');
 p.lv=50;assert.ok(R.takeFromRoster(p,0).ok);assert.equal(R.mateIds(p).join(''),'1234');assert.equal(R.partyUnits(p).length,5);
 assert.ok(R.stashMate(p,2).ok);assert.equal(p.mate2.name,'丁');assert.equal(p.mate4,null); // 後面的往前補
 assert.equal(R.groupMax(50,4),7);
});
test('敵對冒險隊：有職業、技能、裝備，打得完、有經驗和錢', ()=>{

 const fs=D.rivalParty([25,26,24],makeRng(5));assert.equal(fs.length,3);assert.ok(fs.every(f=>f.skills.length&&Object.values(f.equip).some(Boolean)&&typeof f.look==='string'&&f.team));
 assert.ok(fs.some(f=>f.job==='priest'||f.job==='mage'||f.job==='wizard'||f.job==='bow'));
 const p=R.buildFighter(26,'sword','zhaoyun','我',{fire:10},1);p.hp=P.stats(p).maxHp;p.mp=P.stats(p).maxMp;p.flags={};p.mats={};
 let seen=0;for(let i=0;i<60;i++){const b=D.startHunt(p,'forest',i*31+7);if(!R.foes(b).some(u=>u.rival))continue;seen++;
  b.units[0].ai=true;for(let r=0;r<40&&!b.over;r++)R.resolveRound(b,[]);assert.ok(b.over);
  if(b.over==='win'){const g=p.gold,e=p.exp;const out=D.finishFight(p,b);assert.ok(p.gold>g);assert.ok(p.exp>e);assert.ok(out.lines.some(t=>t.includes('金')));}p.hp=P.stats(p).maxHp;p.mp=P.stats(p).maxMp;}
 assert.ok(seen>0);
});

test('飾品：獨立一格、不分職業照職階上限、工房做得出來、不能鑲寶石；鼠王寶石不從地下城王掉', ()=>{
 const p=hero('sword');p.lv=30;p.rank=1;p.mats={};p.gold=99999;
 assert.ok(ITEMS.cg_acc_7.slot==='acc'&&ITEMS.cg_acc_7.hp>=110);
 for(const [m,n] of D.RECIPES.cg_acc_7.mats)D.addMat(p,m,n);
 const r=D.forge(p,'cg_acc_7',null);assert.ok(r.ok,r.msg);const got=p.bag.find(x=>String(x.id).startsWith('cg_acc_7'));assert.ok(got);
 const hp0=P.stats(p).maxHp;assert.ok(P.equip(p,got.id).ok);assert.ok(P.stats(p).maxHp-hp0>=110);assert.equal(p.equip.acc,got.id);
 assert.ok(!P.canEquip(p,'cg_acc_14').ok); // 9 級要王宮以上
 D.addMat(p,'gem_pearl_1');assert.ok(!D.canForge(p,'cg_acc_1',null).ok||!D.forge(p,'cg_acc_1','gem_pearl_1').ok);
 assert.equal(ITEMS.cg_acc_10.maxDur,3);
 let mouse=0;for(let i=0;i<400;i++)for(const id of D.bossLoot(D.DUNGEONS[20],makeRng(i)))if(id.startsWith('gem_mouse'))mouse++;assert.equal(mouse,0);
 assert.equal(ITEMS.gem_mouse_1.name,'鼠王寶石的碎片');
});
test('水晶碎片換屬性：5 片換一次、要合法組合、同屬性不換', () => {
 const p=R.buildFighter(10,'spear','zhaoyun','我',{fire:10},1);p.mats={};
 assert.equal(R.changeElem(p,{water:10}).ok,false);
 p.mats[R.SHARD]=5;
 assert.equal(R.changeElem(p,{fire:10}).ok,false);
 assert.equal(R.changeElem(p,{earth:5,fire:5}).ok,false);
 assert.equal(R.changeElem(p,{water:5,fire:5}).ok,true);
 assert.deepEqual(p.elem,{water:5,fire:5});assert.equal(p.mats[R.SHARD],0);
 assert.ok(R.ELEM_HELP.length>=3);
});
test('擂台每場獎金與連勝碎片', () => {
 const p=R.buildFighter(20,'spear','zhaoyun','我',{fire:10},3);p.mats={};p.gold=0;E.roll(p);
 for(let i=0;i<3;i++)E.seasonBout(p,'win',false);
 assert.equal(p.gold,20*30*3);assert.equal(p.season.streak,3);assert.equal(p.mats[R.SHARD],1);
 E.seasonBout(p,'lose',false);assert.equal(p.season.streak,0);
});
test('收服冒險者：只能抓敵對冒險者、抓到進收服欄、出戰後主人一回合一動、學技能', () => {
 const p=R.buildFighter(16,'spear','zhaoyun','我',{fire:10},5);p.mats={};p.pets=[];p.petOut=null;p.petSeq=0;p.flags={};p.settings={};p.gold=5000;
 let caught=null,sawMon=false;
 for(let seed=1;seed<400&&!caught;seed++){
  const b=D.startHunt(p,'camp',seed);assert.equal(b.captureRoom,R.PET_MAX);
  const t=B.foes(b).find(e=>e.alive);
  if(!t.rival){const ev=R.resolveRound(b,[{actor:'p',kind:'capture',target:t.uid}]);const c=ev.find(e=>e.t==='capture');if(c)assert.equal(c.ok,false,'魔物抓不到');sawMon=true;continue;}
  for(let r=0;r<30&&!b.over;r++){const t=B.foes(b).find(e=>e.alive&&e.rival)||B.foes(b).find(e=>e.alive);if(!t)break;
   const cmds=t.rival&&R.captureRate(B.allies(b)[0],t)>=R.CATCH_AT?[{actor:'p',kind:'capture',target:t.uid},{actor:'p',kind:'defend'}]:[{actor:'p',kind:'attack',target:t.uid},{actor:'p',kind:'defend'}];R.resolveRound(b,cmds);}
  if(b.captured?.length){const out=R.finishHunt(p,b);assert.ok(out.lines.some(l=>l.includes('收服了')));caught=b.captured[0];}
  p.hp=P.stats(p).maxHp;
 }
 assert.ok(sawMon);assert.ok(caught,'應該抓得到冒險者');assert.equal(p.pets.length,1);const x=p.pets[0];assert.ok(!x.job&&!x.mon&&x.grade.length===5&&p.petOut===x.uid);assert.ok(R.genGrade(x.look).reduce((a,b)=>a+b,0)>=110);
 const units=R.partyUnits(p),pet=units.find(u=>u.kind==='pet');assert.ok(pet);assert.equal(pet.uid,'pet');assert.equal(pet.art,x.look);assert.equal(R.humans(p).length,1);
 const b=R.startHunt(p,'suburb',7);assert.equal(B.actionsOf(b,B.allies(b)[0]),1);
 const lv0=x.lv,exp0=x.exp;for(let r=0;r<30&&!b.over;r++)R.resolveRound(b,[{actor:'p',kind:'attack',target:null}]);
 if(b.over==='win'){R.finishHunt(p,b);assert.ok(x.exp>exp0||x.lv>lv0);}
 assert.equal(R.renamePet(p,x.uid,'小花').ok,true);assert.equal(x.name,'小花');
 {const id=R.petLearnable(x)[0];p.gold=1e5;assert.equal(R.petLearn(p,x.uid,id).ok,true);assert.equal(R.petSkills(x).length,1);const nt=R.petNextTier(x,id);assert.equal(R.petLearn(p,x.uid,id).ok,x.lv>=nt.need,'升段要看等級');assert.equal(R.petForget(p,x.uid,id).ok,true);}
 assert.ok(R.gradeMax(x).every((g,i)=>x.grade[i]<=g));
 p.mate=R.buildFighter(16,'bow','guanyu','關羽',{water:10},9);p.mate.petOut=null;
 // 收服的全隊共用（Leo 2026-10-28）：換成夥伴看到的是同一池；同一位只能跟一個人
 assert.equal(R.withMate(p,()=>(p.pets||[]).length,1),1);assert.equal(R.partyUnits(p).filter(u=>u.kind==='pet').length,1);
 assert.equal(R.withMate(p,()=>R.setPetOut(p,x.uid).ok,1),true);assert.equal(p.petOut,null);assert.equal(p.mate.petOut,x.uid);assert.equal(R.petCarrier(p,x.uid).k,'m');
 assert.equal(R.partyUnits(p).filter(u=>u.kind==='pet').length,1);assert.equal(R.releasePet(p,x.uid).ok,true);assert.equal(p.mate.petOut,null);assert.equal(p.pets.length,0);assert.equal(R.PET_MAX,10);
});
test('一群幾隻固定照滿組：人少也一樣；王不隨人數變', () => {
 const p=R.buildFighter(10,'spear','zhaoyun','我',{fire:10},1);
 assert.equal(R.fullParty(p),2);assert.equal(R.groupMax(10,R.fullExtra(p)),R.GROUP_MAX[2]);
 p.lv=25;assert.equal(R.fullParty(p),3);assert.equal(R.groupMax(25,R.fullExtra(p)),R.GROUP_MAX[4]);
 p.lv=50;assert.equal(R.fullParty(p),5);assert.equal(R.groupMax(50,R.fullExtra(p)),R.GROUP_MAX[7]);
 assert.equal(R.bossPartyMult([{kind:'player'}]),1);
 // 捕捉在回合一開始就判定：比任何人都快
 const b=R.startHunt(p,'suburb',3);const ev=R.resolveRound(b,[{actor:'p',kind:'capture',target:B.foes(b)[0].uid}]);
 const i=ev.findIndex(e=>e.t==='capture'),j=ev.findIndex(e=>e.t==='act'||e.t==='hit');assert.ok(i>=0&&(j<0||i<j));
});

test('自動喝藥照設定：門檻、關掉就不喝，魔力不夠放招也喝', async()=>{
 const {autoPotion,autoCommand}=await import('../www/src/core/ai.mjs');
 const items={potion:{kind:'use',battle:true,hp:100,price:100},potion2:{kind:'use',battle:true,hp:300,price:300},mpot:{kind:'use',battle:true,mp:100,price:300}};
 const have=()=>1,u={uid:'p',kind:'player',hp:40,maxHp:100,mp:50,maxMp:100,skills:[{id:'heal',lv:5}]},b={units:[u]};
 assert.equal(autoPotion(b,u,null,have,items,{hp:30,mp:15}),null);
 assert.deepEqual(autoPotion(b,u,null,have,items,{hp:50,mp:15}),{kind:'item',item:'potion',target:'p'});
 assert.equal(autoPotion(b,u,null,have,items,{hp:0,mp:0}),null);
 assert.deepEqual(autoPotion(b,{...u,mp:5},null,have,items,{hp:0,mp:15}),{kind:'item',item:'mpot',target:'p'});
 assert.equal(autoPotion(b,{...u,mp:5},null,have,items,{hp:0,mp:0}),null);
 const big={...u,mp:30,skills:[{id:'fire3',lv:10}]};
 assert.deepEqual(autoPotion(b,big,'fire3',have,items,{hp:0,mp:15}),{kind:'item',item:'mpot',target:'p'});
 assert.equal(autoCommand(b,{kind:'attack',target:null},{...u,hp:10},have,items,true,{hp:0,mp:0}).kind,'attack');
 assert.equal(autoCommand(b,{kind:'attack',target:null},{...u,hp:10},have,items,true).kind,'item');
});

test('魔力藥戰鬥中不能喝：道具表 battle=false，自動喝藥在戰鬥中找不到魔力藥', async()=>{
 const {autoPotion}=await import('../www/src/core/ai.mjs');
 assert.equal(ITEMS.mpot.battle,false);assert.equal(ITEMS.mpot2.battle,false);assert.equal(ITEMS.potion.battle,true);
 const u={uid:'p',kind:'player',hp:100,maxHp:100,mp:1,maxMp:100,skills:[]};
 assert.equal(autoPotion({units:[u]},u,null,()=>1,ITEMS,{hp:30,mp:15}),null);
});

test('王戰：通關過才開，照王的打法配陣型（d6 龜陣：軍醫同級、近衛 ×0.7 會護衛王）；七種陣型的技能都學得起來；打贏獎勵兩份', ()=>{
 for(const [k,set] of Object.entries(D.RAID_SETS))for(const [job,name,kit] of set.guards){const f=R.buildFighter(40,job,'guanyu',name,{fire:10},1,kit,2);assert.deepEqual(f.skills.map(s=>s.id),kit,`${k} ${name}`);}
 const p=R.buildFighter(22,'spear','zhaoyun','我',{fire:10},1);const s=P.stats(p);p.hp=s.maxHp;p.mp=s.maxMp;p.flags={};
 const d=D.DUNGEON_BY_ID.d6;assert.equal(D.raidOpen(p,d),false);p.flags.dg={d6:1};assert.equal(D.raidOpen(p,d),true);
 const b=D.startRaid(p,'d6',5),foes=b.units.filter(u=>u.side==='enemy');
 assert.equal(foes.length,1+D.raidGuardN(p));assert.equal(D.raidGuardN(p),3);assert.ok(foes[0].boss);assert.equal(D.raidSet(d).name,'龜陣');assert.equal(foes.filter(u=>u.guardOf==='e0').length,foes.filter(u=>u.name.endsWith('近衛')).length);
 assert.equal(b.raidLv,D.raidLv(d,22));assert.equal(b.raidLv,Math.max(d.lv,22-D.RAID_LAG));assert.equal(foes[0].lv,b.raidLv,'王跟著隊伍等級');
 assert.equal(foes.find(u=>u.name.endsWith('軍醫')).lv,b.raidLv);assert.equal(foes.find(u=>u.name.endsWith('近衛')).lv,Math.round(b.raidLv*D.RAID_K));
 assert.ok(foes.every(u=>!u.rival));assert.equal(b.canEscape,true);
 const ev=R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.ok(ev.some(e=>e.t==='act'&&e.kind==='skill'&&e.name==='護衛'));
 for(const u of foes)if(!u.boss){u.alive=false;u.hp=0;} foes[0].hp=0;foes[0].alive=false;b.over='win';
 const out=D.finishFight(p,b);assert.equal(D.raidWins(p,d),1);assert.ok(out.lines.some(t=>t.includes('王戰勝利')));assert.ok(out.lines.some(t=>t.includes('撿到材料')));
});

test('陣型：每人一格、撞格往後挪；放到有人的格子就對調；partyUnits 帶 row／pos；最前面那格最常被打', ()=>{
 const mk=(lv,job,g,seed)=>{const m=R.buildFighter(lv,job,g,job,{fire:10},seed);const s=P.stats(m);m.hp=s.maxHp;m.mp=s.maxMp;const o={};for(const k of R.CHAR_KEYS)o[k]=m[k];return o;};
 const p=R.buildFighter(22,'spear','zhaoyun','我',{fire:10},1);const s=P.stats(p);p.hp=s.maxHp;p.mp=s.maxMp;p.flags={};
 p.mate=mk(22,'guard','guanyu',2);p.mate2=mk(22,'bow','jiangwei',3);p.mate2.row='back';
 let f=R.formation(p);assert.equal(f.length,3);assert.deepEqual(f.map(m=>[m.k,m.row,m.pos]),[['p','front',0],['m','front',1],['m2','back',0]]);
 assert.ok(R.placeMember(p,'m','front',0).ok);f=R.formation(p);assert.deepEqual(f.find(m=>m.k==='m').pos,0);assert.deepEqual(f.find(m=>m.k==='p').pos,1);
 assert.ok(R.placeMember(p,'m2','back',4).ok);f=R.formation(p);assert.equal(f.find(m=>m.k==='m2').pos,4);
 const units=R.partyUnits(p);assert.equal(units.find(u=>u.uid==='m').pos,0);assert.equal(units.find(u=>u.uid==='m2').row,'back');assert.equal(units.find(u=>u.uid==='m2').pos,4);
 // 最前面那格被打的機率約 3/(3+2)
 const b=B.createBattle({party:units,enemies:[['bat',5],['bat',5]],seed:9,canEscape:true});R.mudBattle(b);let n0=0,N=0;
 for(let r=0;r<80;r++){for(const u of b.units)if(u.side==='ally'){u.hp=u.maxHp;u.alive=true;}for(const e of b.units)if(e.side==='enemy'){e.hp=e.maxHp;e.alive=true;}
  b.over=null;for(const e of R.resolveRound(b,[{actor:'p',kind:'defend'},{actor:'m',kind:'defend'},{actor:'m2',kind:'defend'}]))if((e.t==='hit'||e.t==='miss')&&e.a?.startsWith('e')){N++;if(e.d==='m')n0++;}}
 assert.ok(n0/N>.45&&n0/N<.75,`${n0}/${N}`);
});

// 存檔碼：匯出再匯入要是同一個角色，壞掉的字串讀不出來
test('存檔碼匯出匯入', async()=>{
 const O=await import('../www/src/mud/online.mjs');
 const p=hero('fighter');p.name='測試者';p.lv=12;p.gold=777;
 const code=O.exportCode(p);assert.ok(code.startsWith('MUD1.'));
 const q=O.importCode(code);assert.equal(q.name,'測試者');assert.equal(q.lv,12);assert.equal(q.gold,777);
 assert.equal(O.importCode('MUD1.zzz'),null);assert.equal(O.importCode('hello'),null);assert.equal(O.importCode(''),null);
});

test('文字版騎士之譽：防禦加成 ×1.4、弓的攻擊也擋',()=>{
 const mk=(job,skills)=>{const p=P.createPlayer({name:'測',look:'guanshanyue',bp:{vit:10,str:12,tgh:4,qui:4},elem:{earth:10},seed:7}).player;p.job=job;p.skills=skills;return p;};
 let covered=0;
 for(let seed=1;seed<30;seed++){const k={...P.battleUnit(mk('spear',[{id:'honor',lv:5,exp:0}])),uid:'p',mp:999,maxMp:999,hp:9999,maxHp:9999},w={...P.battleUnit(mk('bow',[])),uid:'q',hp:50,maxHp:9999,slot:1,row:'back'};
  const b=R.mudBattle(B.createBattle({party:[k,w],enemies:[['wolf',12],['wolf',12]],seed}));
  for(const e of b.units)if(e.side==='enemy'){e.ranged=true;e.weaponType='bow';}
  const ev=B.resolveRound(b,[{actor:'p',kind:'skill',skill:'honor'},{actor:'q',kind:'defend'}]);
  covered+=ev.filter(e=>e.t==='cover'&&e.a==='p').length;assert.ok(!ev.some(e=>e.t==='hit'&&e.d==='q'&&!e.counter));}
 assert.ok(covered>0);
 const b=R.mudBattle(B.createBattle({party:[{...P.battleUnit(mk('spear',[{id:'honor',lv:5,exp:0}])),uid:'p',mp:999,maxMp:999}],enemies:[['wolf',5]],seed:3}));
 B.resolveRound(b,[{actor:'p',kind:'skill',skill:'honor'}]);
 assert.ok(R.skillDesc('honor',10).includes('240%'));
});

test('收服者品種照原作名寵：刀＝螳螂型、劍＝神盾型，合計 120；舊存檔遷移保留偏差；攻防有補正',()=>{
 const sum=a=>a.reduce((x,y)=>x+y,0);
 for(const id of ['zhoucang','mizhu','dianwei','liaohua','huangzhong']){const g=R.genGrade(id);assert.equal(sum(g),120);const a=R.archOf(id);assert.ok(g.every((v,i)=>Math.abs(v-a.grade[i])<=2));}
 assert.equal(R.archOf('zhoucang').name,'螳螂型');assert.equal(R.archOf('zhoucang').grade[1],44);assert.equal(R.archOf('mizhu').name,'神盾型');assert.equal(R.archOf('mizhu').grade[2],50);
 const old={look:'zhoucang',lv:5,grade:[34,36,22,18,12],learned:[]}; // 舊底子 32/34/24/18/12 加名字偏向：假設體 +2、力 +2、強 −2
 assert.ok(R.regrade(old));assert.equal(old.gv,2);assert.equal(sum(old.grade)>=112&&sum(old.grade)<=128,true);assert.ok(!R.regrade(old));
 const x={uid:'x',look:'zhoucang',name:'周倉',lv:30,grade:R.genGrade('zhoucang'),learned:[],elem:{earth:10},hp:9999,mp:999};const s=R.petStats(x),u=R.petUnitOf(x);
 assert.equal(u.atk,Math.floor(s.atk*R.PET_GEAR));assert.equal(u.def,Math.floor(s.def*R.PET_GEAR));
});

test('法系補魔封頂：(等級−1)×15+137；冒險之星扣最大耐久',()=>{
 const m=R.buildFighter(40,'mage','mizhu','法',{fire:10},3);m.mp=0;const s=P.stats(m);assert.ok(s.maxMp>800);
 assert.equal(P.mpCap(m),39*15+137);assert.equal(P.restCost(m,'mp'),Math.min(s.maxMp,P.mpCap(m)));
 const f=R.buildFighter(40,'fighter','zhoucang','戰',{fire:10},3);f.mp=0;assert.equal(P.restCost(f,'mp'),P.stats(f).maxMp);
 m.gold=99999;P.rest(m,'mp');assert.equal(m.mp,s.maxMp);
 const base=Object.keys(ITEMS).find(id=>ITEMS[id].slot==='weapon'&&ITEMS[id].lv===3&&!ITEMS[id].cheap);const id=D.withGem(base,'gem_star_5');
 assert.equal(E.maxDur(id),Math.round((100+20*3)*(1-D.STAR_DUR(5)/100)));assert.ok(D.gemEffect('gem_star_5','weapon').includes('耐久'));
 const b2=D.withGem(base,'gem_blue_5');assert.equal(E.maxDur(b2),100+20*3);
});

test('高級裝備修理費 −60%：5 級以上、水龍',()=>{
 const pick=lv=>Object.keys(ITEMS).find(id=>ITEMS[id].slot==='weapon'&&ITEMS[id].lv===lv&&!ITEMS[id].cheap&&!ITEMS[id].dragon);
 for(const [lv,m] of [[4,E.REPAIR_LOW],[5,.28],[9,.28]]){const id=pick(lv),c={equip:{weapon:id},dur:{weapon:0}};assert.equal(E.repairFee(c,'weapon'),Math.ceil(D.forgeFee(ITEMS[id])*E.REPAIR_RATE*m),`lv${lv}`);}
 const dr=Object.keys(ITEMS).find(id=>ITEMS[id].dragon&&ITEMS[id].slot==='weapon');assert.ok(E.highGear(dr));assert.equal(E.repairFee({equip:{weapon:dr},dur:{weapon:0}},'weapon'),Math.ceil(60000*E.REPAIR_RATE*.28));
});

test('寶石效果浮動 80%～120%：打造時擲、記在代號、說明跟著變',()=>{
 const p=hero('sword');p.mats={copper:12,pine:2,gem_blue_5:2};p.gold=5000;
 const lo=D.forge(p,'cg_sword_1','gem_blue_5',()=>0);assert.ok(lo.ok);assert.ok(lo.out.endsWith('#80'));const b=lo.out.split('@')[0];
 assert.equal(ITEMS[lo.out].atk,ITEMS[b].atk+Math.round(Math.round(ITEMS[b].atk*11/100)*.8));assert.ok(ITEMS[lo.out].name.includes('80%'));
 const hi=D.forge(p,'cg_sword_1','gem_blue_5',()=>.999);assert.ok(hi.out.endsWith('#120'));
 assert.ok(D.gemEffect('gem_blue_5#120','weapon').includes('+13%'));assert.ok(!D.ensureItem('cg_sword_1@gem_blue_5#150'));
});

test('練功點、地下城不限等級（Leo 2026-10-28），只提示建議等級', ()=>{
 const p=hero('sword');p.lv=1;
 for(const id of R.HUNT_SPOTS)assert.equal(R.spotOpen(p,id).ok,true,id);
 for(const d of D.DUNGEONS)assert.equal(D.dungeonOpen(p,d).ok,true,d.id);
 assert.ok(D.enterDungeon(p,D.DUNGEONS.at(-1).id).ok);
});

test('鑲寶石改成打造好之後另外鑲（Leo 2026-10-28）：一件一顆、磨損照比例帶過去、飾品不行', ()=>{
 const p=hero('sword');p.gold=99999;const wid=Object.keys(D.RECIPES).find(id=>ITEMS[id].slot==='weapon'&&ITEMS[id].lv===1);
 for(const [m,n] of D.RECIPES[wid].mats)D.addMat(p,m,n);
 const r=D.forge(p,wid,null,()=>.5);assert.ok(r.ok);const made=r.out;assert.ok(!made.includes('@'));
 assert.deepEqual(D.socketable(p),[made]);
 D.addMat(p,'gem_blue_3',2);
 const e=p.bag.find(x=>x.id===made);e.dur=Math.round(E.maxDur(made)/2);
 const s1=D.socketGem(p,made,'gem_blue_3',()=>.999);assert.ok(s1.ok,s1.msg);assert.equal(s1.pct,120);assert.ok(s1.out.endsWith('@gem_blue_3#120'));
 assert.equal(P.countItem(p,made),0);assert.equal(P.countItem(p,s1.out),1);assert.equal(D.matCount(p,'gem_blue_3'),1);
 assert.equal(p.bag.find(x=>x.id===s1.out).dur,Math.round(E.maxDur(s1.out)/2));
 assert.equal(D.canSocket(p,s1.out,'gem_blue_3').ok,false,'鑲過的不能再鑲');
 assert.equal(D.socketable(p).length,0);
 const acc=Object.keys(D.RECIPES).find(id=>ITEMS[id].slot==='acc');P.addItem(p,acc,1);assert.equal(D.canSocket(p,acc,'gem_blue_3').ok,false);
});

test('耐久磨損每 5 場有 1 場不磨（慢 20%）',()=>{
 const c={equip:{weapon:'swordN'},dur:{weapon:100},lv:1};
 for(let i=0;i<10;i++)E.wear(c);
 assert.equal(c.dur.weapon,92);assert.equal(c.wearN,10);assert.ok(R.CHAR_KEYS.includes('wearN'));
});

test('換新角色帶頭：舊的寄放酒館、錢道具夥伴留著、新的 1 級；酒館滿了或同一位武將不行', ()=>{
 const p=R.newHero({name:'老大',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:1}).player;R.joinJob(p,'sword');p.lv=30;p.gold=777;p.bag.push({id:'potion',n:2});
 assert.equal(R.addMate(p,{name:'副手',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:2}).ok,true);
 assert.equal(R.newLeader(p,{name:'撞臉',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:3}).ok,false);
 const r=R.newLeader(p,{name:'新人',look:'zhangfei',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:3});assert.equal(r.ok,true,r.msg);
 assert.equal(p.name,'新人');assert.equal(p.lv,1);assert.equal(p.job,'none');assert.equal(p.gold,777);assert.ok(p.bag.some(x=>x.id==='potion'));assert.equal(p.mate.name,'副手');
 assert.equal(p.roster.length,1);assert.equal(p.roster[0].name,'老大');assert.equal(p.roster[0].lv,30);assert.equal(p.roster[0].job,'sword');
 assert.equal(R.takeFromRoster(p,0,1).ok,true);assert.equal(p.mate.name,'老大');assert.equal(R.swapMate(p,1).ok,true);assert.equal(p.name,'老大');assert.equal(p.lv,30);
 p.roster=Array.from({length:R.ROSTER_MAX},(_,i)=>({name:'x'+i,look:'g'+i}));assert.equal(R.newLeader(p,{name:'滿',look:'machao',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:4}).ok,false);
});
test('隊伍人數看所有角色的最高等級：高等的寄放酒館後，格子不會少、叫得回來', ()=>{
 const p=R.newHero({name:'頭',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:1}).player;R.joinJob(p,'sword');p.lv=5;
 for(const [n,l,lv] of [['甲','guanyu',20],['乙','zhangfei',6]]){p.lv=20;assert.equal(R.addMate(p,{name:n,look:l,bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:2}).ok,true);p.lv=5;}
 p.mate.lv=20;p.mate2.lv=6;assert.equal(R.mateSlots(p),2);
 assert.equal(R.stashMate(p,1).ok,true);assert.equal(R.mateSlots(p),2,'20 級的住酒館還是三人隊');assert.equal(R.mateIds(p).length,1);
 assert.equal(R.takeFromRoster(p,0).ok,true);assert.equal(R.mateIds(p).length,2);assert.ok([p.mate,p.mate2].some(m=>m.name==='甲'));
});
test('隊伍不分帶頭：操作中的人也能休息（操作換給另一位）、至少一人出戰；收服歸抓的人', ()=>{
 const p=R.newHero({name:'甲',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:1}).player;R.joinJob(p,'sword');p.lv=20;
 assert.equal(R.restChar(p,0).ok,false,'一個人不能休息');
 assert.equal(R.addMate(p,{name:'乙',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:2}).ok,true);
 assert.deepEqual(R.allChars(p).map(x=>[x.k,x.out]),[['p',true],['m',true]]);
 const r=R.restChar(p,0);assert.equal(r.ok,true,r.msg);assert.equal(p.name,'乙');assert.equal(p.roster[0].name,'甲');assert.equal(R.mateIds(p).length,0);
 assert.deepEqual(R.allChars(p).map(x=>[x.k,x.out]),[['p',true],['r0',false]]);
 assert.equal(R.takeFromRoster(p,0).ok,true);assert.equal(p.mate.name,'甲');
 // 夥伴抓到的歸夥伴
 const b=R.startHunt(p,'suburb',3);b.over='win';b.captured=[{job:'sword',look:'machao',elem:{fire:10},name:'馬超',lv:3,by:'m'}];
 const out=R.finishHunt(p,b);assert.equal(p.pets.length,1,'收服的進全隊共用的池');assert.equal(p.mate.petOut,p.pets[0].uid,'抓到的先跟著抓的人');assert.equal(p.petOut,null);assert.ok(!p.mate.pets);
});
test('收服的改成全隊共用：舊存檔每人各自的 pets 併進一池、uid 撞到重編、同一位只跟一個人', async ()=>{
 const {fixHero}=await import('../www/src/mud/online.mjs');
 const p=hero('sword');p.mud=1;p.lv=20;const rng=makeRng(4);
 const mk=(uid,look)=>({uid,look,name:look,lv:5,exp:0,grade:[20,20,20,20,20],gv:2,elem:{},learned:[],hp:10,mp:5});
 p.pets=[mk('pet1','guanyu'),mk('pet2','zhangfei')];p.petOut='pet1';p.petSeq=2;
 p.mate=R.buildFighter(16,'bow','machao','馬超',{water:10},9);p.mate.pets=[mk('pet1','huangzhong')];p.mate.petOut='pet1';p.mate.petSeq=1;
 p.roster=[R.buildFighter(10,'spear','zhoucang','周倉',{fire:10},5)];p.roster[0].pets=[mk('pet3','liaohua')];p.roster[0].petOut='pet3';
 const q=fixHero(p);assert.ok(q);
 assert.equal(p.pets.length,4);assert.ok(!p.mate.pets&&!p.roster[0].pets);
 const uids=p.pets.map(x=>x.uid);assert.equal(new Set(uids).size,4);
 assert.equal(p.petOut,'pet1');assert.ok(p.mate.petOut&&p.mate.petOut!=='pet1'&&uids.includes(p.mate.petOut));assert.equal(p.pets.find(x=>x.uid===p.mate.petOut).look,'huangzhong');
 assert.ok(uids.includes(p.roster[0].petOut));assert.equal(p.pets.find(x=>x.uid===p.roster[0].petOut).look,'liaohua');assert.ok(p.petSeq>=4);
 // 多到超過 10 位：先留出戰中的
 const r=hero('sword');r.mud=1;r.pets=Array.from({length:9},(_,i)=>mk('pet'+(i+1),'guanyu'));r.petOut='pet9';
 r.mate=R.buildFighter(16,'bow','machao','馬超',{water:10},9);r.mate.pets=[mk('x1','zhangfei'),mk('x2','zhangfei'),mk('x3','zhangfei')];r.mate.petOut='x3';
 fixHero(r);assert.equal(r.pets.length,R.PET_MAX);assert.ok(r.pets.some(x=>x.uid==='pet9')&&r.pets.some(x=>x.uid==='x3'));
 // 抓到後 addAdv 進同一池，petSeq 接著編
 const x=R.addAdv(p,{look:'zhangfei',name:'張飛',lv:12,elem:{fire:10}},rng);assert.ok(x);assert.ok(!uids.includes(x.uid));assert.equal(p.pets.length,5);
});

test('每座地下城的王都有被打倒的彩蛋台詞', ()=>{
 for(const d of D.DUNGEONS)assert.ok(D.BOSS_LINES[d.id],d.id);assert.match(D.bossLine(D.DUNGEON_BY_ID.d10),/盟的翅膀/);
});

test('地下城、迷宮王頁的掉落說明每座都有', ()=>{
 for(const d of D.DUNGEONS){const li=D.lootInfo(d);assert.match(li.boss,/寶石 \d+～\d+ 級/);assert.match(li.floor,/魔石/);assert.match(li.raid,/兩份/);}
 assert.match(D.lootInfo(D.DUNGEON_BY_ID.d1).boss,/^王：/);assert.ok(!/鋼騎/.test(D.lootInfo(D.DUNGEON_BY_ID.d1).boss));assert.match(D.lootInfo(D.DUNGEON_BY_ID.d26).boss,/生鏽/);
});

test('收服者技能照蔚藍：分型、分段往上升', ()=>{
 const p=R.newHero({name:'甲',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:1}).player;p.gold=1e6;
 const rng=makeRng(5);const x=R.addAdv(p,{look:'guanyu',name:'關羽',lv:1,elem:{}},rng);assert.equal(R.petArchKey(x),'blade');
 assert.equal(R.petLearn(p,x.uid,'fire1').ok,false,'螳螂型學不了魔法');
 assert.equal(R.petLearn(p,x.uid,'combo').ok,true);assert.equal(x.learned[0].lv,2);assert.equal(p.gold,1e6-200);
 assert.equal(R.petLearn(p,x.uid,'combo').ok,false,'1 級升不了第二段');x.lv=20;assert.equal(R.petLearn(p,x.uid,'combo').ok,true);assert.equal(x.learned[0].lv,4);assert.equal(p.gold,1e6-1200);
 x.lv=80;for(const L of [6,8,10]){assert.equal(R.petLearn(p,x.uid,'combo').ok,true);assert.equal(x.learned[0].lv,L);}assert.equal(R.petNextTier(x,'combo'),null);assert.equal(R.petLearn(p,x.uid,'combo').ok,false,'最高了');
 assert.equal(p.gold,1e6-200-1000-4000-9000-16000);assert.equal(R.petSkills(x).length,1,'升段不佔格');
 for(const id of ['allin','blade','smash'])assert.ok(R.petLearn(p,x.uid,id).ok);assert.equal(R.petLearn(p,x.uid,'counter').ok,false,'4 格滿了');
 assert.ok(R.petForget(p,x.uid,'smash').ok);assert.ok(R.petLearn(p,x.uid,'counter').ok);
 const y=R.addAdv(p,{look:'zhugeliang',name:'諸葛亮',lv:1,elem:{}},rng);
 assert.ok(['sword','spear','bow','halberd','blade'].includes(R.petArchKey(y)));
 const m=R.addAdv(p,{look:'huangzhong',name:'黃忠',lv:30,elem:{}},rng);assert.equal(R.petArchKey(m),'bow');assert.ok(R.petLearnable(m).includes('haze'),'疾風型＝敏捷系有陽炎');
 assert.ok(R.petLearn(p,m.uid,'haze').ok);assert.ok(R.petLearn(p,m.uid,'haze').ok,'30 級可以升到第二段');assert.equal(m.learned[0].lv,4);assert.equal(R.petLearn(p,m.uid,'haze').ok,false,'第三段要 40');
 const z=p.pets.find(q=>R.petArchKey(q)==='sword')||(()=>{const q=R.addAdv(p,{look:'zhaoyun',name:'趙雲',lv:95,elem:{}},rng);return q;})();
 if(R.petArchKey(z)==='sword'){z.lv=95;for(let L=1;L<=10;L++){assert.ok(R.petLearn(p,z.uid,'fire1').ok,'魔法第 '+L+' 段');assert.equal(z.learned.find(q=>q.id==='fire1').lv,L);}assert.equal(R.petLearn(p,z.uid,'fire1').ok,false);}
 for(const [k,ids] of Object.entries(R.PET_ARCH_SKILLS))for(const id of ids)assert.ok(R.PET_SKILL_SHOP[id]&&S.SKILLS[id],k+' '+id);
});

test('收服者品種多坦系、水龍系；10% 閃光（Leo 2026-10-28）', ()=>{
 const keys=new Set(GENERALS.map(g=>R.archKeyOf(g.id)));for(const k of ['blade','halberd','spear','sword','bow','tank','dragon'])assert.ok(keys.has(k),k);
 assert.equal(R.ARCHS.tank.grade.reduce((a,b)=>a+b,0),120);assert.equal(R.ARCHS.dragon.grade.reduce((a,b)=>a+b,0),125);
 const look=GENERALS.find(g=>R.archKeyOf(g.id)==='dragon').id;
 assert.equal(R.petGrade(look,'dragon',false).reduce((a,b)=>a+b,0),125);assert.equal(R.petGrade(look,'dragon',true).reduce((a,b)=>a+b,0),R.SHINY_SUM);
 const p=R.newHero({name:'甲',look:'zhaoyun',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:1}).player;
 let shiny=0,n=0;for(let seed=1;seed<=400;seed++){p.pets=[];const x=R.addAdv(p,{look,name:'x',lv:10,elem:{}},makeRng(seed));n++;if(x.shiny)shiny++;assert.equal(x.arch,'dragon');
  const mx=R.gradeMax(x);assert.equal(mx.reduce((a,b)=>a+b,0),x.shiny?R.SHINY_SUM+10:135);assert.ok(x.grade.every((g,i)=>g<=mx[i]));}
 assert.ok(shiny>20&&shiny<70,'閃光約一成：'+shiny+'/'+n);
 // 舊存檔沒記 arch 的照兵器
 const old={look,lv:5,grade:[1,1,1,1,1],learned:[]};assert.equal(R.petArchKey(old),R.archOf(look)===R.ARCHS.blade?'blade':R.petArchKey(old));assert.ok(R.ARCHS[R.petArchKey(old)]);
 assert.ok(R.petLearnable({look,arch:'tank'}).includes('cover'));assert.ok(R.petLearnable({look,arch:'dragon'}).includes('water1'));
 // 拿走、給
 p.pets=[];const x=R.addAdv(p,{look,name:'x',lv:10,elem:{}},makeRng(3));p.petOut=x.uid;const doc=R.takePet(p,x.uid);assert.equal(p.pets.length,0);assert.equal(p.petOut,null);assert.ok(R.okPetDoc(doc));assert.ok(!('uid' in doc));
 const y=R.givePet(p,doc);assert.ok(y&&y.uid);assert.equal(p.pets.length,1);assert.equal(R.givePet(p,{look:'nope'}),null);
});

test('魔法數值說明照 combat 公式', async()=>{
 const R=await import('../www/src/mud/rules.mjs');const P=await import('../www/src/core/player.mjs');const C=await import('../www/src/core/combat.mjs');
 const p=R.buildFighter(30,'mage','zhaoyun','x',{fire:10},1,['fire1']);const m=R.magicInfo(p,'fire1',3);
 assert.ok(m);assert.equal(m.base,Math.round(C.magicBase('single',3)));assert.equal(m.need,163);assert.equal(m.mneed,70);assert.equal(m.mfull,82);
 const s=P.stats(p);assert.equal(m.spr,s.spr);assert.ok(m.same[0]<=m.same[1]&&m.same[1]<=m.weak[1]);
 assert.equal(R.magicInfo(p,'combo',1),null);
});
