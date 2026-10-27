// 文字版擂台的地下城與打造（Leo 2026-10-26）。不碰畫面。
// ◎ 裝備改成打造：武器店、防具店只賣國民裝備；其他裝備拿材料和工錢給工房師傅做。材料打怪掉（原作是採集，這裡沒有採集職業）。
//   配方照本作 recipes.mjs 的算法（主材料 4＋2×裝備等級個、副材料 1 個；材料階級＝裝備等級），短刀比照劍用礦石。
//   材料（含寶石、水龍素材）放在不佔道具欄的材料袋 p.mats（◎，原作要存銀行）。
// 水龍系列照原作（巴哈姆特、御劍軒、17173 的資料）：7 級、數值和配方照抄（生鏽／破爛的裝備＋鋼騎之礦 2＋魔族的水晶 2＋幻之鋼條／朴／百里香）。
//   原作是海神（Lv80）掉生鏽裝備；這裡改成 31 級以上的地下城王掉（◎）。冰龍（回力鏢）、水龍之盾沒有對應的欄位，先不做；
//   抗性、耐久、「某招耗魔減少」先不做（◎）。7 級裝備要王宮職階（晉級兩次）才穿得上。
// 寶石照原作第一組（黃寶石、綠寶石、藍寶石、冒險之星、紫水晶、騎士寶石，各 10 個等級），打造時加進去改變裝備數值。
//   石榴石只加耐久，這裡沒有耐久，先不掉；冒險之星原作會扣耐久，這裡沒有這個代價（◎）。
// ◎ 地下城：15 座，每座 3 層，前兩層是魔物，第三層是王。生命魔力一路帶著走，打完一層可以撤退。
//   王是電腦操作的人物（跟擂台的對手一樣，一回合兩動），生命 ×1.5。王的名字是 Leo 給的；地下城名、王的職業等級、掉落機率是自訂。
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import {createBattle,foes} from '../core/battle.mjs';
import {makeRng} from '../core/rng.mjs';
import {ITEMS,SHOPS} from '../data/items.mjs';
import {QUEST_NAMES} from '../core/player.mjs';
import {GENERAL_BY_ID,GENERALS} from './generals.mjs';
import {rankName,JOBS} from '../data/jobs.mjs';
import {ELEMS} from '../core/stats.mjs';
import {SKILLS} from '../data/skills.mjs';
import {CG_GEAR} from './gear.mjs';

const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

// ---------- 水龍系列（原作 7C） ----------
const RUSTY=[['rustySword','生鏽的劍'],['rustyAxe','生鏽的斧'],['rustySpear','生鏽的槍'],['rustyBow','生鏽的弓'],['rustyStaff','生鏽的杖'],['rustyDagger','生鏽的短劍'],
 ['rustyShield','生鏽的盾'],['rustyHelm','生鏽的頭盔'],['rustyMail','生鏽的鎧'],['ragHat','破爛的帽子'],['ragCloth','破爛的衣服'],['ragRobe','破爛的袍'],['ragBoots','破爛的靴子'],['ragShoes','破爛的鞋子']];
