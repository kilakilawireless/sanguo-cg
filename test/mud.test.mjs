// 文字版擂台：一個人出戰、擂台電腦代打、常駐好手
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {ITEMS} from '../www/src/data/items.mjs';

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
test('擂台的諸刃比原作多三成、聖盾撐三回合', ()=>{
 const p=hero('guard');p.skills=[{id:'wall',lv:1,exp:0}];
 const b=R.startHunt(p,'suburb',5),u=R.allies(b)[0];u.mp=999;u.hp=u.maxHp=99999;
 R.resolveRound(b,[{actor:'p',kind:'skill',skill:'wall',target:'p'}]);assert.equal(u.wallLeft,2);assert.ok(u.wall>0);
 R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(u.wallLeft,1);assert.ok(u.wall>0);
 R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(u.wall,0);
 assert.match(R.skillDesc('blade',2),/攻擊 \+18%/);
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
 assert.ok(R.MASTERS.every(x=>x.skills.every(id=>!['cover','seal','rally'].includes(id))));
});
import * as D from '../www/src/mud/dungeon.mjs';
test('打造：材料夠、錢夠才做得出來', ()=>{
 const p=hero('sword');p.gold=1000;
 assert.equal(D.forge(p,'cg_sword_1').ok,false);
 P.addItem(p,'copper',6);P.addItem(p,'pine',1);
 assert.ok(D.forge(p,'cg_sword_1').ok);assert.equal(P.countItem(p,'cg_sword_1'),1);assert.equal(P.countItem(p,'copper'),0);
 assert.deepEqual(D.RECIPES.dragonSword.mats,[['rustySword',1],['knightOre',2],['demonCrystal',2],['phantomBar',20]]); // 照原作
 assert.equal(ITEMS.dragonSword.atk,210);assert.equal(ITEMS.dragonSword.lv,7);
 // 加寶石：藍寶石 5 級＝攻擊 +11%
 D.addMat(p,'copper',6);D.addMat(p,'pine',1);D.addMat(p,'gem_blue_5',1);p.gold=1000;
 assert.ok(D.forge(p,'cg_sword_1','gem_blue_5').ok);assert.equal(ITEMS['cg_sword_1@gem_blue_5'].atk,ITEMS.cg_sword_1.atk+Math.round(ITEMS.cg_sword_1.atk*11/100));
 assert.equal(p.mats.gem_blue_5,undefined);
 assert.ok(R.shopStock('weapon').every(id=>ITEMS[id].cheap));
});
test('地下城：三層，最深處是王，打倒掉寶石', ()=>{
 assert.equal(D.DUNGEONS.length,18);assert.equal(D.DUNGEONS[0].boss,'楓楓洋洋');assert.equal(D.DUNGEONS[1].boss,'笑死人');
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
 assert.ok(['小吃','鮭魚','學測'].every(n=>D.DUNGEONS.some(x=>x.boss===n)));assert.equal(new Set(D.DUNGEONS.map(x=>x.id)).size,18);
});
