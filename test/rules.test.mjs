// 核心規則的邊界（第 9 輪補）：裝備等級限制、轉職扣錢歸零聲望卸裝、晉級扣費升階、配點單項上限
import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,addItem,equip,takeJob,promoteCheck,promote,allocBp,gainExp,countItem} from '../www/src/core/player.mjs';
import {singleCapAt} from '../www/src/core/stats.mjs';
import {CHANGE_FEE,PROMOTE_FEE,RANK_REP} from '../www/src/data/jobs.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:15,str:15,tgh:0,qui:0,mgc:0},elem:{fire:10},seed:7}).player;
test('遊民只能用 1 級裝備；見習劍士到 4 級；不能用別的武器',()=>{
 const p=mk();addItem(p,'swordI');assert.equal(equip(p,'swordI').ok,false);
 p.job='sword';assert.equal(equip(p,'swordI').ok,true);addItem(p,'swordG');assert.equal(equip(p,'swordG').ok,true);
 addItem(p,'axeC');assert.equal(equip(p,'axeC').ok,false);
});
test('轉職：付轉職費、聲望歸零、從見習開始、不能用的武器自動卸下',()=>{
 const p=mk();p.job='sword';p.rank=1;p.rep=12000;p.gold=CHANGE_FEE+5;addItem(p,'swordI');equip(p,'swordI');addItem(p,'letterAxe');
 const r=takeJob(p,'axe');assert.ok(r.ok,r.msg);
 assert.equal(p.gold,5);assert.equal(p.rep,0);assert.equal(p.rank,0);assert.equal(p.equip.weapon,null);assert.equal(countItem(p,'swordI'),1);assert.equal(countItem(p,'letterAxe'),0);
 const q=mk();q.job='sword';q.gold=CHANGE_FEE-1;addItem(q,'letterAxe');assert.equal(takeJob(q,'axe').ok,false);assert.equal(q.job,'sword');
});
test('晉級：條件都到才行，付晉級費、職階加一',()=>{
 const p=mk();p.job='sword';gainExp(p,20**4);p.rep=RANK_REP[1];p.gold=PROMOTE_FEE[1];
 assert.equal(promoteCheck(p).ok,false);assert.equal(promote(p).ok,false); // 還沒打樹精長老
 p.flags.treant=true;assert.ok(promote(p).ok);assert.equal(p.rank,1);assert.equal(p.gold,0);
});
test('配點：點數不夠或超過單項上限都不行，不會扣點',()=>{
 const p=mk();gainExp(p,30**4);const cap=singleCapAt(p.lv),free=p.freeBp;
 assert.equal(allocBp(p,'qui',cap+1).ok,false);assert.equal(p.freeBp,free);
 assert.equal(allocBp(p,'qui',free+1).ok,false);assert.equal(p.freeBp,free);
 assert.ok(allocBp(p,'qui',Math.min(cap,free)).ok);assert.equal(p.freeBp,free-Math.min(cap,free));
});
