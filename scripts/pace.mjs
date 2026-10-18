// 流程試算：node scripts/pace.mjs —— 新角色照一般玩法從 Lv1 練到第一次晉級條件（Lv20），
// 每級在哪裡打、打幾場、花多久（三倍速：戰鬥約 10 秒＋走路 6 秒）、魔石賣多少錢、聲望拿多少。看有沒有卡關或錢不夠的斷點。
import {createPlayer,gainExp,allocBp,partyUnits,addItem,equip} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {newOfficer} from '../www/src/core/officer.mjs';
import {expFor} from '../www/src/core/stats.mjs';
import {PLACES} from '../www/src/data/places.mjs';
import {ITEMS,sellPrice} from '../www/src/data/items.mjs';
import {QUESTS} from '../www/src/data/quests.mjs';
const SEC=16;
// 照等級選地點與樓層、隊友、裝備（跟 sim.mjs 同一套假設）
const plan=lv=>lv<=4?['suburb',1,lv<=2?[]:['dianwei'],['swordC','mailL']]
 :lv<=9?['trial',Math.min(6,lv-3),['dianwei','huatuo'],['swordC','mailL']]
 :lv<=19?['camp',Math.min(3,Math.max(1,lv-11)),['dianwei','huatuo','taishici','zuoci'],['swordI','mailI','helmL','bootL']]
 :['forest',1,['dianwei','huatuo','taishici','zuoci'],['swordS','mailI','helmL','bootL']];
function group(pl,floor,rnd){const [a,b]=pl.groups,n=a+Math.floor(rnd()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=rnd()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(rnd()*(hi-lo+1))];});}
let s=12345;const rnd=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;
const p=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;p.job='sword';
let total=0,gold=0,rep=0,loses=0,row=[];
for(let lv=1;lv<20;lv++){
 const [place,floor,party,gear]=plan(lv),pl=PLACES[place];let n=0,g=0,r=0;
 while(p.lv===lv&&n<2000){
  const q=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;Object.assign(q,{lv:p.lv,exp:p.exp,bp:p.bp,job:'sword'});
  for(const x of gear){addItem(q,x);equip(q,x);}q.party=[];for(const id of party){q.officers[id]=newOfficer(id,Math.max(1,lv-1));q.party.push(id);}
  const us=partyUnits(q);us[0].hp=us[0].maxHp;const b=createBattle({party:us,enemies:group(pl,floor,rnd),seed:(n+1)*7919+lv});
  while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);n++;
  if(b.over!=='win'){loses++;continue;}
  const w=rewards(b,{lv:p.lv});gainExp(p,w.exp);while(p.freeBp>=4){allocBp(p,'vit',2);allocBp(p,'str',2);}
  g+=w.items.reduce((t,i)=>t+(ITEMS[i]?.kind==='crystal'?sellPrice(i):0),0);r+=w.rep;}
 total+=n;gold+=g;rep+=r;row.push(`Lv${String(lv).padStart(2)}→${lv+1} ${place}${floor}F ${String(n).padStart(4)} 場 ${(n*SEC/60).toFixed(0).padStart(4)} 分  魔石 +${g}  聲望 +${r}`);
}
console.log(row.join('\n'));
console.log(`合計 ${total} 場（輸 ${loses}），約 ${(total*SEC/3600).toFixed(1)} 小時；魔石共 ${gold} 金；戰鬥聲望共 ${rep}（每日上限 800）`);
console.log('任務報酬（Lv20 前可接）：',Object.values(QUESTS).filter(q=>q.minLv<20).reduce((t,q)=>t+q.reward.gold,0),'金');
