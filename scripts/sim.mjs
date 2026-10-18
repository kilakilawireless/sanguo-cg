// 平衡試算：node scripts/sim.mjs  —— 不同等級的角色在各地點自動普攻，看勝率、平均剩血、每場經驗。
import {createPlayer,addItem,equip,battleUnit,gainExp,allocBp} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {PLACES} from '../www/src/data/places.mjs';
const mk=(lv,gear)=>{const p=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;
 if(lv>1){gainExp(p,lv**4);while(p.freeBp>=4){allocBp(p,'vit',2);allocBp(p,'str',2);}}
 for(const g of gear){addItem(p,g);equip(p,g);}const s=battleUnit(p);p.hp=s.maxHp;return p;};
function group(pl,floor){const [a,b]=pl.groups,n=a+Math.floor(Math.random()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=Math.random()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(Math.random()*(hi-lo+1))];});}
function run(lv,gear,place,floor=1,N=400){let win=0,hpLeft=0,exp=0,rounds=0;
 for(let i=0;i<N;i++){const p=mk(lv,gear),u=battleUnit(p),b=createBattle({party:[{...u,hp:u.maxHp}],enemies:place.boss&&floor===place.boss.at&&i<0?place.boss.group:group(place,floor),seed:i*7919+1});
  while(!b.over&&b.round<60)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
  rounds+=b.round;if(b.over==='win'){win++;const me=b.units[0];hpLeft+=me.hp/me.maxHp;exp+=rewards(b,p).exp;}}
 return `勝率 ${(win/N*100).toFixed(0)}%  勝場剩血 ${(hpLeft/Math.max(1,win)*100).toFixed(0)}%  回合 ${(rounds/N).toFixed(1)}  經驗 ${(exp/Math.max(1,win)).toFixed(0)}`;}
function boss(lv,gear,place,N=200){let win=0;for(let i=0;i<N;i++){const p=mk(lv,gear),u=battleUnit(p),b=createBattle({party:[{...u,hp:u.maxHp}],enemies:place.boss.group,seed:i+1});
 while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);if(b.over==='win')win++;}return `頭目勝率 ${(win/N*100).toFixed(0)}%`;}
const L1=['swordC','mailL'],L2=['swordI','mailI','helmL','bootL'],L3=['swordS','mailI','helmL','bootL'];
console.log('Lv1 郊外 無甲',run(1,['swordC'],PLACES.suburb));
console.log('Lv1 郊外',run(1,L1,PLACES.suburb));
console.log('Lv3 郊外',run(3,L1,PLACES.suburb));
for(const f of [1,3,5])console.log(`Lv5 試煉 ${f}F`,run(5,L1,PLACES.trial,f));
for(const f of [1,3])console.log(`Lv10 黃巾 ${f}F`,run(10,L2,PLACES.camp,f));
console.log('Lv14 黃巾頭目',boss(14,L2,PLACES.camp));
console.log('Lv20 樹精之森',run(20,L3,PLACES.forest,2));
console.log('Lv22 長老樹精',boss(22,L3,PLACES.forest));
