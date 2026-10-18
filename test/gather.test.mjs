import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,learnSkill,takeJob,gather,promoteCheck,battleUnit,countItem,capOf} from '../www/src/core/player.mjs';
import {PLACES} from '../www/src/data/places.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:15,str:15,tgh:0,qui:0,mgc:0},elem:{fire:10},seed:7}).player;
test('遊民能學採集，上限 4；不能學戰鬥技能',()=>{const p=mk();assert.ok(learnSkill(p,'lumber').ok);assert.equal(capOf(p,'lumber'),4);assert.ok(!learnSkill(p,'combo').ok);assert.equal(battleUnit(p).skills.length,0);});
test('採集：耗魔、拿材料、階級受技能等級限制',()=>{
 const p=mk();learnSkill(p,'lumber');const mp=p.mp;let n=0;
 for(let i=0;i<10;i++){const r=gather(p,PLACES.suburb.gather,'lumber',()=>0);assert.ok(r.ok,r.msg);n++;}
 assert.equal(p.mp,mp-10);assert.equal(countItem(p,'pine'),10);assert.equal(countItem(p,'oak'),0);
 assert.ok(!gather(p,PLACES.trial.gather,'lumber').ok);p.mp=0;assert.ok(!gather(p,PLACES.suburb.gather,'lumber').ok);
});
test('採集職業不用推薦信就職，晉級看技能等級不用任務',()=>{
 const p=mk();assert.ok(takeJob(p,'lumber').ok);assert.equal(capOf(p,'lumber'),4);assert.ok(learnSkill(p,'lumber').ok);
 p.skills[0].lv=4;p.rep=10000;p.gold=1000;const c=promoteCheck(p);assert.ok(c.ok,JSON.stringify(c.rows));assert.equal(c.rows.length,3);
});
import {craft,canCraft,addItem,stats} from '../www/src/core/player.mjs';
import {RECIPES} from '../www/src/data/recipes.mjs';
test('製造：材料、技能等級、遊民上限 2',()=>{
 const p=mk();assert.ok(learnSkill(p,'craftSword').ok);assert.equal(capOf(p,'craftSword'),2);
 assert.ok(!canCraft(p,'swordC').ok);for(const [m,n] of RECIPES.swordC.mats)addItem(p,m,n);
 const r=craft(p,'swordC');assert.ok(r.ok,r.msg);assert.equal(countItem(p,'swordC'),1);assert.equal(countItem(p,'copper'),0);
 assert.ok(!canCraft(p,'swordS').ok);
 const q=mk();assert.ok(takeJob(q,'smithSword').ok);assert.equal(capOf(q,'craftSword'),4);assert.equal(battleUnit(q).skills.length,0);
});
test('藥劑師做藥疊在同一格',()=>{const p=mk();assert.ok(takeJob(p,'pharmacist').ok);assert.ok(learnSkill(p,'medicine').ok);addItem(p,'herb',4);
 assert.ok(craft(p,'potion').ok);assert.ok(craft(p,'potion').ok);assert.equal(countItem(p,'potion'),2);assert.equal(p.bag.length,1);});
