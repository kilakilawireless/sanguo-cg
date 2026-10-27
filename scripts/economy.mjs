// 經濟試算：node scripts/economy.mjs [目標等級，預設 50] [mage|bow|fighter] —— 預設劍士；mage 自己放魔法、補魔花錢；bow、fighter 穿輕裝 —— 跟 pace.mjs 同一套練功路線，但血魔帶到下一場、
// 有人生命剩不到 35% 或全隊魔力剩不到 25% 就回城，照醫院價錢自己付錢補（先補生命，錢夠才補魔力），
// 換裝備時照商店價錢買，傭兵第一次入隊照酒吧價錢付招募費（錢不夠就先不帶），支線任務到了等級就當作做完拿報酬，掉落全賣店。
// 被打倒會受傷，回城時先治傷（錢不夠先治最重的）；連輸就退回較低的練功點，還是打不過就退更遠。
// 環境變數：PET=1 帶寵物出戰（抓目前練功點檔次最高的怪，落後 8 級就換一隻，寵物也要補魔、治傷）；PHYS=1 古代王墓起不帶莉莉安（換成艾倫；前期沒有多的物理傭兵可換）；RICH=1 錢無限（看每級收支）；DEBUG=1 印每級收支和各人用魔。看錢會不會不夠用、補不起魔力時打得多辛苦。
import {createPlayer,gainExp,allocBp,partyUnits,addItem,equip,syncParty,stats,addPet,petOutOf,HP_PRICE,MP_PRICE,CHARITY,START_GOLD,injureParty,treatAll,treatAllCost} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {chooseAllyAction} from '../www/src/core/ai.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {newOfficer,officerStats} from '../www/src/core/officer.mjs';
import {petStats,petGainExp} from '../www/src/core/pet.mjs';
import {MONSTERS} from '../www/src/data/monsters.mjs';
import {OFFICERS} from '../www/src/data/officers.mjs';
import {PLACES} from '../www/src/data/places.mjs';
import {ITEMS,SHOPS,sellPrice} from '../www/src/data/items.mjs';
import {SKILLS} from '../www/src/data/skills.mjs';
import {QUESTS} from '../www/src/data/quests.mjs';
const plan0=lv=>lv<=4?['suburb',1,lv<=2?[]:['dianwei'],['swordN','mailN']]
 :lv<=9?['trial',Math.min(6,lv-3),['dianwei','huatuo'],['swordC','mailL']]
 :lv<=19?['camp',Math.min(3,Math.max(1,lv-11)),['dianwei','huatuo','taishici','zuoci'],['swordI','mailI','helmL','bootL']]
 :lv<=23?['forest',Math.min(3,lv-19),['dianwei','huatuo','taishici','zuoci'],['swordS','mailI','helmL','bootL']]
 :lv<=31?['hangu',Math.min(4,Math.max(1,lv-27)),['dianwei','huatuo','taishici','zuoci'],['swordG','mailG','helmI','bootT']]
 :lv<=44?['lishan',Math.min(5,Math.max(1,lv-38)),['dianwei','huatuo','machao','caiwenji'],['swordG','mailG','helmI','bootT']]
 :lv<=51?['beast',Math.min(3,lv-44),['dianwei','huatuo','machao','caiwenji'],['swordP','mailP','helmP','bootP']]
 :['curse',Math.min(6,Math.max(1,lv-52)),['dianwei','huatuo','machao','caiwenji'],['swordX','mailX','helmX','bootX']];
const plan=lv=>{const r=plan0(lv);if(process.env.PHYS&&lv>=10)r[2]=r[2].map(id=>({caiwenji:'taishici'}[id]||id)).filter((x,i,a)=>a.indexOf(x)===i);return r;};
const TARGET=+process.argv[2]||50,SEC=16,TRIP=20;
let s=12345;const rnd=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;
function group(pl,floor){const [a,b]=pl.groups,n=a+Math.floor(rnd()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((t,x)=>t+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=rnd()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(rnd()*(hi-lo+1))];});}
const JOB=process.argv[3]||'sword',MAGE=JOB==='mage',BP=MAGE?['vit','mgc']:['vit','str'];
const p=createPlayer({name:'試',look:'x',bp:{vit:15,[BP[1]]:15},elem:{fire:10},seed:1}).player;p.job=JOB;p.gold=process.env.RICH?1e7:START_GOLD;
// 魔術師：武器、衣服換成杖和袍，火焰／風刃魔法等級跟著人物等級長，10 級起會範圍魔法；打雜兵都用 Lv1 省魔（◎ 試算假設）
const LIGHT={mailN:'clothC',mailL:'clothC',mailI:'clothH',mailG:'clothT',mailP:'clothP',helmP:'hoodP',mailX:'clothX',helmX:'hoodX',helmL:'hoodC',helmI:'hoodC'};
const GEAR={mage:{swordN:'staffN',mailN:'robeC',swordC:'staffS',mailL:'robeC',swordI:'staffO',mailI:'robeS',swordS:'staffJ',swordG:'staffG',mailG:'robeT',swordP:'staffP',mailP:'robeP',helmP:'hatP',swordX:'staffX',mailX:'robeX',helmX:'hatX',helmL:'hatR',helmI:'hatR'},
 bow:{...LIGHT,swordN:'bowN',swordC:'bowW',swordI:'bowH',swordS:'bowC',swordG:'bowG',swordP:'bowP',swordX:'bowX'},fighter:{...LIGHT,swordN:null,swordC:null,swordI:null,swordS:null,swordG:null,swordP:null,swordX:null}}[JOB]||{};