const D7=(name,slot,extra,base,main,n)=>({name,kind:slot==='weapon'?'weapon':'armor',slot,lv:7,price:30000,dragon:true,...extra,recipe:[[base,1],['knightOre',2],['demonCrystal',2],[main,n]]});
export const DRAGON={
 dragonSword:D7('水龍之劍','weapon',{type:'sword',atk:210,agi:5,hit:2,dodge:2},'rustySword','phantomBar',20),
 dragonAxe:D7('水龍之斧','weapon',{type:'axe',atk:220,def:25,crit:18},'rustyAxe','phantomBar',20),
 dragonSpear:D7('水龍之槍','weapon',{type:'spear',atk:140,agi:50,crit:12,hit:6},'rustySpear','phantomBar',20),
 dragonBow:D7('水龍之弓','weapon',{type:'bow',atk:165,crit:2,hit:20,ranged:true},'rustyBow','pu',20),
 dragonStaff:D7('水龍之杖','weapon',{type:'staff',atk:70,spr:35,matk:218},'rustyStaff','pu',20),
 dragonDagger:D7('水龍的小刀','weapon',{type:'dagger',atk:130,hit:25,mpPct:{meditate:-50}},'rustyDagger','phantomBar',10),
 dragonShield:D7('水龍之盾','shield',{atk:20,def:100,dodge:-5},'rustyShield','phantomBar',10),
 dragonHelm:D7('水龍之盔','head',{armor:'heavy',def:110,mpPct:{cover:-50}},'rustyHelm','phantomBar',10),
 dragonHat:D7('水龍之帽','head',{armor:'robe',def:53,spr:20,hit:5},'ragHat','lingzhi',20),
 dragonMail:D7('水龍鎧甲','body',{armor:'heavy',def:170,rpoison:65},'rustyMail','phantomBar',20),
 dragonCloth:D7('水龍之衣','body',{armor:'light',def:30,dodge:80},'ragCloth','lingzhi',20),
 dragonRobe:D7('水龍法袍','body',{armor:'robe',def:70,mp:500,rsleep:10,rstone:10,rpoison:10,mpPct:{heal3:-30}},'ragRobe','pu',20),
 dragonBoots:D7('水龍之靴','feet',{def:100,crit:5,hit:5,mp:150},'ragBoots','phantomBar',10),
 dragonShoes:D7('水龍之鞋','feet',{def:30,agi:30,hit:2,dodge:2},'ragShoes','pu',10),
};
// ---------- 寶石（原作全部：三組一般寶石 21 種＋紅寶石，各 10 級；任務、活動、寵物寶石只有固定等級） ----------
// 原作的耐久、魅力這裡沒有：耐久只加耐久的石榴石、加魅力的石英、寵物的火之寶石改成加生命／回復（◎）；耐久的扣減不算
const GRADES=['的碎片','破損的很嚴重的','破破的','有點破損的','','還不錯的','優良的','非常優良的','接近完美的','完全結晶體的'];
const gradeName=(gem,g)=>g===1?gem+'的碎片':GRADES[g-1]+gem;
const pct=(v,n)=>Math.round((v||0)*n/100);
const RES_NAMES={rpoison:'抗毒',rsleep:'抗睡',rstone:'抗石',rconfuse:'抗亂',rdrunk:'抗醉',rforget:'抗忘'};
const all=(it,n)=>Object.fromEntries(['atk','def','agi','spr','rec'].filter(k=>it[k]>0).map(k=>[k,pct(it[k],n)]));
// 每顆寶石加在兵器上（w）、防具上（a）的效果，g＝等級；wt／at 是給人看的說明。fixed：只有這幾個等級（不能升級）
export const GEM_TYPES={
 // 第一組
 garnet:{name:'石榴石',w:(it,g)=>({hp:10+5*g}),a:(it,g)=>({hp:10+5*g}),wt:'生命＋',at:'生命＋'},
 yellow:{name:'黃寶石',w:(it,g)=>({crit:g,atk:-pct(it.atk,2*g)}),a:(it,g)=>({counter:g,def:-pct(it.def,2*g)}),wt:'必殺＋、攻擊－',at:'反擊＋、防禦－'},
 green:{name:'綠寶石',w:(it,g)=>({crit:g,counter:-g}),a:(it,g)=>({crit:-g,counter:g}),wt:'必殺＋、反擊－',at:'反擊＋、必殺－'},
 blue:{name:'藍寶石',w:(it,g)=>({atk:pct(it.atk,1+2*g)}),a:(it,g)=>({hit:-g,def:pct(it.def,1+2*g)}),wt:'攻擊＋%',at:'防禦＋%、命中－'},
 star:{name:'冒險之星',w:(it,g)=>({atk:pct(it.atk,8+2*g)}),a:(it,g)=>({def:pct(it.def,8+2*g)}),wt:'攻擊＋%',at:'防禦＋%'},
 amethyst:{name:'紫水晶',w:(it,g)=>({def:8*g,atk:pct(it.atk,g)}),a:(it,g)=>({atk:4*g,def:pct(it.def,g)}),wt:'防禦＋、攻擊＋%',at:'攻擊＋、防禦＋%'},
 knight:{name:'騎士寶石',w:(it,g)=>({hit:g,atk:-pct(it.atk,2*g)}),a:(it,g)=>({dodge:g,def:-pct(it.def,2*g)}),wt:'命中＋、攻擊－',at:'閃躲＋、防禦－'},
 // 第二組
 tektite:{name:'玻隕石',w:(it,g)=>({rsleep:4*g,rconfuse:-4*g}),a:(it,g)=>({rforget:2*g,rdrunk:-2*g}),wt:'抗睡＋、抗亂－',at:'抗忘＋、抗醉－'},
 tin:{name:'錫石',w:(it,g)=>({rstone:4*g,rsleep:-4*g}),a:(it,g)=>({rdrunk:2*g,rpoison:-2*g}),wt:'抗石＋、抗睡－',at:'抗醉＋、抗毒－'},
 jet:{name:'黑玉',w:(it,g)=>({rconfuse:4*g,rstone:-4*g}),a:(it,g)=>({rpoison:2*g,rforget:-2*g}),wt:'抗亂＋、抗石－',at:'抗毒＋、抗忘－'},
 iolite:{name:'菫青石',w:(it,g)=>({dodge:g,hit:-g}),a:(it,g)=>({hit:g,dodge:-g}),wt:'閃躲＋、命中－',at:'命中＋、閃躲－'},
 deepblue:{name:'深藍寶石',w:(it,g)=>({atk:2+3*g,agi:-3*g}),a:(it,g)=>({def:g,agi:-g}),wt:'攻擊＋、敏捷－',at:'防禦＋、敏捷－'},
 spinel:{name:'尖晶石',w:(it,g)=>({agi:3*g}),a:(it,g)=>({agi:g}),wt:'敏捷＋',at:'敏捷＋'},
 zircon:{name:'賽黃晶',w:(it,g)=>({dodge:g,atk:-3*g}),a:(it,g)=>({dodge:g,hit:-g}),wt:'閃躲＋、攻擊－',at:'閃躲＋、命中－'},
 // 第三組
 citrine:{name:'黃水晶',w:(it,g)=>({spr:2+2*g,agi:-3*g}),a:(it,g)=>({spr:2+g,def:-pct(it.def,g)}),wt:'精神＋、敏捷－',at:'精神＋、防禦－'},
 andalusite:{name:'錳紅柱石',w:(it,g)=>({counter:g,atk:-pct(it.atk,g)}),a:(it,g)=>({crit:g,agi:-4*g}),wt:'反擊＋、攻擊－',at:'必殺＋、敏捷－'},
 peridot:{name:'橄欖石',w:(it,g)=>({counter:g,crit:-g}),a:(it,g)=>({crit:g,hit:-g}),wt:'反擊＋、必殺－',at:'必殺＋、命中－'},
 quartz:{name:'石英',w:(it,g)=>({rec:2*g}),a:(it,g)=>({rec:2*g}),wt:'回復＋',at:'回復＋'},
 pearl:{name:'珍珠',w:(it,g)=>({hp:20+10*g}),a:(it,g)=>({hp:10+5*g}),wt:'生命＋',at:'生命＋'},
 opal:{name:'蛋白石',w:(it,g)=>({mp:20+10*g}),a:(it,g)=>({mp:25+5*g}),wt:'魔力＋',at:'魔力＋'},
 catseye:{name:'貓眼石',w:(it,g)=>({mp:30*g}),a:(it,g)=>({mp:30*g}),wt:'魔力＋＋',at:'魔力＋＋'},
 // 任務寶石：紅寶石也有 10 級
 ruby:{name:'紅寶石',w:(it,g)=>({rec:g}),a:(it,g)=>({rec:g}),wt:'回復＋',at:'回復＋'},
 // 任務、活動寶石：固定等級
 desertStar:{name:'砂漠紅星',fixed:[4],w:()=>({crit:2,counter:2}),a:()=>({hit:1,dodge:1}),wt:'必殺＋、反擊＋',at:'命中＋、閃躲＋'},
 meteor:{name:'流星',fixed:[5],w:it=>({crit:3,atk:-pct(it.atk,5)}),a:it=>({dodge:3,def:-pct(it.def,5)}),wt:'必殺＋、攻擊－',at:'閃躲＋、防禦－'},
 iceCrystal:{name:'冰原之晶',fixed:[4],w:()=>({rec:6}),a:()=>({spr:3}),wt:'回復＋',at:'精神＋'},
 holyStone:{name:'聖魔石',fixed:[5],w:()=>({hp:15,mp:15}),a:()=>({hp:10,mp:10,agi:2,hit:2}),wt:'生命、魔力＋',at:'生命、魔力、敏捷、命中＋'},
 partO:{name:'O零件',fixed:[1],w:it=>({...all(it,20),crit:10}),a:it=>all(it,20),wt:'全能力＋20%、必殺＋',at:'全能力＋20%'},
 partQ:{name:'Q零件',fixed:[10],w:it=>({...all(it,60),crit:3,hit:3}),a:it=>({...all(it,60),crit:3,hit:3}),wt:'全能力＋60%',at:'全能力＋60%'},
 mouse:{name:'鼠王寶石',fixed:[1,2,3],names:['鼠王寶石的碎片','破損的很嚴重的鼠王寶石','破破的鼠王寶石'],w:(it,g)=>{const n=25+5*g;return {atk:n,def:n,agi:n,spr:n,hit:n,crit:n,counter:n};},a:(it,g)=>{const n=25+5*g;return {atk:n,def:n,agi:n,spr:n,hit:n,crit:n,counter:n};},wt:'全能力大幅＋',at:'全能力大幅＋'},
 pure:{name:'淨界寶石',fixed:[1],w:()=>({rpoison:5,rstone:5}),a:()=>({rpoison:5,rstone:5}),wt:'抗毒、抗石＋',at:'抗毒、抗石＋'},
 tungsten:{name:'鎢鋼寶石',fixed:[8],w:it=>({atk:pct(it.atk,30)}),a:it=>({def:pct(it.def,30)}),wt:'攻擊＋30%',at:'防禦＋30%'},
 dragonGem:{name:'完美的水龍寶石',fixed:[9],w:()=>({atk:150,agi:35}),a:()=>({def:100,agi:5}),wt:'攻擊、敏捷大幅＋',at:'防禦大幅＋、敏捷＋'},
 // 寵物寶石：小（1）、中型（3）、大型（6）
 ...Object.fromEntries([['earth','土'],['water','水'],['fire','火'],['wind','風']].map(([e,el])=>{const n=g=>g===1?1:g===3?2:3;return ['pet_'+e,{name:`${el}之寶石`,fixed:[1,3,6],
  names:['小顆的','中型的','大型的'].map(x=>`${x}${el}之寶石`),
  w:{earth:(it,g)=>({atk:pct(it.atk,2*(n(g)-1))}),water:(it,g)=>({atk:pct(it.atk,4*(n(g)-1))}),fire:(it,g)=>({hp:10*2**(n(g)-1)}),wind:(it,g)=>n(g)>1?{crit:n(g)-1,atk:-pct(it.atk,2*(n(g)-1))}:{}}[e],
  a:{earth:(it,g)=>({def:pct(it.def,[3,6,10][n(g)-1]),hit:-n(g)}),water:(it,g)=>({def:pct(it.def,[2,4,8][n(g)-1])}),fire:(it,g)=>({hp:10*2**(n(g)-1)}),wind:(it,g)=>n(g)>1?{counter:n(g)-1,def:-pct(it.def,2*(n(g)-1))}:{}}[e],
  wt:{earth:'攻擊＋%',water:'攻擊＋%',fire:'生命＋',wind:'必殺＋、攻擊－'}[e],at:{earth:'防禦＋%、命中－',water:'防禦＋%',fire:'生命＋',wind:'反擊＋、防禦－'}[e]}];})),
};
const gradesOf=t=>GEM_TYPES[t].fixed||[1,2,3,4,5,6,7,8,9,10];
export const GRADED_GEMS=Object.keys(GEM_TYPES).filter(t=>!GEM_TYPES[t].fixed);
// 寶石只加不扣（Leo 2026-10-27）：原作會扣的那一項拿掉，說明文字也拿掉「－」的部分
for(const t of Object.keys(GEM_TYPES)){const ty=GEM_TYPES[t];for(const s of ['w','a']){const f=ty[s];ty[s]=(it,g)=>Object.fromEntries(Object.entries(f(it,g)).filter(([,v])=>v>=0));}
 for(const k of ['wt','at'])ty[k]=ty[k].split('、').filter(x=>!x.includes('－')).join('、');}
