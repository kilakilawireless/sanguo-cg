// 流程試算：node scripts/pace.mjs [目標等級，預設 20]（PET=1 帶寵物） —— 新角色照一般玩法從 Lv1 練到目標等級（20 是第一次晉級、50 是第二次、70 是第三次），
// 每級在哪裡打、打幾場、花多久（三倍速：戰鬥約 10 秒＋走路 6 秒）、魔石賣多少錢、聲望拿多少。看有沒有卡關或錢不夠的斷點。
import {createPlayer,gainExp,allocBp,partyUnits,addItem,equip,addPet} from '../www/src/core/player.mjs';
import {MONSTERS} from '../www/src/data/monsters.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {newOfficer} from '../www/src/core/officer.mjs';
import {expFor} from '../www/src/core/stats.mjs';
import {PLACES} from '../www/src/data/places.mjs';
import {ITEMS,sellPrice} from '../www/src/data/items.mjs';
import {QUESTS} from '../www/src/data/quests.mjs';
const SEC=16;
// 晉級：20 級打倒樹精長老升正職、50 級打完神獸升王宮職（裝備上限跟著放寬，◎ 試算假設）
const RANK=lv=>lv>=50?2:lv>=20?1:0;
// PET=1：帶一隻寵物（練功點檔次最高的怪、比主角低 2 級，◎ 試算假設）；帶寵物時主角每回合只行動一次
const sumG=m=>MONSTERS[m].grade.reduce((a,b)=>a+b,0),petRng=makeRng(3);
const withPet=(q,lv,pl,floor)=>{if(!process.env.PET)return;const list=(pl.floorMons?pl.floorMons(floor):pl.mons)||pl.boss.group;addPet(q,list.map(x=>x[0]).filter(m=>!MONSTERS[m].boss).sort((a,b)=>sumG(b)-sumG(a))[0],Math.max(1,lv-2),petRng);};
// 照等級選地點與樓層、隊友、裝備（跟 sim.mjs 同一套假設）
const plan=lv=>lv<=4?['suburb',1,lv<=2?[]:['dianwei'],['swordN','mailN']]
 :lv<=9?['trial',Math.min(6,lv-3),['dianwei','huatuo'],['swordC','mailL']]
 :lv<=19?['camp',Math.min(3,Math.max(1,lv-11)),['dianwei','huatuo','taishici','zuoci'],['swordI','mailI','helmL','bootL']]
 :lv<=23?['forest',Math.min(3,lv-19),['dianwei','huatuo','taishici','zuoci'],['swordS','mailI','helmL','bootL']]
 :lv<=31?['hangu',Math.min(4,Math.max(1,lv-27)),['dianwei','huatuo','taishici','zuoci'],['swordG','mailG','helmI','bootT']]
 :lv<=44?['lishan',Math.min(5,Math.max(1,lv-38)),['dianwei','huatuo','machao','caiwenji'],['swordG','mailG','helmI','bootT']]
 :lv<=51?['beast',Math.min(3,lv-44),['dianwei','huatuo','machao','caiwenji'],['swordP','mailP','helmP','bootP']]
 :['curse',Math.min(6,Math.max(1,lv-52)),['dianwei','huatuo','machao','caiwenji'],['swordX','mailX','helmX','bootX']];
const TARGET=+process.argv[2]||20;
function group(pl,floor,rnd){const [a,b]=pl.groups,n=a+Math.floor(rnd()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=rnd()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(rnd()*(hi-lo+1))];});}
let s=12345;const rnd=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;
const p=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;p.job='sword';
let total=0,gold=0,rep=0,loses=0,row=[],spend=0;
// 補給：每場打完把全隊補滿要花的錢（照原作醫院 1 點生命 0.5 金、1 點魔力 1 金）
const refill=b=>b.units.filter(u=>u.side==='ally').reduce((t,u)=>t+(u.maxHp-Math.max(0,u.hp))*.5+(u.maxMp-u.mp),0);
for(let lv=1;lv<TARGET;lv++){
 const [place,floor,party,gear]=plan(lv),pl=PLACES[place];let n=0,g=0,r=0,c=0;
 while(p.lv===lv&&n<3000){
  const q=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;Object.assign(q,{lv:p.lv,exp:p.exp,bp:p.bp,job:'sword',rank:RANK(lv)});
  for(const x of gear){addItem(q,x);if(!equip(q,x).ok)throw new Error('穿不上 '+x);}q.party=[];for(const id of party){q.officers[id]=newOfficer(id,Math.max(1,lv-1));q.party.push(id);}withPet(q,lv,pl,floor);
  const us=partyUnits(q);us[0].hp=us[0].maxHp;const b=createBattle({party:us,enemies:group(pl,floor,rnd),seed:(n+1)*7919+lv});
  while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);n++;c+=refill(b);
  if(b.over!=='win'){loses++;continue;}
  const w=rewards(b,{lv:p.lv});gainExp(p,w.exp);while(p.freeBp>=4){allocBp(p,'vit',2);allocBp(p,'str',2);}
  g+=w.items.reduce((t,i)=>t+(ITEMS[i]?.kind==='crystal'?sellPrice(i):0),0);r+=w.rep;}
 total+=n;gold+=g;rep+=r;spend+=c;row.push(`Lv${String(lv).padStart(2)}→${lv+1} ${place}${floor}F ${String(n).padStart(4)} 場 ${(n*SEC/60).toFixed(0).padStart(4)} 分  魔石 +${g}  補給 -${Math.round(c)}  聲望 +${r}`);
}
console.log(row.join('\n'));
console.log(`合計 ${total} 場（輸 ${loses}），約 ${(total*SEC/3600).toFixed(1)} 小時；魔石共 ${gold} 金、補給共 ${Math.round(spend)} 金；戰鬥聲望共 ${rep}`);
console.log(`任務報酬（Lv${TARGET} 前可接）：`,Object.values(QUESTS).filter(q=>q.minLv<TARGET).reduce((t,q)=>t+q.reward.gold,0),'金');
// 頭目：用剛達到挑戰等級的隊伍打 200 場看勝率
const BOSS=[['forest',22],['hangu',31],['lishan',43],['beast',50],['curse',60]].filter(([,l])=>l<=TARGET+2);
for(const [place,lv] of BOSS){const [,,party,gear]=plan(lv),pl=PLACES[place];let win=0;
 for(let i=0;i<200;i++){const q=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;q.job='sword';gainExp(q,expFor(lv));q.rank=RANK(lv);while(q.freeBp>=4){allocBp(q,'vit',2);allocBp(q,'str',2);}
  for(const x of gear){addItem(q,x);if(!equip(q,x).ok)throw new Error('穿不上 '+x);}q.party=[];for(const id of party){q.officers[id]=newOfficer(id,lv-1);q.party.push(id);}withPet(q,lv,pl,1);
  const us=partyUnits(q);us[0].hp=us[0].maxHp;const b=createBattle({party:us,enemies:pl.boss.group,seed:i*7919+3});
  while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);if(b.over==='win')win++;}
 console.log(`頭目 ${pl.name} Lv${lv} 五人：勝率 ${(win/2).toFixed(0)}%`);}
