// 平衡試算：node scripts/sim.mjs —— 主角加武將在各地點自動戰鬥，看勝率、剩血、每場經驗。
import {createPlayer,addItem,equip,gainExp,allocBp,partyUnits,recruit} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,rewards} from '../www/src/core/battle.mjs';
import {PLACES} from '../www/src/data/places.mjs';
const mk=(lv,gear,party=[])=>{const p=createPlayer({name:'試',look:'x',bp:{vit:15,str:15},elem:{fire:10},seed:1}).player;
 if(lv>1){gainExp(p,lv**4);while(p.freeBp>=4){allocBp(p,'vit',2);allocBp(p,'str',2);}}
 for(const g of gear){addItem(p,g);equip(p,g);}p.job='sword';p.gold=1e5;for(const id of party){recruit(p,id);p.officers[id]=null;delete p.officers[id];p.party=p.party.filter(x=>x!==id);}
 for(const id of party){p.officers[id]=undefined;}
 return p;};
import {newOfficer} from '../www/src/core/officer.mjs';
function setup(lv,gear,party){const p=mk(lv,gear);p.party=[];for(const id of party){p.officers[id]=newOfficer(id,lv);p.party.push(id);}const us=partyUnits(p);us[0].hp=us[0].maxHp;return us;}
function group(pl,floor){const [a,b]=pl.groups,n=a+Math.floor(Math.random()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=Math.random()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(Math.random()*(hi-lo+1))];});}
function run(label,lv,gear,party,enemiesFn,N=300){let win=0,hp=0,exp=0,rounds=0;
 for(let i=0;i<N;i++){const us=setup(lv,gear,party),b=createBattle({party:us,enemies:enemiesFn(),seed:i*7919+1});
  while(!b.over&&b.round<80)resolveRound(b,[{actor:'p',kind:'attack'},{actor:'p',kind:'attack'}]);
  rounds+=b.round;if(b.over==='win'){win++;const al=b.units.filter(u=>u.side==='ally');hp+=al.reduce((n,u)=>n+u.hp,0)/al.reduce((n,u)=>n+u.maxHp,0);exp+=rewards(b,{lv}).exp;}}
 console.log(label.padEnd(22),`勝率 ${(win/N*100).toFixed(0).padStart(3)}%  剩血 ${(hp/Math.max(1,win)*100).toFixed(0)}%  回合 ${(rounds/N).toFixed(1)}  經驗 ${(exp/Math.max(1,win)).toFixed(0)}`);}
const G1=['swordC','mailL'],G2=['swordI','mailI','helmL','bootL'],G3=['swordS','mailI','helmL','bootL'];
const ALL=['dianwei','huatuo','taishici','zuoci'];
const P=PLACES,at=(pl,f)=>()=>group(pl,f),boss=pl=>()=>pl.boss.group;
run('Lv1 郊外 單人',1,['swordC'],[],at(P.suburb,1));
run('Lv2 郊外 +典韋',2,G1,['dianwei'],at(P.suburb,1));
run('Lv5 試煉1F +典韋',5,G1,['dianwei'],at(P.trial,1));
run('Lv6 試煉5F +典韋',6,G1,['dianwei'],at(P.trial,5));
run('Lv10 黃巾1F 五人',10,G2,ALL,at(P.camp,1));
run('Lv12 黃巾3F 五人',12,G2,ALL,at(P.camp,3));
run('Lv14 黃巾頭目 五人',14,G2,ALL,boss(P.camp));
run('Lv20 樹精之森 五人',20,G3,ALL,at(P.forest,2));
run('Lv22 長老樹精 五人',22,G3,ALL,boss(P.forest));
run('Lv6 試煉5F +典韋華佗',6,G1,['dianwei','huatuo'],at(P.trial,5));
run('Lv7 試煉5F +典韋華佗',7,G1,['dianwei','huatuo'],at(P.trial,5));