const gearOf=id=>id in GEAR?GEAR[id]:id;
const mageSkills=lv=>{const L=Math.min(10,1+Math.floor(lv/4));return [{id:'fire1',lv:L,exp:0},{id:'wind1',lv:L,exp:0},...(lv>=10?[{id:'fire2',lv:Math.max(1,L-2),exp:0}]:[])];};
const rng=makeRng(7);
const RESERVE=lv=>300+100*lv;
const shopPrice=id=>Object.values(SHOPS).some(x=>x.stock.includes(id))?ITEMS[id].price:0;
const members=()=>{const pet=petOutOf(p);return [[p,stats(p)],...p.party.map(id=>[p.officers[id],officerStats(id,p.officers[id].lv)]),...(pet?[[pet,petStats(pet)]]:[])];};
const sumG=m=>MONSTERS[m].grade.reduce((a,b)=>a+b,0);
function petCheck(lv,pl,floor){if(!process.env.PET)return;const cur=petOutOf(p);if(cur&&lv-cur.lv<8)return;
 const m=(pl.floorMons?pl.floorMons(floor):pl.mons).map(x=>x[0]).sort((a,b)=>sumG(b)-sumG(a))[0];if(cur&&MONSTERS[m]===MONSTERS[cur.mon]&&lv-cur.lv<8)return;
 p.pets=[];p.petOut=null;addPet(p,m,Math.max(1,lv-2),rng);T.pets=(T.pets||0)+1;}
// 回城：先補生命；魔力只用留下 300 金（下次補生命的錢）以外的錢補，不夠就補一部分
// 治傷：有人中傷（25）以上、錢不夠就先治傷最重的（◎ 試算假設）
function town(){let hp=0,mp=0;const hurt=[p,...p.party.map(id=>p.officers[id])].some(o=>(o.inj||0)>=25),tc=treatAllCost(p);if(process.env.DBGT&&hurt)console.log("T",p.lv,p.gold,tc,[p,...p.party.map(id=>p.officers[id])].map(o=>o.inj|0).join(","));if(hurt){const g0=p.gold;treatAll(p);T.treat+=g0-p.gold;}
for(const [o,t] of members()){const n=Math.min(t.maxHp-o.hp,Math.max(0,Math.floor(p.gold/HP_PRICE)));o.hp+=n;p.gold-=Math.ceil(n*HP_PRICE);hp+=n;}
 for(const [o,t] of members())o.hp=Math.max(o.hp,Math.ceil(t.maxHp*CHARITY)); // 沒錢時護士免費補到三成
 for(const [o,t] of members()){const n=Math.min(t.maxMp-o.mp,Math.max(0,Math.floor((p.gold-300)/MP_PRICE)));o.mp+=n;p.gold-=n*MP_PRICE;mp+=n;T[o===p?'mpMe':'mpMerc']=(T[o===p?'mpMe':'mpMerc']||0)+n;}return [hp,mp];}
