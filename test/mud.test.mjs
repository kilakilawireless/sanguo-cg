// 文字版擂台：一個人出戰、擂台電腦代打、常駐好手
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {ITEMS} from '../www/src/data/items.mjs';
import * as B from '../www/src/core/battle.mjs';
import * as S from '../www/src/data/skills.mjs';

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
 let won=false;
 for(let i=0;i<30&&!won;i++){const b=R.startHunt(p,'suburb',i);assert.equal(R.allies(b).length,2);
  for(let r=0;r<40&&!b.over;r++)R.resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
  if(b.over==='win'&&b.units.find(u=>u.uid==='m').alive){R.finishHunt(p,b);won=true;}else R.finishHunt(p,b);}
 assert.ok(won);assert.ok(p.mate.exp>0);
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
 const mail=Object.entries(ITEMS).find(([,it])=>it.name==='鋼鐵鎧甲')[0];assert.equal(ITEMS[mail].mres,28);assert.deepEqual(ITEMS[mail].rng.mres,[24,32]);
 assert.ok(D.ensureItem(mail+'~84'),'舊存檔只擲了防禦，抗魔取中間');assert.equal(ITEMS[mail+'~84'].mres,28);
 const spear=Object.values(ITEMS).find(it=>it.name==='短矛');assert.equal(spear.counter,6);assert.equal(spear.hit,3);
 assert.equal(Object.values(ITEMS).find(it=>it.name==='手斧').crit,18);
 const r={next:()=>.5};assert.equal(B.mresCut(280,10,r),26,'280 抗魔、10 級魔法：中間那格 26%');assert.equal(B.mresCut(5,10,r),9);
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
  const b=D.startHunt(p,'camp',seed);assert.equal(b.captureRoom,5);
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
 assert.equal(R.petLearn(p,x.uid,'combo').ok,true);assert.equal(R.petSkills(x).length,1);assert.equal(R.petLearn(p,x.uid,'combo').ok,false);assert.equal(R.petForget(p,x.uid,'combo').ok,true);
 assert.ok(R.gradeMax(x).every((g,i)=>x.grade[i]<=g));
 p.mate=R.buildFighter(16,'bow','guanyu','關羽',{water:10},9);p.mate.pets=[];p.mate.petOut=null;
 assert.equal(R.withMate(p,()=>(p.pets||[]).length,1),0);assert.equal(R.partyUnits(p).filter(u=>u.kind==='pet').length,1);
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
