// 經濟試算：node scripts/economy.mjs [目標等級，預設 50] [mage] —— 加 mage 用魔術師算（自己放魔法、補魔花錢） —— 跟 pace.mjs 同一套練功路線，但血魔帶到下一場、
// 有人生命剩不到 35% 或全隊魔力剩不到 25% 就回城，照醫院價錢自己付錢補（先補生命，錢夠才補魔力），
// 換裝備時照商店價錢買，支線任務到了等級就當作做完拿報酬。看錢會不會不夠用、補不起魔力時打得多辛苦。
import {createPlayer,gainExp,allocBp,partyUnits,addItem,equip,syncParty,stats,HP_PRICE,MP_PRICE,START_GOLD} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {chooseAllyAction} from '../www/src/core/ai.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {newOfficer,officerStats} from '../www/src/core/officer.mjs';
import {PLACES} from '../www/src/data/places.mjs';
import {ITEMS,SHOPS,sellPrice} from '../www/src/data/items.mjs';
import {QUESTS} from '../www/src/data/quests.mjs';
const plan=lv=>lv<=4?['suburb',1,lv<=2?[]:['dianwei'],['swordN','mailN']]
 :lv<=9?['trial',Math.min(6,lv-3),['dianwei','huatuo'],['swordC','mailL']]
 :lv<=19?['camp',Math.min(3,Math.max(1,lv-11)),['dianwei','huatuo','taishici','zuoci'],['swordI','mailI','helmL','bootL']]
 :lv<=23?['forest',Math.min(3,lv-19),['dianwei','huatuo','taishici','zuoci'],['swordS','mailI','helmL','bootL']]
 :lv<=31?['hangu',Math.min(4,Math.max(1,lv-27)),['dianwei','huatuo','taishici','zuoci'],['swordG','mailG','helmI','bootT']]
 :lv<=44?['lishan',Math.min(5,Math.max(1,lv-38)),['dianwei','huatuo','machao','caiwenji'],['swordG','mailG','helmI','bootT']]
 :['beast',Math.min(3,lv-44),['dianwei','huatuo','machao','caiwenji'],['swordG','mailG','helmI','bootT']];
const TARGET=+process.argv[2]||50,SEC=16,TRIP=20;
let s=12345;const rnd=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;
function group(pl,floor){const [a,b]=pl.groups,n=a+Math.floor(rnd()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((t,x)=>t+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=rnd()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(rnd()*(hi-lo+1))];});}
const MAGE=process.argv[3]==='mage',BP=MAGE?['vit','mgc']:['vit','str'];
const p=createPlayer({name:'試',look:'x',bp:{vit:15,[BP[1]]:15},elem:{fire:10},seed:1}).player;p.job=MAGE?'mage':'sword';p.gold=START_GOLD;
// 魔術師：武器、衣服換成杖和袍，火焰／風刃魔法等級跟著人物等級長，10 級起會範圍魔法；打雜兵都用 Lv1 省魔（◎ 試算假設）
const gearOf=id=>MAGE?({swordN:'staffN',mailN:'robeC',swordC:'staffS',mailL:'robeC',swordI:'staffO',mailI:'robeS',swordS:'staffJ',swordG:'staffG',mailG:'robeG',helmL:'hatR',helmI:'hatR'}[id]||id):id;
const mageSkills=lv=>{const L=Math.min(10,1+Math.floor(lv/4));return [{id:'fire1',lv:L,exp:0},{id:'wind1',lv:L,exp:0},...(lv>=10?[{id:'fire2',lv:Math.max(1,L-2),exp:0}]:[])];};
const rng=makeRng(7);
const shopPrice=id=>Object.values(SHOPS).some(x=>x.stock.includes(id))?ITEMS[id].price:0;
const members=()=>[[p,stats(p)],...p.party.map(id=>[p.officers[id],officerStats(id,p.officers[id].lv)])];
// 回城：先補生命；魔力只用留下 300 金（下次補生命的錢）以外的錢補，不夠就補一部分
function town(){let hp=0,mp=0;for(const [o,t] of members()){const n=Math.min(t.maxHp-o.hp,Math.max(0,Math.floor(p.gold/HP_PRICE)));o.hp+=n;p.gold-=Math.ceil(n*HP_PRICE);hp+=n;}
 for(const [o,t] of members()){const n=Math.min(t.maxMp-o.mp,Math.max(0,Math.floor((p.gold-300)/MP_PRICE)));o.mp+=n;p.gold-=n*MP_PRICE;mp+=n;}return [hp,mp];}
