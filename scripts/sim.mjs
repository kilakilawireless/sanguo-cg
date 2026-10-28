// 平衡試算：node scripts/sim.mjs —— 主角加傭兵在各地點自動戰鬥，看勝率、剩血、每場經驗。
// PET=1：帶一隻寵物（該地點最強的非頭目怪、比主角低 2 級，跟 pace.mjs 同一套假設）；帶寵物時主角每回合只行動一次
import {createPlayer,addItem,equip,gainExp,allocBp,partyUnits,recruit,addPet} from '../www/src/core/player.mjs';
import {MONSTERS} from '../www/src/data/monsters.mjs';
import {makeRng} from '../www/src/core/rng.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {PLACES} from '../www/src/data/places.mjs';
const mk=(lv,gear,party=[])=>{const p=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;
 if(lv>1){gainExp(p,lv**4);while(p.freeBp>=4){allocBp(p,'vit',2);allocBp(p,'str',2);}}
 p.job='sword';p.rank=lv>=50?2:lv>=20?1:0;for(const g of gear){addItem(p,g);if(!equip(p,g).ok)throw new Error('穿不上 '+g);}p.gold=1e5;for(const id of party){recruit(p,id);p.officers[id]=null;delete p.officers[id];p.party=p.party.filter(x=>x!==id);}
 for(const id of party){p.officers[id]=undefined;}
 return p;};
import {newOfficer} from '../www/src/core/officer.mjs';
const sumG=m=>MONSTERS[m].grade.reduce((a,b)=>a+b,0),petRng=makeRng(3);
const petOf=e=>{const pl=e.pl,list=(pl.floorMons?pl.floorMons(e.f||1):pl.mons)||pl.boss.group;return list.map(x=>x[0]).filter(m=>!MONSTERS[m].boss).sort((a,b)=>sumG(b)-sumG(a))[0];};
function setup(lv,gear,party,pet){const p=mk(lv,gear);p.party=[];for(const id of party){p.officers[id]=newOfficer(id,lv);p.party.push(id);}if(pet)addPet(p,pet,Math.max(1,lv-2),petRng);const us=partyUnits(p);us[0].hp=us[0].maxHp;return us;}
function group(pl,floor){const [a,b]=pl.groups,n=a+Math.floor(Math.random()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=Math.random()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(Math.random()*(hi-lo+1))];});}
function run(label,lv,gear,party,enemiesFn,N=300){let win=0,hp=0,exp=0,rounds=0;
 const pet=process.env.PET&&enemiesFn.pl&&petOf(enemiesFn);
 for(let i=0;i<N;i++){const us=setup(lv,gear,party,pet),b=createBattle({party:us,enemies:enemiesFn(),seed:i*7919+1});
  while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
  rounds+=b.round;if(b.over==='win'){win++;const al=b.units.filter(u=>u.side==='ally');hp+=al.reduce((n,u)=>n+u.hp,0)/al.reduce((n,u)=>n+u.maxHp,0);exp+=rewards(b,{lv}).exp;}}
 console.log(label.padEnd(22),`勝率 ${(win/N*100).toFixed(0).padStart(3)}%  剩血 ${(hp/Math.max(1,win)*100).toFixed(0)}%  回合 ${(rounds/N).toFixed(1)}  經驗 ${(exp/Math.max(1,win)).toFixed(0)}`);}
const G1=['swordC','mailL'],G2=['swordI','mailI','helmL','bootL'],G3=['swordS','mailI','helmL','bootL'];
const ALL=['dianwei','huatuo','taishici','zuoci'];
const P=PLACES,at=(pl,f)=>Object.assign(()=>group(pl,f),{pl,f}),boss=pl=>Object.assign(()=>pl.boss.group,{pl});
if(process.argv[2]!=='2'){
run('Lv1 芙蕾雅 單人',1,['swordN','mailN'],[],at(P.suburb,1));
run('Lv2 芙蕾雅 +蓋爾',2,G1,['dianwei'],at(P.suburb,1));
run('Lv5 試煉1F +蓋爾',5,G1,['dianwei'],at(P.trial,1));
run('Lv6 試煉5F +蓋爾',6,G1,['dianwei'],at(P.trial,5));
run('Lv10 盜賊巢穴1F 五人',10,G2,ALL,at(P.camp,1));
run('Lv12 盜賊巢穴3F 五人',12,G2,ALL,at(P.camp,3));
run('Lv14 盜賊頭目 五人',14,G2,ALL,boss(P.camp));
run('Lv20 樹精之森 五人',20,G3,ALL,at(P.forest,2));
run('Lv22 樹精長老 五人',22,G3,ALL,boss(P.forest));
run('Lv6 試煉5F +蓋爾羅蘭',6,G1,['dianwei','huatuo'],at(P.trial,5));
run('Lv7 試煉5F +蓋爾羅蘭',7,G1,['dianwei','huatuo'],at(P.trial,5));
}
// 第二張地圖（正職以後）：node scripts/sim.mjs 2
if(process.argv[2]==='3'){
const G4=['swordG','mailG','helmI','bootT'];const ALL2=['dianwei','huatuo','machao','caiwenji'];
run('Lv30 函4F ALL',30,G4,ALL,at(P.hangu,4));run('Lv30 函4F 典華馬左',30,G4,['dianwei','huatuo','machao','zuoci'],at(P.hangu,4));run('Lv30 函4F 典華太左',30,G4,['dianwei','huatuo','taishici','zuoci'],at(P.hangu,4),300);run('Lv32 函4F ALL2',32,G4,ALL2,at(P.hangu,4));
}
if(process.argv[2]==='2'){
const G4=['swordG','mailG','helmI','bootT'],G5=['swordP','mailP','helmP','bootP'],G6=['swordX','mailX','helmX','bootX'];const ALL2=['dianwei','huatuo','machao','caiwenji'];
run('Lv26 海底洞窟1F 五人',26,G4,ALL,at(P.hangu,1));
run('Lv30 海底洞窟4F 五人',30,G4,ALL2,at(P.hangu,4));
run('Lv33 黑騎士團長 五人',33,G4,ALL2,boss(P.hangu));
run('Lv36 古代王墓1F 五人',36,G4,ALL2,at(P.lishan,1));
run('Lv42 古代王墓5F 五人',42,G4,ALL2,at(P.lishan,5));
run('Lv44 亡靈王 五人',44,G4,ALL2,boss(P.lishan));
run('Lv47 神獸之谷 五人',47,G5,ALL2,at(P.beast,2));
run('Lv52 咆哮的神獸 五人',52,G5,ALL2,boss(P.beast));
run('Lv50 詛咒迷宮1F 五人',50,G6,ALL2,at(P.curse,1));
run('Lv54 詛咒迷宮3F 五人',54,G6,ALL2,at(P.curse,3));
run('Lv57 詛咒迷宮5F 五人',57,G6,ALL2,at(P.curse,5));
run('Lv60 詛咒迷宮6F 五人',60,G6,ALL2,at(P.curse,6));
run('Lv64 詛咒之王 五人',64,G6,ALL2,boss(P.curse));
}