// 分 10 級的寶石：加的必殺、反擊 ×1.5、命中 ×1.35，無條件捨去（Leo 2026-10-26，◎；+1→+1、+2→+3）；扣的不變
const GEM_BOOST={crit:1.5,counter:1.5,hit:1.35};
for(const t of GRADED_GEMS)for(const s of ['w','a']){const f=GEM_TYPES[t][s];
 GEM_TYPES[t][s]=(it,g)=>Object.fromEntries(Object.entries(f(it,g)).map(([k,v])=>[k,v>0&&GEM_BOOST[k]?Math.floor(v*GEM_BOOST[k]):v]));}
export const gemId=(t,g)=>`gem_${t}_${g}`;
export const parseGem=id=>{const m=/^gem_([A-Za-z_]+)_(\d+)$/.exec(id||'');return m&&GEM_TYPES[m[1]]&&gradesOf(m[1]).includes(+m[2])?{t:m[1],g:+m[2]}:null;};
const gemName=(t,g)=>{const ty=GEM_TYPES[t];return ty.names?ty.names[ty.fixed.indexOf(g)]:ty.fixed?ty.name:gradeName(ty.name,g);};
export const GEM_RES=RES_NAMES;
export const MUD_ITEMS={
 ...CG_GEAR,
 ...Object.fromEntries(RUSTY.map(([id,name])=>[id,{name,kind:'material',tier:7,sell:300,desc:'帶著海神魔力的舊裝備，打造水龍系列的底子。31 級以上的地下城王身上找得到。'}])),
 knightOre:{name:'鋼騎之礦',kind:'material',tier:7,sell:200,desc:'打造水龍系列要用。地下城的王身上找得到。'},
 demonCrystal:{name:'魔族的水晶',kind:'material',tier:7,sell:200,desc:'打造水龍系列要用。地下城的王身上找得到。'},
 phantomBar:{name:'幻之鋼條',kind:'material',tier:7,sell:60,desc:'打造水龍系列兵器、鎧甲的主材料。30 級以上的魔物會掉。'},
 pu:{name:'朴',kind:'material',tier:7,sell:50,desc:'打造水龍系列弓、杖、法袍、鞋的主材料。30 級以上的魔物會掉。'},
 ...Object.fromEntries(Object.keys(GEM_TYPES).flatMap(t=>gradesOf(t).map(g=>[gemId(t,g),{name:gemName(t,g),kind:'material',gem:t,grade:g,tier:7,sell:40*g**2*(GEM_TYPES[t].fixed?3:1),
  desc:`打造時加進去：兵器${GEM_TYPES[t].wt}，防具${GEM_TYPES[t].at}。等級 ${g}${GEM_TYPES[t].fixed?'':'／10'}。`}]))),
 ...Object.fromEntries(Object.entries(DRAGON).map(([id,it])=>[id,(({recipe,...x})=>x)(it)])),
};
for(const [id,it] of Object.entries(MUD_ITEMS))ITEMS[id]??=it;
// 商店的藥是醫院的 3 倍價（Leo 2026-10-27）：生命 1.5 金／點、魔力 3 金／點；補魔藥戰鬥中也能喝
export const POTION_RATE={hp:1.5,mp:3};
Object.assign(ITEMS,{mpot:{name:'魔力藥',kind:'use',mp:100,battle:true,desc:'回復 100 魔力。'},mpot2:{name:'高級魔力藥',kind:'use',mp:300,battle:true,desc:'回復 300 魔力。'}});
for(const id of ['potion','potion2','potion3','potion4','bun','roast','meatBun','hotpot','feast','mpot','mpot2']){const it=ITEMS[id];ITEMS[id]={...it,price:Math.round((it.hp||0)*POTION_RATE.hp+(it.mp||0)*POTION_RATE.mp),desc:it.desc.replace('藥劑師才做得出來。','')};}
SHOPS.goods={...SHOPS.goods,stock:['potion','potion2','potion3','mpot','mpot2']};
// 重裝近戰（劍士、戰斧鬥士、騎士、士兵）才能穿的鎧甲、頭盔，防禦 ×1.35（Leo 2026-10-26，◎）；打造擲的範圍照舊，擲完再乘
export const HEAVY_DEF=1.35;
export const heavyMult=(it,k)=>k==='def'&&it?.armor==='heavy'?HEAVY_DEF:1;
for(const it of Object.values(ITEMS))if(it.armor==='heavy'&&it.def>0)it.def=Math.round(it.def*HEAVY_DEF);
// 加了寶石的裝備：代號是「裝備@寶石」，讀檔、看別人的裝備、交易所遇到時才建出來
export function ensureItem(id){
 if(!id||ITEMS[id])return !!ITEMS[id];
 // 打造擲出來的數值：「基底~值.值」（照 it.rng 的順序），超出範圍的當壞掉
 if(!String(id).includes('@')&&String(id).includes('~')){const [b0,roll]=String(id).split('~'),it=ITEMS[b0],ks=Object.keys(it?.rng||{}),vs=String(roll).split('.').map(Number);
  if(!ks.length||vs.length>ks.length)return false;
  // 後來才加的數值（像抗魔）：舊存檔擲的沒有，取中間
  while(vs.length<ks.length)vs.push(Math.round((it.rng[ks[vs.length]][0]+it.rng[ks[vs.length]][1])/2));
  if(vs.some((v,i)=>!Number.isInteger(v)||v<it.rng[ks[i]][0]||v>it.rng[ks[i]][1]))return false;
  const out={...it,rolled:true,quality:ks.reduce((q,k,i)=>q+(vs[i]-it.rng[k][0])/(it.rng[k][1]-it.rng[k][0]),0)/ks.length};ks.forEach((k,i)=>{out[k]=Math.round(vs[i]*heavyMult(it,k));});ITEMS[id]=out;return true;}
 const [base,gem]=String(id).split('@');ensureItem(base);const it=ITEMS[base],gm=parseGem(gem);if(!it?.slot||!gm||String(base).includes('@'))return false;
 const ty=GEM_TYPES[gm.t],mod=(it.slot==='weapon'?ty.w:ty.a)(it,gm.g),out={...it,name:`${it.name}（${ty.fixed?gemName(gm.t,gm.g):ty.name+gm.g}）`,gemmed:gem,price:it.price};
 for(const [k,v] of Object.entries(mod))out[k]=(out[k]||0)+v;
 ITEMS[id]=out;return true;
}
// 寶石鑲在兵器（slot='weapon'）或防具上的效果，給人看的一行字：照裝備數值算百分比的寫「%」
const GEM_STAT={atk:'攻擊',def:'防禦',agi:'敏捷',spr:'精神',matk:'魔攻',rec:'回復',hp:'生命',mp:'魔力',crit:'必殺',counter:'反擊',hit:'命中',dodge:'閃躲',...RES_NAMES};
export function gemEffect(gem,slot){
 const gm=parseGem(gem);if(!gm)return '';const f=GEM_TYPES[gm.t][slot==='weapon'?'w':'a'];
 const a=f({atk:100,def:100,agi:100,spr:100,rec:100},gm.g),b=f({atk:200,def:200,agi:200,spr:200,rec:200},gm.g);
 return Object.entries(a).filter(([,v])=>v).map(([k,v])=>`${GEM_STAT[k]||k}${v>0?'+':''}${v}${b[k]===2*v&&v!==0?'%':''}`).join('、')||'沒有效果';
}
export const withGem=(id,gem)=>{const v=`${id}@${gem}`;ensureItem(v);return v;};

