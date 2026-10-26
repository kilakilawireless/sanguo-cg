// 文字版擂台：一個人出戰、擂台電腦代打、常駐好手
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';

const hero=job=>{const p=R.newHero({name:'測試',look:'guanshanyue',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:3}).player;R.joinJob(p,job);return p;};

test('公會直接就職，不留推薦信', ()=>{
 const p=hero('sword');assert.equal(p.job,'sword');assert.equal(P.countItem(p,'letterSword'),0);
 assert.equal(R.joinJob(p,'priest').ok,false); // 轉職要 1000 金
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