const low=()=>{const m=members();return m.some(([o,t])=>o.hp<t.maxHp*.35)||m.reduce((a,[o])=>a+o.mp,0)<m.reduce((a,[,t])=>a+t.maxMp,0)*.25;};
let gear=[],row=[],T={n:0,lose:0,trips:0,sec:0,crystal:0,hp:0,mp:0,mpNeed:0,gear:0,fee:0,back:0,treat:0};
for(let lv=1;lv<TARGET;lv++){
 const [place,floor,party,want]=plan(lv),L={n:0,lose:0,crystal:0,spend:0};
 // 打不過（最近 10 場輸 3 場以上）就退回 5 級前的練功點打 20 場再回來，跟玩家會做的一樣
 let recent=[],back=0,depth=1,lastBack=-99;
 // 支線任務：到了能接的等級就當作順手做完，拿報酬金錢
 for(const q of Object.values(QUESTS))if(q.minLv===lv){p.gold+=q.reward.gold||0;T.quest=(T.quest||0)+(q.reward.gold||0);}
 const hired=()=>party.filter(id=>{if(p.officers[id])return true;const fee=OFFICERS[id].fee||0;if(p.gold-fee<200)return false;p.gold-=fee;T.fee+=fee;p.officers[id]=newOfficer(id,Math.max(1,lv-1));return true;});
 p.party=hired();for(const id of p.party)if(p.officers[id].lv<lv-1)Object.assign(p.officers[id],{...newOfficer(id,lv-1),hp:p.officers[id].hp,mp:p.officers[id].mp});
 while(p.lv===lv&&L.n<3000){
  // 錢夠才換裝備（先留一筆補給的錢：買完就沒錢補魔會一路輸，◎ 玩家大概也會這樣留）
  if(MAGE)p.skills=mageSkills(p.lv);
  if(p.party.length<party.length)p.party=hired();
  petCheck(lv,PLACES[place],floor);
  p.rank=lv>=50?2:lv>=20?1:0; // 晉級（跟 pace.mjs 同一套假設）：裝備上限跟著放寬
  for(const x of want.map(gearOf).filter(Boolean))if(!gear.includes(x)&&p.gold-shopPrice(x)>=RESERVE(lv)){p.gold-=shopPrice(x);T.gear+=shopPrice(x);addItem(p,x);if(!equip(p,x).ok)throw new Error('穿不上 '+x);gear.push(x);}
  // 剛退回來又打不過就退更遠（再減 5 級），一路可以退到芙蕾雅
  if(recent.filter(x=>!x).length>=3){depth=L.n-lastBack<40?depth+1:1;lastBack=L.n;back=20;recent=[];T.back++;}
  const [bp,bf]=back-->0?plan(Math.max(1,lv-5*depth)):[place,floor],pl=PLACES[bp];
  const b=createBattle({party:partyUnits(p),enemies:group(pl,bf),seed:(T.n+1)*7919});
  while(!b.over&&b.round<80){const me=b.units.find(u=>u.uid==='p');const ev=resolveRound(b,MAGE?[0,1].map(()=>({...chooseAllyAction(b,me,rng),actor:'p',lv:b.units.some(u=>u.boss&&u.alive)||process.env.MLV==='full'?undefined:process.env.MLV==='half'?Math.ceil(me.skills[0].lv/2):1})):[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
   if(process.env.DEBUG)for(const e of ev)if(e.t==='act'&&e.kind==='skill'){const k=b.units.find(u=>u.uid===e.a).name+e.name;(T.use||={})[k]=(T.use[k]||0)+SKILLS[Object.keys(SKILLS).find(i=>SKILLS[i].name===e.name)].mp(e.lv);}}L.n++;T.n++;T.sec+=SEC;recent=[...recent.slice(-9),b.over==='win'];
  for(const u of b.units)if(u.side==='ally'&&u.downs)T.downs=(T.downs||0)+u.downs;if(!process.env.NOINJ)injureParty(p,b.units.filter(u=>u.side==='ally'),rnd);
  const me=b.units.find(u=>u.uid==='p');p.hp=Math.max(b.over==='win'?1:0,me.hp);p.mp=me.mp;syncParty(p,b.units.filter(u=>u.side==='ally'));
  if(b.over==='win'){const w=rewards(b,{lv:p.lv});gainExp(p,w.exp);if(w.petExp&&petOutOf(p))petGainExp(petOutOf(p),w.petExp);while(p.freeBp>=4){allocBp(p,BP[0],2);allocBp(p,BP[1],2);}
   const g=w.items.reduce((t,i)=>t+(ITEMS[i]?.kind==='crystal'?sellPrice(i):0),0),g2=w.items.reduce((t,i)=>t+(ITEMS[i]?.kind!=='crystal'?sellPrice(i):0),0);p.gold+=g+g2;L.crystal+=g;L.drop=(L.drop||0)+g2;T.drop=(T.drop||0)+g2;}else{L.lose++;p.hp=1;}
  if(b.over!=='win'||low()){const need=members().reduce((a,[o,t])=>a+t.maxMp-o.mp,0),g0=p.gold,[hp,mp]=town();T.trips++;T.sec+=TRIP;T.hp+=hp;T.mp+=mp;T.mpNeed+=need;L.spend+=g0-p.gold;}
 }
 T.lose+=L.lose;T.crystal+=L.crystal;if(process.env.DEBUG)console.log(lv,place,L.n,'倒',T.downs|0,'輸',L.lose,'魔石',L.crystal,'其他掉落',L.drop|0,'醫院',L.spend,'主角補魔',T.mpMe|0,'傭兵補魔',T.mpMerc|0);T.mpMe=T.mpMerc=0;if(process.env.DEBUG&&lv%10===9)console.log(JSON.stringify(T.use));T.use={};
 if(lv%5===4||lv===TARGET-1)row.push(`到 Lv${String(lv+1).padStart(2)} ${PLACES[place].name.padEnd(6,'　')} 累計 ${String(T.n).padStart(4)} 場、輸 ${T.lose}、回城 ${T.trips} 次、退回 ${T.back} 次、${(T.sec/3600).toFixed(1)} 小時　身上 ${p.gold} 金　魔力補了 ${T.mpNeed?Math.round(T.mp/T.mpNeed*100):100}%`);
}
console.log(row.join('\n'));
console.log(`魔石共 ${T.crystal} 金、其他掉落賣店 ${T.drop|0} 金；裝備 ${T.gear} 金；傭兵招募 ${T.fee} 金；治傷 ${T.treat} 金；任務報酬 ${T.quest||0} 金（到了等級就當作做完）`+(T.pets?`；換過 ${T.pets} 隻寵物`:''));