// ---------- 材料袋（不佔道具欄） ----------
export const isMat=id=>ITEMS[id]?.kind==='material';
export const matCount=(p,id)=>(p.mats?.[id]||0)+P.countItem(p,id);
export function addMat(p,id,n=1){p.mats||={};p.mats[id]=(p.mats[id]||0)+n;}
export function takeMat(p,id,n){let left=n;const inBag=Math.min(left,P.countItem(p,id));if(inBag){P.removeItem(p,id,inBag);left-=inBag;}
 if(left){p.mats[id]-=left;if(p.mats[id]<=0)delete p.mats[id];}}
// 舊存檔道具欄裡的材料搬進材料袋
export function moveMats(p){p.mats||={};for(const x of [...p.bag])if(isMat(x.id)){addMat(p,x.id,x.n);P.removeItem(p,x.id,x.n);}}

// ---------- 材料與配方 ----------
const METAL=[,'copper','ironOre','silver','goldOre'],WOOD=[,'pine','oak','cypress','ebony'],LEATHER=[,'hide','hide','marten','tigerSkin'];
export const tierOf=lv=>lv<8?1:lv<18?2:lv<30?3:4; // ◎ 魔物等級 → 掉的材料階級
function mats(it){
 const L=Math.min(it.lv,4),n=4+2*it.lv;
 // ◎ 5 級以上沒有更高級的一般材料：4 階材料用更多，7 級以上再加幻之鋼條（金屬類）或朴（木、皮類）
 const out=mats4(it,L,n),rare=it.lv>=7?(out[0][0]===METAL[L]?'phantomBar':'pu'):null;
 return rare?[...out,[rare,it.lv-4]]:out;
}
function mats4(it,L,n){
 if(it.slot==='weapon'){
  if(it.type==='bow')return [[WOOD[L],n],[LEATHER[L],1]];
  if(it.type==='staff')return [[WOOD[L],n],[METAL[L],1]];
  return [[METAL[L],n],[WOOD[L],1]];
 }
 if(it.slot==='shield')return [[METAL[L],n-2],[WOOD[L],2]]; // ◎
 if(it.cg==='shoes')return [[LEATHER[L],Math.max(2,n-3)],[WOOD[L],1]];
 if(it.armor==='heavy')return [[METAL[L],n],[LEATHER[L],1]];
 if(it.slot==='feet'||it.slot==='head')return [[LEATHER[L],Math.max(2,n-3)]];
 return it.armor==='robe'?[[LEATHER[L],n-1],[WOOD[L],1]]:[[LEATHER[L],n]];
}
// 一般裝備 4 級以下（沒有 5 級以上的配方）；水龍系列照原作配方
// ◎ 讓錢有用（Leo 2026-10-26）：工錢＝商店行情 × 裝備等級 ÷ 10（1 級主裝備 150、4 級 6000、8 級 40000），水龍系列 60000
export const forgeFee=it=>it.dragon?60000:Math.round(it.price*it.lv/10);
// 寶石合成工錢：等級² × 100（1 級 100、5 級 2500、10 級 10000）
export const fuseFee=g=>100*g*g;
// 工房做得出來的：原作裝備（gear.mjs，1～11 級）和水龍系列
export const RECIPES=Object.fromEntries(Object.entries(ITEMS).filter(([id,it])=>CG_GEAR[id]||DRAGON[id])
 .map(([id,it])=>[id,{mats:DRAGON[id]?DRAGON[id].recipe:mats(it),fee:forgeFee(it)}]));
