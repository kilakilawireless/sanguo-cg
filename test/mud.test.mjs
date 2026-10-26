// 文字版擂台：一個人出戰、擂台電腦代打、常駐好手
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import {makeRng} from '../www/src/core/rng.mjs';

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
test('擂台的諸刃每級 +30%、聖盾撐三回合', ()=>{
 const p=hero('guard');p.skills=[{id:'wall',lv:1,exp:0}];
 const b=R.startHunt(p,'suburb',5),u=R.allies(b)[0];u.mp=999;u.hp=u.maxHp=99999;
 R.resolveRound(b,[{actor:'p',kind:'skill',skill:'wall',target:'p'}]);assert.equal(u.wallLeft,2);assert.ok(u.wall>0);
 R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(u.wallLeft,1);assert.ok(u.wall>0);
 R.resolveRound(b,[{actor:'p',kind:'defend'}]);assert.equal(u.wall,0);
 assert.match(R.skillDesc('blade',2),/攻擊 \+60%/);
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
 const m=R.MASTERS.find(x=>x.job==='axe');assert.deepEqual(m.skills,['blade']);
 assert.ok(R.MASTERS.every(x=>x.skills.every(id=>!['cover','seal','rally'].includes(id))));
});