const low=()=>{const m=members();return m.some(([o,t])=>o.hp<t.maxHp*.35)||m.reduce((a,[o])=>a+o.mp,0)<m.reduce((a,[,t])=>a+t.maxMp,0)*.25;};
let gear=[],row=[],T={n:0,lose:0,trips:0,sec:0,crystal:0,hp:0,mp:0,mpNeed:0,gear:0};
for(let lv=1;lv<TARGET;lv++){
 const [place,floor,party,want]=plan(lv),pl=PLACES[place],L={n:0,lose:0,crystal:0,spend:0};
 // 支線任務：到了能接的等級就當作順手做完，拿報酬金錢
 for(const q of Object.values(QUESTS))if(q.minLv===lv){p.gold+=q.reward.gold||0;T.quest=(T.quest||0)+(q.reward.gold||0);}
 for(const id of party)if(!p.officers[id])p.officers[id]=newOfficer(id,Math.max(1,lv-1));
 p.party=[...party];for(const id of party)if(p.officers[id].lv<lv-1)Object.assign(p.officers[id],{...newOfficer(id,lv-1),hp:p.officers[id].hp,mp:p.officers[id].mp});
 while(p.lv===lv&&L.n<3000){
  // 錢夠才換裝備（先留一次補生命的錢）
  if(MAGE)p.skills=mageSkills(p.lv);
  for(const x of want.map(gearOf))if(!gear.includes(x)&&p.gold-shopPrice(x)>=200){p.gold-=shopPrice(x);T.gear+=shopPrice(x);addItem(p,x);equip(p,x);gear.push(x);}
  const b=createBattle({party:partyUnits(p),enemies:group(pl,floor),seed:(T.n+1)*7919});
  while(!b.over&&b.round<80){const me=b.units.find(u=>u.uid==='p');resolveRound(b,MAGE?[0,1].map(()=>({...chooseAllyAction(b,me,rng),actor:'p',lv:b.units.some(u=>u.boss&&u.alive)?undefined:1})):[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);}L.n++;T.n++;T.sec+=SEC;
  const me=b.units.find(u=>u.uid==='p');p.hp=Math.max(b.over==='win'?1:0,me.hp);p.mp=me.mp;syncParty(p,b.units.filter(u=>u.side==='ally'));
  if(b.over==='win'){const w=rewards(b,{lv:p.lv});gainExp(p,w.exp);while(p.freeBp>=4){allocBp(p,BP[0],2);allocBp(p,BP[1],2);}
   const g=w.items.reduce((t,i)=>t+(ITEMS[i]?.kind==='crystal'?sellPrice(i):0),0);p.gold+=g;L.crystal+=g;}else{L.lose++;p.hp=1;}
  if(b.over!=='win'||low()){const need=members().reduce((a,[o,t])=>a+t.maxMp-o.mp,0),g0=p.gold,[hp,mp]=town();T.trips++;T.sec+=TRIP;T.hp+=hp;T.mp+=mp;T.mpNeed+=need;L.spend+=g0-p.gold;}
 }
 T.lose+=L.lose;T.crystal+=L.crystal;
 if(lv%5===4||lv===TARGET-1)row.push(`到 Lv${String(lv+1).padStart(2)} ${pl.name.padEnd(6,'　')} 累計 ${String(T.n).padStart(4)} 場、輸 ${T.lose}、回城 ${T.trips} 次、${(T.sec/3600).toFixed(1)} 小時　身上 ${p.gold} 金　魔力補了 ${T.mpNeed?Math.round(T.mp/T.mpNeed*100):100}%`);
}
console.log(row.join('\n'));
console.log(`魔石共 ${T.crystal} 金；裝備 ${T.gear} 金；任務報酬 ${T.quest||0} 金（到了等級就當作做完）`);