export const recipeKind=id=>ITEMS[id].dragon?'dragon':ITEMS[id].slot==='weapon'?'weapon':'armor';
export const gemsIn=p=>Object.keys(p.mats||{}).filter(id=>parseGem(id)&&p.mats[id]>0);
export function canForge(p,id,gem){
 const r=RECIPES[id];if(!r)return no('');
 const lack=r.mats.filter(([m,n])=>matCount(p,m)<n).map(([m,n])=>`${ITEMS[m].name}還差 ${n-matCount(p,m)}`);
 if(lack.length)return no(lack.join('、')+'。');
 if(gem&&!(parseGem(gem)&&matCount(p,gem)>0))return no('沒有這顆寶石。');
 if(p.gold<r.fee)return no(`工錢要 ${r.fee} 金。`);
 if(p.bag.length>=P.BAG_SIZE)return no('道具欄滿了，先空出一格。');
 return yes('');
}
// 打造的數值在範圍內擲（Leo 2026-10-26）；回傳新的道具代號
export function rollGear(id,rand=Math.random){const it=ITEMS[id],ks=Object.keys(it?.rng||{});if(!ks.length)return id;
 const v=`${id}~${ks.map(k=>{const [a,b]=it.rng[k];return a+Math.floor(rand()*(b-a+1));}).join('.')}`;ensureItem(v);return v;}
// 擲得好不好：各項在範圍內的位置平均（數值大的比較好，負的也是越接近 0 越好）
export function rollQuality(id){const it=ITEMS[id];return it?.rolled?it.quality??null:null;}
export const rollNote=id=>{const q=rollQuality(id);return q==null?'固定數值':q>=.9?'極品':q>=.6?'上等':q>=.3?'普通':'差強人意';};
export function forge(p,id,gem,rand=Math.random){
 const c=canForge(p,id,gem);if(!c.ok)return c;const r=RECIPES[id];
 for(const [m,n] of r.mats)takeMat(p,m,n);if(gem)takeMat(p,gem,1);p.gold-=r.fee;
 const rolled=rollGear(id,rand),out=gem?withGem(rolled,gem):rolled;P.addItem(p,out);
 return yes(`工房師傅替你打好了${ITEMS[out].name}（${rollNote(rolled)}）。`,{out});
}

// ---------- 寶石合成（Leo 2026-10-26，在工房） ----------
// 三顆同等級的寶石 → 一顆隨機的同等級一般寶石；三顆同一種同等級 → 升一級（10 級、固定等級的寶石不能升）
export function fusePreview(ids){
 if(ids.length!==3)return null;const g=ids.map(parseGem);if(g.some(x=>!x)||g.some(x=>x.g!==g[0].g))return null;
 const same=ids.every(id=>id===ids[0])&&!GEM_TYPES[g[0].t].fixed&&g[0].g<10;
 return same?{up:true,out:gemId(g[0].t,g[0].g+1)}:{up:false,grade:g[0].g};
}
export function fuseGems(p,ids,rand=Math.random){
 const pv=fusePreview(ids);if(!pv)return no('要三顆同等級的寶石。');
 const need={};for(const id of ids)need[id]=(need[id]||0)+1;
 for(const [id,n] of Object.entries(need))if(matCount(p,id)<n)return no(`${ITEMS[id].name}不夠。`);
 const fee=fuseFee(parseGem(ids[0]).g);if(p.gold<fee)return no(`工錢要 ${fee} 金。`);p.gold-=fee;
 for(const [id,n] of Object.entries(need))takeMat(p,id,n);
 const out=pv.up?pv.out:gemId(GRADED_GEMS[Math.floor(rand()*GRADED_GEMS.length)],pv.grade);
 p.mats[out]=(p.mats[out]||0)+1;
 return yes(pv.up?`三顆合成一顆${ITEMS[out].name}！`:`合成出${ITEMS[out].name}。`,{out});
}

// ---------- 打怪掉材料 ----------
// ◎ 每隻魔物 50% 掉一個材料（礦石、木材、毛皮各三分之一），階級看魔物等級；30 級以上的魔物另外 25% 掉幻之鋼條、朴或百里香
export const MAT_MULT=1.45;
export function materialDrops(b){
 const rng=makeRng((b.rngState^0x2545f491)>>>0),out=[];
 for(const e of foes(b)){if(e.kind!=='monster')continue;
  // 木材、毛皮各 1/6；礦石 1/6 再 ×1.4（Leo 2026-10-27：礦太難打）；全部再 ×MAT_MULT（Leo 2026-10-27：再加 45%）
  const r=rng.next(),t=tierOf(e.lv),w=MAT_MULT/6;if(r<w)out.push(WOOD[t]);else if(r<2*w)out.push(LEATHER[t]);else if(r<2*w+1.4*w)out.push(METAL[t]);
  if(e.lv>=30&&rng.chance(25*MAT_MULT))out.push(['phantomBar','pu','lingzhi'][rng.int(0,2)]);}
 return out;
}

// ---------- 地下城 ----------
// [代號, 王的名字, 職業, 武將立繪, 屬性, 第二個王（有的話）]；順序＝難度（Leo 2026-10-26 排的），等級從 4 起每座 +3
// 代號固定不跟著順序變（存檔的通關次數、打到一半的進度都記代號）
const BOSSES=[
 ['d1','楓楓洋洋','sword','xiaoqiao',{wind:10}],['d13','笑死人','sword','sunce',{fire:10}],['d3','火龍','mage','zhurong',{fire:10}],
 ['d4','左青龍又胖虎','axe','zhangfei',{earth:5,water:5}],['d5','君子','spear','jiangwei',{wind:10}],['d6','Damonk','fighter','taishici',{fire:5,wind:5}],
 ['d7','Soduk','guard','caoren',{earth:10}],['d8','淡然','wizard','luxun',{water:10}],['d16','小吃','fighter','diaochan',{wind:10}],
 ['d10','宰羊拿鐵的QQ','assassin','zhenji',{water:5,fire:5}],['d11','顧家','priest','guojia',{wind:5,earth:5}],['d17','鮭魚','bow','huangzhong',{water:10}],
 ['d12','阿宏','axe','xuhuang',{earth:10}],['d2','祖師爺','priest','huangyueying',{earth:10}],['d9','CUTIE','bow','sunshangxiang',{fire:10}],
 ['d15','我來解任務的','spear','machao',{wind:10}],['d14','陳小白','mage','daqiao',{water:10},['KLY','guard','dianwei',{earth:10}]],['d18','學測','priest','xunyu',{earth:5,water:5}],
 ['d19','睿爸','spear','guanyu',{fire:5,wind:5}],
 // 61～79 級（Leo 2026-10-26：做到 80 級）；d20～d24 的王用 Leo 2026-10-27 給的名字，d25、d26 暫用立繪武將的名字
 ['d20','YPP','spear','zhangliao',{wind:10}],['d21','Kingneptoon','assassin','lvmeng',{water:10}],['d22','必問','axe','xiahoudun',{earth:10}],
 ['d23','黑白郎君','sword','ganning',{water:5,fire:5}],['d24','不想上班','mage','huanggai',{fire:10}],['d25','魏延','guard','weiyan',{earth:5,wind:5}],['d26','張郃','bow','zhanghe',{wind:5,fire:5}],
];
// 每個王自己的一套技能（◎ 照職業和個性配；Leo 2026-10-26：王都要有職業跟自己的技能）。第二個王用「代號b」
const BOSS_KITS={
 d1:['combo','allin'],d13:['swift','combo','counter'],d3:['fire1','fire2','heal'],d4:['blade','allin','terror'],
 d5:['twobird','combo','counter'],d6:['qigong','smash','meditate','counter'],d7:['wall','kill','terror'],d8:['drain','regen','pReflect','water2'],
 d16:['chaos','focus','swift','meditate'],d10:['venom','kill','haze','steal'],d11:['poison2','sleep1','heal','wind2','wind1'],d17:['volley','sure','terror'],
 d12:['blade','smash','allin','counter'],d2:['stone3','poison3','heal2','earth3','earth2'],d9:['volley','sure','venom','haze'],d15:['twobird','combo','blade','mguard'],
 d14:['water3','water2','heal','mguard'],d14b:['cover','wall','kill'],d18:['forget3','confuse2','poison3','water3','water2'],d19:['swift','allin','blade','counter','terror'],
 d20:['swift','twobird','combo','blade','counter'],d21:['kill','venom','haze','steal','swift'],d22:['counter','blade','allin','terror','meditate'],d23:['allin','combo','blade','swift','twobird'],
 d24:['fire3','fire2','fire1','heal','mguard'],d25:['wall','kill','terror','counter','meditate'],d26:['volley','sure','terror','venom','haze'],
};
// 王的打法（Leo 2026-10-26：敵人要多元）◎：配點比例（體力、力量、強度、速度、魔法）＋武器、防具各鑲一種寶石（等級＝1＋王等級/6）；55 級以上的王穿水龍裝，非術士的生命只 ×1
const STYLES={
 power:{name:'猛攻型',bp:[.3,.55,.05,.1,0],w:'star',a:'amethyst'},
 dodge:{name:'閃避型',bp:[.25,.35,0,.4,0],w:'iolite',a:'knight'},
 crit:{name:'必殺型',bp:[.3,.5,.05,.15,0],w:'green',a:'peridot'},
 counter:{name:'反擊血牛',bp:[.5,.2,.25,.05,0],w:'andalusite',a:'green'},
 wall:{name:'鐵壁型',bp:[.55,.1,.3,.05,0],w:'pearl',a:'pearl'},
 speed:{name:'疾風型',bp:[.25,.35,.05,.35,0],w:'spinel',a:'spinel'},
 caster:{name:'術士',bp:[.35,0,.05,.1,.5],w:'citrine',a:'catseye'},
};
const BOSS_STYLE={d1:'power',d13:'dodge',d3:'caster',d4:'crit',d5:'counter',d6:'counter',d7:'wall',d8:'caster',d16:'speed',d10:'dodge',d20:'speed',d21:'dodge',d22:'counter',d23:'power',d24:'caster',d25:'wall',d26:'crit',
 d11:'caster',d17:'crit',d12:'counter',d2:'caster',d9:'speed',d15:'power',d14:'caster',d14b:'counter',d18:'caster',d19:'dodge'};
const isDragon=d=>d.lv>=55; // 55 級以上的王穿水龍裝
export const bossStyle=(d,second=false)=>STYLES[BOSS_STYLE[d.id+(second?'b':'')]]||STYLES.power;
// 照打法換裝：水龍裝（同一類武器、同一種防具）、鑲寶石
function dressBoss(f,d,st){
 const g=Math.min(10,1+Math.floor(d.lv/6));
 for(const [slot,id] of Object.entries(f.equip)){if(!id)continue;const it=ITEMS[id];let base=id;
  if(isDragon(d)){const dr=Object.keys(ITEMS).find(k=>{const x=ITEMS[k];return x.dragon&&x.slot===slot&&(slot==='weapon'?x.type===it.type:(x.armor||null)===(it.armor||null));});if(dr)base=dr;}
  f.equip[slot]=withGem(base,gemId(slot==='weapon'?st.w:st.a,g));}
}
export const bossRank=lv=>lv>=70?3:lv>=50?2:lv>=20?1:0; // 照晉級的等級
// 地下城的魔物：照等級挑（只用畫面上有動作圖的）
const MON_BANDS=[[10,['bat','wolf','bee','rat']],[20,['rat','bronze','thief','lancer','brute']],[30,['sapling','redWolf','thief','lancer','brute','tiger']],[60,['tiger','lynx','zombie','gargoyle','redWolf']],[99,['wraith','deathKnight','gargoyle','zombie','goldMan']]];
export const FLOORS=3;
export const BOSS_HP=1.5,PAIR_HP=1,CASTER_HP=2.5; // 魔術師、傳教士的王生命少，另外加厚（◎）
// ◎ 王的生命倍數（試算：跟王同等級、穿同級打造裝，一個人打物理系約一到九成，看王的職業；帶夥伴約五成以上）
export const DUNGEONS=BOSSES.map(([id,boss1,job,look,elem,pair],i)=>{const lv=4+3*i,boss=pair?`${boss1}與${pair[0]}`:boss1;return {id,n:i+1,name:boss.endsWith('的')?`${boss}地下城`:`${boss}的地下城`,boss,boss1,lv,job,look,elem,pair,
 mons:MON_BANDS.find(([max])=>lv<max)[1],monLv:[Math.max(1,lv-4),Math.max(1,lv-1)],needLv:Math.max(1,lv-3)};});
export const DUNGEON_BY_ID=Object.fromEntries(DUNGEONS.map(d=>[d.id,d]));
export const dungeonOpen=(p,d)=>p.lv>=d.needLv?yes(''):no(`要 ${d.needLv} 級。`);
export const cleared=(p,d)=>p.flags?.dg?.[d.id]||0;

// 進地下城：從第 1 層開始；p.dg 記著走到哪（關掉網頁再回來可以接著打）
export function enterDungeon(p,id){const d=DUNGEON_BY_ID[id];if(!d)return no('');const o=dungeonOpen(p,d);if(!o.ok)return o;p.dg={id,floor:1};return yes(`走進${d.name}。`);}
export function leaveDungeon(p){p.dg=null;}
export function bossFighter(d,second=false){const [name,job,look,elem]=second?d.pair:[d.boss1,d.job,d.look,d.elem];const st=bossStyle(d,second),f=R.buildFighter(d.lv,job,look,name,elem,1000+d.n+(second?500:0),BOSS_KITS[d.id+(second?'b':'')],bossRank(d.lv),st.bp);f.name=name;dressBoss(f,d,st);return f;}
// ---------- 敵對冒險隊 ◎（Leo 2026-10-27：敵人也要有職業、裝備、技能、搭配） ----------
// 練功、地下城（王以外的樓層）10 級起有機會遇到一隊冒險者：前排擋、後排射與放魔法、有人補血；
// 照等級配點、就職晉級、學本行技能、穿「1＋等級÷9」級的打造裝（上限照各職業的裝備表），20 級起兵器防具鑲對應打法的寶石
const TEAM_NAMES=['黑騎士團','盜賊團','傭兵團','赤狼眾','亡命徒','流浪劍客','海盜','鐵甲軍'];
const COMPS={2:[['sword','priest'],['axe','mage'],['spear','bow'],['fighter','priest'],['assassin','mage'],['guard','bow']],
 3:[['guard','bow','priest'],['sword','mage','priest'],['axe','axe','priest'],['spear','bow','mage'],['assassin','assassin','priest'],['fighter','mage','mage']],
 4:[['guard','sword','mage','priest'],['spear','axe','bow','priest'],['sword','sword','mage','mage'],['fighter','bow','bow','priest'],['guard','assassin','wizard','priest']],
 5:[['guard','sword','bow','mage','priest'],['spear','spear','axe','mage','priest'],['guard','assassin','bow','wizard','priest'],['sword','fighter','bow','mage','priest']]};
const FILL=['sword','bow','axe','spear','mage'];
const RIVAL_STYLE={mage:'caster',wizard:'caster',priest:'caster',guard:'wall',assassin:'dodge',fighter:'speed'};
// ◎ 冒險者的等級＝遇到的魔物等級 × K：20 級前 0.75、之後慢慢升到 60 級的 1.0（試算：同等級的一隊 20 級前只贏兩成，60 級五人隊穩贏）；
//   人數不超過自己這邊＋1；裝備 1＋等級÷12 級、30 級起鑲等級÷15 的寶石
export const rivalK=lv=>.75+Math.min(.25,Math.max(0,lv-20)/160);
export const rivalLv=lv=>Math.max(1,Math.round(lv*rivalK(lv)));
export const rivalGearLv=lv=>Math.min(10,1+Math.floor(lv/12));
export const rivalGem=lv=>lv<30?0:Math.max(1,Math.min(10,Math.floor(lv/15)));
export function rivalParty(lvs,rng){
 const n=lvs.length,team=TEAM_NAMES[rng.int(0,TEAM_NAMES.length-1)],pool=COMPS[Math.min(5,Math.max(2,n))],comp=[...pool[rng.int(0,pool.length-1)]];
 while(comp.length<n)comp.push(FILL[rng.int(0,FILL.length-1)]);
 return comp.slice(0,n).map((job,i)=>{const lv=rivalLv(lvs[i]),st=STYLES[RIVAL_STYLE[job]||['power','crit','counter','dodge'][rng.int(0,3)]];
  // 法師系的招照等級段：魔術師一個屬性兩階、傳教士補血＋一種咒術、巫師吸魔＋恢復＋屏障（其他職業照本行前三招）
  const t=lv<30?1:lv<60?2:3,e=ELEMS[rng.int(0,3)],c=['sleep','poison','confuse'][rng.int(0,2)];
  const kit={mage:[`${e}${t}`,`${e}${Math.max(1,t-1)}`,`${e}1`].filter((x,j,a)=>a.indexOf(x)===j),priest:t===1?['heal2',`${c}1`]:['heal3','heal2',`${c}${t}`],wizard:t===1?['drain','regen']:t===2?['drain','regen2','pAbsorb']:['drain','regen3','pReflect']}[job]||null;
  const f=R.buildFighter(lv,job,GENERALS[rng.int(0,GENERALS.length-1)].id,`${team}${JOBS[job].name}`,{[e]:10},rng.int(1,2**30),kit,bossRank(lv),st.bp,rivalGearLv(lv));
  const g=rivalGem(lv);if(g){for(const [slot,id] of Object.entries(f.equip))if(id&&(slot==='weapon'||slot==='body'))f.equip[slot]=withGem(id,gemId(slot==='weapon'?st.w:st.a,g));}
  f.team=team;return f;});
}
export const startHunt=(p,spot,seed)=>R.startHunt(p,spot,seed,rivalParty);
// 打倒冒險者掉錢（◎ 每人等級×3～6 金）、兩成掉藥、RIVAL_GEM_PCT% 掉一顆寶石（等級約冒險者等級÷8，上下差 1；Leo 2026-10-27）
export const RIVAL_GEM_PCT=25; // Leo 2026-10-27：15 → 25
export function rivalLoot(b,rng){const out={gold:0,items:[],gems:[]};for(const e of foes(b))if(e.rival&&!e.captured){out.gold+=e.lv*rng.int(3,6);if(rng.chance(20))out.items.push(e.lv>=15?'potion2':'potion');
 if(rng.chance(RIVAL_GEM_PCT))out.gems.push(gemId(GRADED_GEMS[rng.int(0,GRADED_GEMS.length-1)],Math.max(1,Math.min(10,Math.round(e.lv/8)+rng.int(-1,1)))));}return out;}
export function startFloor(p,seed){
 const d=DUNGEON_BY_ID[p.dg.id],rng=makeRng(seed);
 const party=R.partyUnits(p);
 if(p.dg.floor<FLOORS){
  const n=rng.int(1,R.groupMax(p.lv,party.length-1)); // 一群幾隻照出門的人數（rules.mjs GROUP_MAX）
  const enemies=[];for(let i=0;i<n;i++)enemies.push([d.mons[rng.int(0,d.mons.length-1)],rng.int(...d.monLv)]);
  const rival=n>=2&&rng.chance(R.RIVAL_PCT(p.lv));
  const b=createBattle({party,enemies:rival?[]:enemies,seed:rng.int(1,2**31),canEscape:true});
  if(rival)R.addRivals(b,rivalParty(enemies.slice(0,party.length+1).map(e=>e[1]),rng));
  R.mudBattle(b);b.dg=d.id;b.floor=p.dg.floor;return b;
 }
 const b=createBattle({party,enemies:[],seed:rng.int(1,2**31),canEscape:false});R.mudBattle(b);b.dg=d.id;b.floor=p.dg.floor;b.pvp=true; // 王全力出手
 // 兩個王的地下城（陳小白與 KLY）：兩個都是一般生命（◎ PAIR_HP），一前一後站
 for(const [i,second] of (d.pair?[[0,false],[1,true]]:[[0,false]])){const u=R.fullUnit(bossFighter(d,second));u.maxHp=Math.round(u.maxHp*(d.pair?PAIR_HP:['mage','priest'].includes(d.job)?CASTER_HP:isDragon(d)?PAIR_HP:BOSS_HP));u.hp=u.maxHp;
  b.units.push({...u,uid:'e'+i,side:'enemy',ai:true,boss:true,mon:'chief',row:second?'front':'back',slot:0,alive:true,defending:false,skip:0,down:null,st:null});}
 return R.mudBattle(b);
}
// ◎ 王的掉落：寶石必掉一顆（一般寶石隨機，等級約王的等級÷5，上下差 1）；19 級以上的王 60% 掉鋼騎之礦或魔族的水晶；
//   31 級以上的王 2%×(等級−20) 掉一件生鏽／破爛的裝備（原作海神才掉）
export function bossLoot(d,rng){
 const out=[],types=GRADED_GEMS,g=Math.max(1,Math.min(10,Math.round(d.lv/5)+rng.int(-1,1)));
 out.push(gemId(types[rng.int(0,types.length-1)],g));
 // ◎ 5% 另外掉一顆任務／活動／寵物寶石（等級不超過王的寶石等級＋1）
 if(rng.chance(5)){const sp=Object.keys(GEM_TYPES).flatMap(t=>GEM_TYPES[t].fixed?GEM_TYPES[t].fixed.filter(x=>x<=g+1).map(x=>gemId(t,x)):[]);if(sp.length)out.push(sp[rng.int(0,sp.length-1)]);}
 if(d.lv>=19&&rng.chance(60))out.push(rng.chance(50)?'knightOre':'demonCrystal');
 if(d.lv>=31&&rng.chance(2*(d.lv-20)))out.push(RUSTY[rng.int(0,RUSTY.length-1)][0]);
 return out;
}
// 晉級任務 ◎：原作的晉級任務改成通關指定的地下城
export const PROMOTE_DUNGEON={treant:'d6',beast:'d15',curse:'d22'}; // Damonk（19 級）、我來解任務的（49 級）、必問（67 級，晉級師範）
export function promoteCheck(p){
 const c=P.promoteCheck(p);
 for(const r of c.rows)for(const [q,name] of Object.entries(QUEST_NAMES))if(r[0]===name){const d=DUNGEON_BY_ID[PROMOTE_DUNGEON[q]];r[0]=d?`通關「${d.name}」`:'晉級任務（之後開放）';}
 return c;
}
export const promote=p=>{const c=promoteCheck(p);return c.ok?P.promote(p):no(c.msg||'條件還沒達到。');};
// 練功、地下城打完一場：照 rules.finishHunt 算經驗、掉落、受傷，再加材料；地下城另外處理樓層和王的掉落
export function finishFight(p,b){
 const out=R.finishHunt(p,b);
 if(b.over==='win'){
  const rl=rivalLoot(b,makeRng((b.rngState^0x3c6ef372)>>>0)),got=[...materialDrops(b),...rl.gems];
  if(rl.gold){p.gold+=rl.gold;out.lines.push(`從冒險者身上搜到 ${rl.gold} 金。`);}
  for(const id of rl.items)if(P.addItem(p,id))out.lines.push(`撿到${ITEMS[id].name}。`);
  const d=b.dg&&DUNGEON_BY_ID[b.dg],boss=d&&b.floor>=FLOORS;
  if(boss)got.push(...bossLoot(d,makeRng((b.rngState^0x68e31da4)>>>0)));
  for(const id of got)addMat(p,id);
  if(got.length)out.lines.push(`撿到材料：${got.map(id=>ITEMS[id].name).join('、')}。`);
  if(d){
   if(boss){p.flags.dg={...(p.flags.dg||{}),[d.id]:cleared(p,d)+1};for(const [q,id] of Object.entries(PROMOTE_DUNGEON))if(id===d.id)p.flags[q]=true;p.dg=null;out.lines.push(`打倒了${d.boss}！${d.name}通關。`);out.cleared=true;}
   else{p.dg={id:d.id,floor:b.floor+1};out.next=b.floor+1;}
  }
 }else if(b.dg){p.dg=null;if(b.over==='escaped')out.lines.push('逃出了地下城。');}
 return out;
}
export const bossLook=d=>GENERAL_BY_ID[d.look];
export const bossLabel=d=>[[d.boss1,d.job],...(d.pair?[[d.pair[0],d.pair[1]]]:[])].map(([n,j])=>`${n}（Lv${d.lv} ${rankName(j,bossRank(d.lv))}）`).join('、');
// 王會的技能（地下城頁面顯示用）：[[名字, 職階, [[技能名, 等級]...]]...]
const kitMemo={};
export const bossKits=d=>kitMemo[d.id]||=[false,...(d.pair?[true]:[])].map(second=>{const f=bossFighter(d,second);const st=bossStyle(d,second);return [f.name,rankName(f.job,f.rank),f.skills.map(x=>[SKILLS[x.id].name,x.lv]),st.name+(isDragon(d)?'・水龍裝':'')];});
// 材料整組賣給道具店
