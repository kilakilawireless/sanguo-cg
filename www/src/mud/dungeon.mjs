// 文字版擂台的地下城與打造（Leo 2026-10-26）。不碰畫面。
// ◎ 裝備改成打造：武器店、防具店只賣國民裝備；其他裝備拿材料和工錢給工房師傅做。材料打怪掉（原作是採集，這裡沒有採集職業）。
//   配方照本作 recipes.mjs 的算法（主材料 4＋2×裝備等級個、副材料 1 個；材料階級＝裝備等級），短刀比照劍用礦石。
//   材料（含寶石、水龍素材）放在不佔道具欄的材料袋 p.mats（◎，原作要存銀行）。
// 水龍系列照原作（巴哈姆特、御劍軒、17173 的資料）：7 級、數值和配方照抄（生鏽／破爛的裝備＋鋼騎之礦 2＋魔族的水晶 2＋幻之鋼條／朴／百里香）。
//   原作是海神（Lv80）掉生鏽裝備；這裡改成 31 級以上的地下城王掉（◎）。冰龍（回力鏢）、水龍之盾沒有對應的欄位，先不做；
//   抗性、耐久、「某招耗魔減少」先不做（◎）。7 級裝備要王宮職階（晉級兩次）才穿得上。
// 寶石照原作第一組（黃寶石、綠寶石、藍寶石、冒險之星、紫水晶、騎士寶石，各 10 個等級），打造時加進去改變裝備數值。
//   石榴石只加耐久，這裡沒有耐久，先不掉；冒險之星照原作扣耐久（Leo 2026-10-27：寶石只加不扣之後跟藍寶石重疊）：鑲了之後最大耐久 −STAR_DUR(g)%，壞得快、修得勤（◎ 幅度自訂）。
// ◎ 地下城：15 座，每座 3 層，前兩層是魔物，第三層是王。生命魔力一路帶著走，打完一層可以撤退。
//   王是電腦操作的人物（跟擂台的對手一樣，一回合兩動），生命 ×1.5。王的名字是 Leo 給的；地下城名、王的職業等級、掉落機率是自訂。
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import {createBattle,foes} from '../core/battle.mjs';
import {makeRng} from '../core/rng.mjs';
import {ITEMS,SHOPS} from '../data/items.mjs';
import {crystalOf} from '../data/monsters.mjs';
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
// ---------- 天空系列（Leo 2026-10-29，企劃 https://claude.ai/artifact/4UUJHY4bF6K9d9ju1Nozkw） ----------
// 武器照原作的傳說武器（村正、帕魯凱斯之斧、牛斧、天空之槍、阿夏芙之杖；天空之弓、天空的小刀 ◎ 自訂），防具 ◎ 自訂；全部 10 級（師範），
//   攻擊＝原作 ×1.25（Leo 2026-10-29），「某招不耗魔」改成耗魔 −60%（Leo 2026-10-29），天空之槍必殺 +20（Leo 2026-10-29）。
// 打造時每項正的數值擲 ±20%（Leo 2026-10-29「打造出來的武器還是要有能力浮動 上下20%」；SKY_ROLL），耗魔 −% 不擲；耐久 300 照原作。
// 材料：六曜之塔的特殊王掉的天空素材（主 4＋副 2），武器另要李貝留斯掉的天空之核；天空之戒 Leo 2026-10-29 說不要做。
export const SKY_ROLL=.2;
const rngOf=x=>Object.fromEntries(Object.entries(x).filter(([k,v])=>typeof v==='number'&&v>0&&k!=='lv'&&k!=='price').map(([k,v])=>[k,[Math.round(v*(1-SKY_ROLL)),Math.round(v*(1+SKY_ROLL))]]));
const SKY_CORE=[['skyCore',1],['knightOre',3],['demonCrystal',3]];
const S10=(name,slot,cg,x,main,sub,extra,fee)=>{const it={name,kind:slot==='weapon'?'weapon':'armor',slot,cg,lv:10,price:90000,sky:true,noAuto:true,maxDur:300,...x};it.rng=rngOf(x);
 it.recipe=[[main[0],main[1]],[sub[0],sub[1]],...extra];it.fee=fee;return it;};
const SW=(name,type,x,main,sub,n=1)=>S10(name,'weapon',type,{type,...(type==='bow'?{ranged:true}:{}),...x},main,sub,n===2?[['skyCore',2],['knightOre',3],['demonCrystal',3]]:SKY_CORE,n===2?200000:150000);
const SA=(name,slot,cg,armor,x,main,sub,bar)=>S10(name,slot,cg,{...(armor?{armor}:{}),...x},main,sub,[['knightOre',2],['demonCrystal',2],[bar,10]],100000);
const STAFF_ELEM={earth:'地',water:'水',fire:'火',wind:'風'};
export const SKY={
 skySword:SW('村正','sword',{atk:300,mpPct:{combo:-60}},['skySteel',4],['skyFeather',2]),
 skyAxe:SW('帕魯凱斯之斧','axe',{atk:312,crit:18,mpPct:{allin:-60}},['skySteel',4],['skyHorn',2]),
 skyOx:SW('牛斧','axe',{atk:450,agi:-80,crit:27,hit:-5,dodge:-5,rdrunk:20},['skySteel',6],['skyHorn',4],2),
 skySpear:SW('天空之槍','spear',{atk:200,counter:8,hit:40,crit:20},['skyHorn',4],['skyFeather',2]),
 skyBow:SW('天空之弓','bow',{atk:250,crit:6,hit:20,mpPct:{volley:-50}},['skyFeather',4],['skyHorn',2]),
 skyDagger:SW('天空的小刀','dagger',{atk:210,crit:24,hit:10,dodge:10,mpPct:{haze:-60}},['skyFeather',4],['skySteel',2]),
 ...Object.fromEntries(Object.entries(STAFF_ELEM).map(([e,n])=>['skyStaff_'+e,SW(`阿夏芙之杖（${n}）`,'staff',{atk:10,spr:70,mp:60,matk:360,mpPct:{[e+'3']:-10}},['skySand',4],['skyFeather',2])])),
 skyShield:SA('天空之盾','shield','shield',null,{def:125,mres:130,hit:5,crit:5},['skySteel',4],['skyHorn',2],'phantomBar'),
 skyHelm:SA('天空之盔','head','helm','heavy',{def:140,mres:70,hit:8,mpPct:{cover:-50}},['skySteel',4],['skyHorn',2],'phantomBar'),
 skyHat:SA('天空之帽','head','hat',['light','robe'],{def:78,spr:20,hit:10,mres:30},['skySand',4],['skyFeather',2],'pu'),
 skyMail:SA('天空鎧甲','body','mail','heavy',{def:255,mres:90,counter:8},['skySteel',4],['skyHorn',2],'phantomBar'),
 skyCloth:SA('天空之衣','body','cloth','light',{def:160,dodge:25,agi:15},['skyFeather',4],['skySteel',2],'lingzhi'),
 skyRobe:SA('天空法袍','body','robe','robe',{def:95,mp:550,spr:20,mres:40,mpPct:{heal3:-30}},['skySand',4],['skyFeather',2],'pu'),
 skyBoots:SA('天空之靴','feet','boots',['heavy','light'],{def:120,mres:60,crit:6,hit:6},['skySteel',4],['skyHorn',2],'phantomBar'),
 skyShoes:SA('天空之鞋','feet','shoes',null,{def:45,agi:55,dodge:15},['skyFeather',4],['skySteel',2],'lingzhi'),
};
// ---------- 特化裝（Leo 2026-10-29）：打特殊王前要先做，鷹眼＝命中、幻影＝閃躲、破軍＝必殺；照職業分重裝／輕裝／法系（頭身腳），飾品不分 ◎ ----------
// 8 級（王宮就能穿），防禦照同級一般裝；材料＝同級一般材料＋迷宮王掉的試煉徽章（身、飾品 3 個，其他 2 個），工錢每件 20000；數值一樣擲 ±20%
export const SPEC_SETS={hawk:{name:'鷹眼',stat:'hit',v:[40,50,40,50],foe:'閃躲很高的王'},phantom:{name:'幻影',stat:'dodge',v:[40,50,40,50],foe:'反擊很高的王'},breaker:{name:'破軍',stat:'crit',v:[8,12,8,12],foe:'防禦很高的王'},spirit:{name:'靈光',stat:'spr',v:[80,100,80,100],foe:'精神很高的王'}};
const SPEC_PIECES=[['Helm','頭盔','head','helm','heavy',{def:75},0],['Mail','之鎧','body','mail','heavy',{def:145},1],['Boots','之靴','feet','boots',['heavy','light'],{def:60},2],
 ['Hat','之帽','head','hat',['light','robe'],{def:50},0],['Cloth','之衣','body','cloth','light',{def:105},1],['Robe','法袍','body','robe','robe',{def:58,mp:300},1],['Shoes','之鞋','feet','shoes',null,{def:23},2],['Acc','護符','acc','acc',null,{},3]];
export const SPEC=Object.fromEntries(Object.entries(SPEC_SETS).flatMap(([k,st])=>SPEC_PIECES.map(([key,suf,slot,cg,armor,base,vi])=>{
 const x={...base,[st.stat]:st.v[vi]},it={name:st.name+suf,kind:slot==='acc'?'armor':'armor',slot,cg,lv:8,price:40000,fee:20000,spec:k,noAuto:true,...(armor?{armor}:{}),...x};it.rng=rngOf(x);return ['spec_'+k+key,it];})));
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
 star:{name:'冒險之星',w:(it,g)=>({atk:pct(it.atk,8+2*g)}),a:(it,g)=>({def:pct(it.def,8+2*g)}),wt:'攻擊＋%、耐久變少',at:'防禦＋%、耐久變少'},
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
 mouse:{name:'鼠王寶石',fixed:[1,2,3],names:['鼠王寶石的碎片','破損的很嚴重的鼠王寶石','破破的鼠王寶石'],w:(it,g)=>{const n=8+4*g;return {atk:n,def:n,agi:n,spr:n,hit:g,crit:g,counter:g};},a:(it,g)=>{const n=8+4*g;return {atk:n,def:n,agi:n,spr:n,hit:g,crit:g,counter:g};},wt:'全能力大幅＋',at:'全能力大幅＋'},
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
 crystalShard:{name:'水晶碎片',kind:'material',tier:0,sell:0,desc:'集滿就能換屬性（狀態頁「換屬性」）。魔物身上有機會掉，地下城的王一定掉。'},
 phantomBar:{name:'幻之鋼條',kind:'material',tier:7,sell:60,desc:'打造水龍系列兵器、鎧甲的主材料。30 級以上的魔物會掉。'},
 pu:{name:'朴',kind:'material',tier:7,sell:50,desc:'打造水龍系列弓、杖、法袍、鞋的主材料。30 級以上的魔物會掉。'},
 ...Object.fromEntries(Object.keys(GEM_TYPES).flatMap(t=>gradesOf(t).map(g=>[gemId(t,g),{name:gemName(t,g),kind:'material',gem:t,grade:g,tier:7,sell:40*g**2*(GEM_TYPES[t].fixed?3:1),
  desc:`打造時加進去：兵器${GEM_TYPES[t].wt}，防具${GEM_TYPES[t].at}。等級 ${g}${GEM_TYPES[t].fixed?'':'／10'}。`}]))),
 ...Object.fromEntries(Object.entries(DRAGON).map(([id,it])=>[id,(({recipe,...x})=>x)(it)])),
 // 天空系列、特化裝的材料（Leo 2026-10-29）
 trialBadge:{name:'試煉徽章',kind:'material',tier:8,sell:0,desc:'打造特化裝（鷹眼、幻影、破軍）要用。迷宮王身上找得到。'},
 skyFeather:{name:'疾風之羽',kind:'material',tier:9,sell:0,desc:'打造天空系列要用。六曜之塔的潘德米爾會掉。'},
 skyHorn:{name:'雷鳴之角',kind:'material',tier:9,sell:0,desc:'打造天空系列要用。六曜之塔的普留梅爾會掉。'},
 skySteel:{name:'天空鋼',kind:'material',tier:9,sell:0,desc:'打造天空系列要用。六曜之塔的夫力梅爾會掉。'},
 skySand:{name:'星辰之砂',kind:'material',tier:9,sell:0,desc:'打造天空系列要用。六曜之塔的尼伯斯會掉。'},
 skyCore:{name:'天空之核',kind:'material',tier:9,sell:0,desc:'打造天空系列的武器要用。六曜之塔頂的李貝留斯會掉。'},
 ...Object.fromEntries(Object.entries(SKY).map(([id,it])=>[id,(({recipe,...x})=>x)(it)])),
 ...SPEC,
};
for(const [id,it] of Object.entries(MUD_ITEMS))ITEMS[id]??=it;
// 商店的藥是醫院的 3 倍價（Leo 2026-10-27）：生命 1.5 金／點、魔力 3 金／點；補魔藥戰鬥中也能喝
export const POTION_RATE={hp:1.5,mp:3};
// 魔力藥戰鬥中不能喝（Leo 2026-10-27），只能在兩場之間喝
Object.assign(ITEMS,{mpot:{name:'魔力藥',kind:'use',mp:100,battle:false,desc:'回復 100 魔力，戰鬥中不能喝。'},mpot2:{name:'高級魔力藥',kind:'use',mp:300,battle:false,desc:'回復 300 魔力，戰鬥中不能喝。'}});
for(const id of ['potion','potion2','potion3','potion4','bun','roast','meatBun','hotpot','feast','mpot','mpot2']){const it=ITEMS[id];ITEMS[id]={...it,price:Math.round((it.hp||0)*POTION_RATE.hp+(it.mp||0)*POTION_RATE.mp),desc:it.desc.replace('藥劑師才做得出來。','')};}
SHOPS.goods={...SHOPS.goods,stock:['potion','potion2','potion3','mpot','mpot2']};
// 重裝近戰（劍士、戰斧鬥士、騎士、士兵）才能穿的鎧甲、頭盔，防禦 ×1.35（Leo 2026-10-26，◎）；打造擲的範圍照舊，擲完再乘
export const HEAVY_DEF=1.35;
export const MRES_MULT=1.6; // 所有裝備的抗魔 ×1.6（Leo 2026-10-28 先 +30% 沒感覺再改 ×1.6；打造擲的範圍不變、擲完再乘，舊的也一樣）
export const heavyMult=(it,k)=>k==='def'&&it?.armor==='heavy'?HEAVY_DEF:k==='mres'?MRES_MULT:1;
for(const it of Object.values(ITEMS)){if(it.armor==='heavy'&&it.def>0)it.def=Math.round(it.def*HEAVY_DEF);if(it.mres>0)it.mres=Math.round(it.mres*MRES_MULT);}
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
 // 寶石部分「gem_藍寶石_5#112」：#後面是鑲嵌時擲的效果百分比（GEM_ROLL 80～120，Leo 2026-10-28）
 const [base,gemFull]=String(id).split('@'),[gem,pctS]=String(gemFull||'').split('#'),pct=pctS==null?100:+pctS;ensureItem(base);const it=ITEMS[base],gm=parseGem(gem);
 if(!it?.slot||!gm||String(base).includes('@')||!Number.isInteger(pct)||pct<GEM_ROLL[0]||pct>GEM_ROLL[1])return false;
 const ty=GEM_TYPES[gm.t],mod=(it.slot==='weapon'?ty.w:ty.a)(it,gm.g),out={...it,name:`${it.name}（${ty.fixed?gemName(gm.t,gm.g):ty.name+gm.g}${pct!==100?` ${pct}%`:''}）`,gemmed:gem,gemPct:pct,price:it.price};
 for(const [k,v] of Object.entries(mod))out[k]=(out[k]||0)+Math.round(v*pct/100);
 if(gm.t==='star')out.maxDur=Math.max(3,Math.round((it.maxDur||100+20*(it.lv||1))*(1-STAR_DUR(gm.g)/100)));
 ITEMS[id]=out;return true;
}
export const STAR_DUR=g=>20+3*g; // 冒險之星扣的最大耐久 %（◎ 1 級 −23%、10 級 −50%）
// 寶石鑲在兵器（slot='weapon'）或防具上的效果，給人看的一行字：照裝備數值算百分比的寫「%」
const GEM_STAT={atk:'攻擊',def:'防禦',agi:'敏捷',spr:'精神',matk:'魔攻',rec:'回復',hp:'生命',mp:'魔力',crit:'必殺',counter:'反擊',hit:'命中',dodge:'閃躲',...RES_NAMES};
export function gemEffect(gem,slot){
 const [core,pctS]=String(gem).split('#'),pct=pctS?+pctS:100,gm=parseGem(core);if(!gm)return '';const f=GEM_TYPES[gm.t][slot==='weapon'?'w':'a'];
 const a=f({atk:100,def:100,agi:100,spr:100,rec:100},gm.g),b=f({atk:200,def:200,agi:200,spr:200,rec:200},gm.g);
 const txt=Object.entries(a).filter(([,v])=>v).map(([k,v])=>`${GEM_STAT[k]||k}${v>0?'+':''}${Math.round(v*pct/100)}${b[k]===2*v&&v!==0?'%':''}`);if(gm.t==='star')txt.push(`最大耐久−${STAR_DUR(gm.g)}%`);
 return txt.join('、')||'沒有效果';
}
export const GEM_ROLL=[80,120];export const rollGemPct=(rand=Math.random)=>GEM_ROLL[0]+Math.floor(rand()*(GEM_ROLL[1]-GEM_ROLL[0]+1));
export const withGem=(id,gem,pct=100)=>{const v=`${id}@${gem}${pct!==100?'#'+pct:''}`;ensureItem(v);return v;};

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
// 特化裝：同級一般材料＋試煉徽章（身、飾品 3 個，其他 2 個）
function specMats(it){return [...mats(it),['trialBadge',it.slot==='body'||it.slot==='acc'?3:2]];}
function mats4(it,L,n){
 if(it.slot==='weapon'){
  if(it.type==='bow')return [[WOOD[L],n],[LEATHER[L],1]];
  if(it.type==='staff')return [[WOOD[L],n],[METAL[L],1]];
  return [[METAL[L],n],[WOOD[L],1]];
 }
 if(it.slot==='shield')return [[METAL[L],n-2],[WOOD[L],2]]; // ◎
 if(it.slot==='acc')return [[METAL[L],Math.max(2,n-4)],[LEATHER[L],2],[WOOD[L],1]]; // ◎ 飾品：原作的材料本作沒有，照等級換成金屬、皮、木
 if(it.cg==='shoes')return [[LEATHER[L],Math.max(2,n-3)],[WOOD[L],1]];
 if(it.armor==='heavy')return [[METAL[L],n],[LEATHER[L],1]];
 if(it.slot==='feet'||it.slot==='head')return [[LEATHER[L],Math.max(2,n-3)]];
 return it.armor==='robe'?[[LEATHER[L],n-1],[WOOD[L],1]]:[[LEATHER[L],n]];
}
// 一般裝備 4 級以下（沒有 5 級以上的配方）；水龍系列照原作配方
// ◎ 讓錢有用（Leo 2026-10-26）：工錢＝商店行情 × 裝備等級 ÷ 10（1 級主裝備 150、4 級 6000、8 級 40000），水龍系列 60000
export const forgeFee=it=>it.dragon?60000:it.fee||Math.round(it.price*it.lv/10); // 天空系列 10～20 萬、特化裝 2 萬寫在 it.fee
// 寶石合成工錢：等級² × 100（1 級 100、5 級 2500、10 級 10000）
export const fuseFee=g=>100*g*g;
// 工房做得出來的：原作裝備（gear.mjs，1～11 級）和水龍系列
export const RECIPES=Object.fromEntries(Object.entries(ITEMS).filter(([id,it])=>CG_GEAR[id]||DRAGON[id]||SKY[id]||SPEC[id])
 .map(([id,it])=>[id,{mats:DRAGON[id]?DRAGON[id].recipe:SKY[id]?SKY[id].recipe:SPEC[id]?specMats(it):mats(it),fee:forgeFee(it)}]));
export const recipeKind=id=>ITEMS[id].dragon?'dragon':ITEMS[id].sky?'sky':ITEMS[id].spec?'spec':ITEMS[id].slot==='weapon'?'weapon':ITEMS[id].slot==='acc'?'acc':'armor';
export const gemsIn=p=>Object.keys(p.mats||{}).filter(id=>parseGem(id)&&p.mats[id]>0);
export function canForge(p,id,gem){
 const r=RECIPES[id];if(!r)return no('');
 const lack=r.mats.filter(([m,n])=>matCount(p,m)<n).map(([m,n])=>`${ITEMS[m].name}還差 ${n-matCount(p,m)}`);
 if(lack.length)return no(lack.join('、')+'。');
 if(gem&&ITEMS[id].slot==='acc')return no('飾品不能鑲寶石。');
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
 const rolled=rollGear(id,rand),pct=gem?rollGemPct(rand):100,out=gem?withGem(rolled,gem,pct):rolled;P.addItem(p,out);
 return yes(`工房師傅替你打好了${ITEMS[out].name}（${rollNote(rolled)}${gem?`，寶石效果 ${pct}%`:''}）。`,{out});
}

// ---------- 鑲寶石（Leo 2026-10-28：打造好、看到擲出來的數值再鑲，不要跟打造的隨機綁在一起） ----------
// 背包裡還沒鑲過的兵器、防具（不含飾品）＋一顆寶石 → 「代號@寶石#百分比」，寶石效果一樣擲 80%～120%；磨損照比例帶過去
const durMax=id=>ITEMS[id]?.maxDur||100+20*(ITEMS[id]?.lv||1);
export const socketable=p=>[...new Set(p.bag.map(x=>x.id))].filter(id=>ITEMS[id]?.slot&&ITEMS[id].slot!=='acc'&&!String(id).includes('@'));
export function canSocket(p,id,gem){
 const it=ITEMS[id];if(!it?.slot)return no('');if(it.slot==='acc')return no('飾品不能鑲寶石。');if(String(id).includes('@'))return no('這件已經鑲過寶石了。');
 if(!p.bag.some(x=>x.id===id))return no('背包裡沒有這件（穿在身上的先脫下來）。');
 if(!(parseGem(gem)&&matCount(p,gem)>0))return no('沒有這顆寶石。');
 return yes('');
}
export function socketGem(p,id,gem,rand=Math.random){
 const c=canSocket(p,id,gem);if(!c.ok)return c;const e=p.bag.find(x=>x.id===id),pct=rollGemPct(rand),out=withGem(id,gem,pct);
 const dur=e.dur==null?null:Math.max(0,Math.min(durMax(out),Math.round(e.dur/durMax(id)*durMax(out))));
 takeMat(p,gem,1);P.removeItem(p,id,1);P.addItem(p,out,1);const ne=p.bag.find(x=>x.id===out);if(ne&&dur!=null)ne.dur=dur;
 return yes(`${ITEMS[gem].name}鑲上去了：${ITEMS[out].name}（寶石效果 ${pct}%）。`,{out,pct});
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
  if(e.lv>=30&&rng.chance(25*MAT_MULT))out.push(['phantomBar','pu','lingzhi'][rng.int(0,2)]);
  if(rng.chance(R.SHARD_PCT))out.push(R.SHARD);} // 水晶碎片（Leo 2026-10-27：集滿換屬性）
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
// 王被打倒的彩蛋台詞（Leo 2026-10-28「NPC 打死的王的彩蛋文字都加一些好笑的」；宰羊那句是 Leo 給的，祖師爺那句是楓洋提的），結算第一行顯示
export const BOSS_LINES={
 d1:'等我練到 80 級再來！……先回去修裝備。',d13:'笑死，居然輸了。',d3:'火被你澆熄了……誰有打火機？',d4:'右白虎呢？說好的支援呢！',
 d5:'君子報仇，三年不晚。我先記帳。',d6:'空手打不過……我回去練氣功彈。',d7:'聖盾還沒開你就打完了，犯規！',d8:'……（淡然地倒下）',
 d16:'我只是小吃，正餐在後面。',d10:'盟的翅膀',d11:'我先回家顧小孩，改天再打。',d17:'我要逆流回去了，下次換我當上游。',
 d12:'阿宏下線，有事留言。',d2:'我一定會回來的～回來的～的～',d9:'輸了也要可愛地輸。',d15:'任務失敗……我只是來解任務的啊！',
 d14:'小白：KLY 你又站錯排！',d18:'這題超綱，不算！',d19:'爸爸只是讓你，別太得意。',d20:'YPP 先去吃宵夜，等等再戰。',
 d21:'海王也會淹水……',d22:'必問：你怎麼打的？教我。',d23:'別人的失敗就是我的快樂……今天例外。',d24:'打輸了正好，明天請假。',
 d25:'我腦後的反骨……被你打平了。',d26:'這一箭……算你的。'};
export const bossLine=d=>BOSS_LINES[d.id]?`${d.boss}：「${BOSS_LINES[d.id]}」`:'';
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
export const dungeonOpen=(p,d)=>yes(''); // 等級不限（Leo 2026-10-28：低等的也可以去挑戰），d.needLv 只當建議等級顯示
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
  if(lv<30)f.skills=f.skills.filter(s=>s.id!=='swift'); // ◎ 30 級前的冒險者不用迅速果斷（兩倍攻擊加必殺會把低等玩家一刀秒掉）
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
  const n=rng.int(1,R.groupMax(p.lv,R.fullExtra(p))); // 一群幾隻固定照這個等級的滿組算（rules.mjs fullExtra，Leo 2026-10-27）
  const enemies=[];for(let i=0;i<n;i++)enemies.push([d.mons[rng.int(0,d.mons.length-1)],rng.int(...d.monLv)]);
  const rival=n>=2&&rng.chance(R.RIVAL_PCT(p.lv));
  const b=createBattle({party,enemies:rival?[]:enemies,seed:rng.int(1,2**31),canEscape:true,captureRoom:R.petRoom(p)});
  if(rival)R.addRivals(b,rivalParty(enemies.slice(0,R.fullParty(p)+1).map(e=>e[1]),rng));
  R.mudBattle(b);b.dg=d.id;b.floor=p.dg.floor;return b;
 }
 const b=createBattle({party,enemies:[],seed:rng.int(1,2**31),canEscape:false});R.mudBattle(b);b.dg=d.id;b.floor=p.dg.floor;b.pvp=true; // 王全力出手
 pushBosses(b,d);return R.mudBattle(b);
}
// 兩個王的地下城（陳小白與 KLY）：兩個都是一般生命（◎ PAIR_HP），一前一後站；王的強度不隨隊伍人數變（Leo 2026-10-27）
function pushBosses(b,d){
 for(const [i,second] of (d.pair?[[0,false],[1,true]]:[[0,false]])){const u=R.fullUnit(bossFighter(d,second));u.maxHp=Math.round(u.maxHp*(d.pair?PAIR_HP:['mage','priest'].includes(d.job)?CASTER_HP:isDragon(d)?PAIR_HP:BOSS_HP));u.hp=u.maxHp;
  b.units.push({...u,uid:'e'+i,side:'enemy',ai:true,boss:true,mon:'chief',row:second?'front':'back',slot:0,alive:true,defending:false,skip:0,down:null,st:null});}
}
// ---------- 王戰 ◎（Leo 2026-10-27：通關過的王帶一隊護衛再打一次，要有戰術才過得了，剛好的等級按自動過不了；不是每個王都同一套，照王的打法分七種陣型） ----------
// 每種陣型：name 陣名、hp 王的生命倍數、k 護衛等級比例（沒寫＝RAID_K；弓陣、狂戰團爆發太高所以低一點）、text 給玩家看的配置、hint「怎麼打」、guards＝[職業, 稱呼, 技能, 打法, 排, 跟王同級?]
// 護衛穿跟敵對冒險隊一樣的打造裝和寶石；沒標同級的等級＝王 ×RAID_K
export const RAID_SETS={
 wall:{name:'護衛陣',hp:2,text:'近衛 ×2 護著王（護衛、聖盾、反擊）、軍醫補王、咒術師下咒、弓手打你後排',hint:'先用弓、魔法或一石二鳥處理後排的軍醫；近衛會替王擋普攻，用魔法或一擊必中繞過，或先磨掉聖盾；帶潔淨解昏睡、混亂、遺忘。',
  guards:[['guard','近衛',['cover','wall','counter'],'wall','front'],['guard','近衛',['cover','wall','counter'],'wall','front'],['priest','軍醫',['heal3','heal2','regen2','cure'],'caster','back',1],['priest','咒術師',['sleep2','confuse2','forget2'],'caster','back'],['bow','弓手',['volley','sure'],'crit','back']]},
 caster:{name:'魔法陣',hp:1.6,text:'魔術師 ×2 放範圍魔法、咒術師石化／昏睡、近衛護著王、軍醫補，王自己也是術士',hint:'範圍魔法會打到全隊，穿抗魔的防具、開攻擊魔法防禦或屏障；魔術師生命少、站後排，用弓或魔法先打掉；帶潔淨解石化。',
  guards:[['mage','魔術師',['fire2','fire1'],'caster','back'],['mage','魔術師',['water2','water1'],'caster','back'],['priest','咒術師',['stone2','sleep2'],'caster','back'],['guard','近衛',['cover','wall'],'wall','front'],['priest','軍醫',['heal2','cure'],'caster','back']]},
 power:{name:'狂戰團',hp:1.5,k:.6,text:'四個前排猛攻手（乾坤一擲、諸刃、氣功彈、連擊），沒有補師，王也全力輸出',hint:'對方沒有補血，比的是誰先倒：第一回合先開聖盾、用護衛罩住後排，反擊架勢讓他們打自己；範圍魔法、連擊清人最快。',
  guards:[['axe','狂戰士',['allin','blade'],'power','front'],['axe','狂戰士',['allin','blade'],'power','front'],['fighter','拳士',['qigong','smash'],'power','front'],['fighter','拳士',['qigong','smash'],'speed','front']]},
 speed:{name:'刺客團',hp:2,text:'三名刺客搶先手（一擊必中、連擊、偷竊）、軍醫補、弓手壓後排',hint:'刺客快但脆，先用昏睡、石化魔法定住一兩個；反擊架勢專剋連擊；護衛罩住補師，再用弓、魔法處理軍醫。',
  guards:[['assassin','刺客',['sure','combo','steal'],'speed','front'],['assassin','刺客',['sure','combo'],'speed','front'],['assassin','刺客',['sure','combo'],'dodge','front'],['priest','軍醫',['heal3','heal2'],'caster','back',1],['bow','弓手',['volley'],'crit','back']]},
 crit:{name:'弓陣',hp:1.6,k:.55,text:'三名弓手全站後排（亂射、一擊必中，必殺很高）、近衛擋在前面、軍醫補',hint:'近戰打不到後排，一定要帶弓、魔法或乾坤一擲；聖盾擋得住必殺一擊，先開再打；弓手生命少，優先打掉。',
  guards:[['bow','弓手',['volley','sure'],'crit','back'],['bow','弓手',['volley','sure'],'crit','back'],['bow','弓手',['volley','sure'],'crit','back'],['guard','近衛',['cover','wall'],'wall','front'],['priest','軍醫',['heal2','regen2'],'caster','back',1]]},
 counter:{name:'龜陣',hp:3,text:'王擺反擊架勢、生命特別厚，兩名軍醫輪流補，近衛 ×2 開聖盾，咒術師下毒、遺忘、酒醉，沒有打手',hint:'他們靠中毒慢慢磨你，帶潔淨或抗中毒的裝備；近戰打王會被反擊彈回來，改用魔法；兩個軍醫都站後排，用弓、魔法先打掉一個，補血就跟不上。',
  guards:[['priest','軍醫',['heal3','heal2','regen2'],'caster','back',1],['priest','軍醫',['heal3','heal2'],'caster','back',1],['guard','近衛',['wall','cover'],'wall','front'],['guard','近衛',['wall','cover'],'wall','front'],['priest','咒術師',['poison2','forget2','drunk2'],'caster','back']]},
 dodge:{name:'幻影',hp:2,text:'王很會閃，咒術師 ×2 下混亂、昏睡、遺忘，刺客 ×2 補刀，軍醫補',hint:'普攻常常落空，一擊必中、魔法不吃閃躲；混亂會讓隊友互砍，帶潔淨或抗異常的裝備；先打掉咒術師。',
  guards:[['priest','咒術師',['confuse2','sleep2'],'caster','back'],['priest','咒術師',['forget2','confuse2'],'caster','back'],['assassin','刺客',['sure','combo'],'dodge','front'],['assassin','刺客',['sure','combo'],'dodge','front'],['priest','軍醫',['heal2','cure'],'caster','back',1]]},
};
export const raidSet=d=>RAID_SETS[BOSS_STYLE[d.id]]||RAID_SETS.power;
export const RAID_K=.7;
export const raidGuardN=p=>Math.min(5,R.fullParty(p)); // ◎ 沒標同級的護衛等級＝王的等級×RAID_K（試算用的旋鈕）
export const RAID_PARTY=3; // 王戰是組隊內容：隊伍能帶到 3 人（20 級）才開
// ◎ 王戰的等級跟著隊伍：王和護衛至少是「隊裡最高等級 −RAID_LAG」（低等的王不會因為練高了就隨便過；獎勵照那座王原本的等級）
export const RAID_LAG=2,raidLv=(d,top)=>Math.max(d.lv,(top||0)-RAID_LAG);
export const raidOpen=(p,d)=>cleared(p,d)>=1&&R.fullParty(p)>=RAID_PARTY;
export const raidWins=(p,d)=>p.flags?.raid?.[d.id]||0;
export function startRaid(p,id,seed){
 const d=DUNGEON_BY_ID[id],rng=makeRng(seed),b=createBattle({party:R.partyUnits(p),enemies:[],seed:rng.int(1,2**31),canEscape:true});
 R.mudBattle(b);b.raid=d.id;
 // 護衛幾個照這個等級的滿組人數＋1（20 級前自己一個人：2 個；20 級 4 個；30 級起全部 5 個），陣型前面的是最關鍵的
 return raidFoes(b,d,rng,raidGuardN(p),1,raidLv(d,R.topLv(p)));
}
// 王＋護衛隊放進戰鬥：guardN 幾個護衛、hpMult 王的生命再乘（組隊照人數）、lv 王戰的等級（raidLv）
function raidFoes(b,d0,rng,guardN,hpMult,lv=d0.lv){
 const d=lv===d0.lv?d0:{...d0,lv};b.raidLv=lv;
 const set=raidSet(d);b.pvp=true;pushBosses(b,d);for(const u of b.units)if(u.boss){u.maxHp=Math.round(u.maxHp*set.hp*hpMult);u.hp=u.maxHp;}
 const n={front:0,back:0};n.front=1;if(d.pair)n.front=1,n.back=1;else n.back=1;
 set.guards.slice(0,guardN).forEach(([job,name,kit,style,row,full],i)=>{const st=STYLES[style],lv=full?d.lv:Math.max(1,Math.round(d.lv*(set.k??RAID_K)));
  const f=R.buildFighter(lv,job,GENERALS[rng.int(0,GENERALS.length-1)].id,`${d.boss}的${name}`,{[ELEMS[rng.int(0,3)]]:10},rng.int(1,2**30),kit,bossRank(lv),st.bp,rivalGearLv(lv));
  const g=rivalGem(lv);if(g){for(const [slot,gid] of Object.entries(f.equip))if(gid&&(slot==='weapon'||slot==='body'))f.equip[slot]=withGem(gid,gemId(slot==='weapon'?st.w:st.a,g));}
  const u=R.fullUnit(f);b.units.push({...u,uid:'e'+(b.units.filter(x=>x.side==='enemy').length),side:'enemy',ai:true,mon:null,job,row,slot:n[row]++,alive:true,defending:false,skip:0,down:null,st:null,guardOf:job==='guard'?'e0':undefined});});
 return R.mudBattle(b);
}
// ---------- 六曜之塔的特殊王（Leo 2026-10-29；名字照原作六曜之塔，數值 ◎） ----------
// 血很厚、不帶收服者、一回合兩動，各有一項極端能力，要先穿對的特化裝：潘德米爾（閃躲）→鷹眼、普留梅爾（反擊）→幻影、夫力梅爾（防禦）→破軍、尼伯斯（精神）→靈光。
// 四隻都打贏過才能挑戰李貝留斯（帶三個護衛）。每隻每天第一次打贏才有掉落（p.flags.sky.day），通關地下城 d26、隊裡有人 70 級才開。
// mod：avoid 閃躲率直接加幾 %（裝備上的閃躲是 ÷4 才進公式）、mag 攻擊魔法傷害倍數、counter 反擊 %、def／spr／agi 倍數、mres 抗魔加值、hp 生命倍數、atk 攻擊倍數
const SKY_EQ={spear:{weapon:'skySpear',head:'skyHelm',body:'skyMail',feet:'skyBoots',shield:'skyShield'},sword:{weapon:'skySword',head:'skyHelm',body:'skyMail',feet:'skyBoots',shield:'skyShield'},
 guard:{weapon:'skySword',head:'skyHelm',body:'skyMail',feet:'skyBoots',shield:'skyShield'},assassin:{weapon:'skyDagger',head:'skyHat',body:'skyCloth',feet:'skyShoes'},mage:{weapon:'skyStaff_water',head:'skyHat',body:'skyRobe',feet:'skyShoes'}};
export const SKY_BOSSES=[
 {id:'s1',name:'潘德米爾',tag:'疾風',lv:85,job:'assassin',look:'zhouyu',elem:{wind:10},kit:['kill','venom','haze'],style:'dodge',mat:'skyFeather',mod:{avoid:5,agi:1.5,mres:120,hp:12,atk:1.3},
  text:'敏捷 ×1.5、閃躲頂到上限、抗魔高：普攻、技能大多打空，魔法也只剩一點點。',hint:'全隊穿鷹眼裝（命中），武器、寶石再補命中；一擊必中也有用。'},
 {id:'s2',name:'普留梅爾',tag:'反擊',lv:85,job:'spear',look:'wangping',elem:{earth:10},kit:['blade','combo','honor'],style:'counter',mat:'skyHorn',mod:{counter:80,hp:7,atk:.7},
  text:'反擊 +80：近戰每打一下多半會被反打一下，前排很快倒；弓、魔法不會被反擊。',hint:'近戰穿幻影裝（閃躲）把反擊閃掉，弓手、魔術師負責輸出；聖盾、騎士之譽也擋得住。'},
 {id:'s3',name:'夫力梅爾',tag:'鐵壁',lv:85,job:'guard',look:'xuchu',elem:{earth:10},kit:['wall','cover','combo'],style:'wall',mat:'skySteel',mod:{def:4,mres:150,hp:16,atk:1},
  text:'防禦 ×4、抗魔 +150、生命特別厚：普攻、魔法都只剩一兩成。',hint:'必殺會多打「他防禦的一半」，防禦越高越痛：全隊穿破軍裝（必殺），拿斧的最好。'},
 {id:'s4',name:'尼伯斯',tag:'精神',lv:85,job:'mage',look:'huatuo',elem:{water:10},kit:['water3','fire3','earth3','wind3'],style:'caster',mat:'skySand',mod:{spr:1.3,hp:7,mag:4,atk:.7},
  text:'精神很高、魔法傷害 ×4，一回合兩發強力魔法，一下就打掉全隊一大截。',hint:'全隊穿靈光裝（精神）：精神比他高，他的魔法就打不痛。抗魔裝幫助不大。'},
 {id:'s5',name:'李貝留斯',tag:'塔頂',lv:90,job:'spear',look:'zhaoyun',elem:{wind:5,fire:5},kit:['combo','allin','blade','swift'],style:'power',mat:'skyCore',final:true,mod:{avoid:10,counter:40,def:2,spr:2,hp:6,atk:.6},
  guards:[['佛利波羅','assassin','zhoucang',['kill','venom','haze'],{avoid:20,atk:.6}],['阿卡斯','sword','mizhu',['combo','allin','swift'],{counter:80,atk:.6}],['巴洛斯','guard','dianwei',['cover','wall','combo'],{def:4,atk:.6}]],guardLv:70,
  text:'反擊 +40、閃躲高、防禦和精神 ×2，帶佛利波羅（閃躲很高）、阿卡斯（反擊 +80）、巴洛斯（防禦 ×4、護著王）。',hint:'隊伍要混搭：命中、閃避、必殺、抗魔各有人負責；先打掉護衛，再磨王。'},
];
export const SKY_BY_ID=Object.fromEntries(SKY_BOSSES.map(x=>[x.id,x]));
export const SKY_LV=70,SKY_GATE='d26';
export const skyWins=(p,id)=>p.flags?.sky?.win?.[id]||0;
export function skyOpen(p,id){
 const x=SKY_BY_ID[id];if(!x)return no('');
 if(!cleared(p,DUNGEON_BY_ID[SKY_GATE]))return no(`先通關${DUNGEON_BY_ID[SKY_GATE].name}。`);
 if(R.topLv(p)<SKY_LV)return no(`隊裡要有人 ${SKY_LV} 級。`);
 if(x.final&&SKY_BOSSES.some(y=>!y.final&&!skyWins(p,y.id)))return no('四隻特殊王都打贏過才上得了塔頂。');
 return yes('');
}
function skyUnit(b,rng,{name,job,look,elem,kit,lv,mod,style,eq},uid,row,slot,boss){
 const f=R.buildFighter(lv,job,look,name,elem,rng.int(1,2**30),kit,bossRank(lv),STYLES[style]?.bp);f.name=name;f.equip={...f.equip,...(SKY_EQ[job]||SKY_EQ.sword),...(eq||{})};
 const u=R.fullUnit(f),m=mod||{};
 if(m.avoid)u.avoidMod=(u.avoidMod||0)+m.avoid;if(m.counter)u.counterMod=(u.counterMod||0)+m.counter;if(m.mres)u.mres=(u.mres||0)+m.mres;
 for(const k of ['def','spr','agi'])if(m[k])u[k]=Math.round(u[k]*m[k]);if(m.atk)u.atk=Math.round(u.atk*m.atk);if(m.mag)u.magMult=m.mag;
 u.maxHp=Math.round(u.maxHp*(m.hp||1));u.hp=u.maxHp;
 b.units.push({...u,uid,side:'enemy',ai:true,boss,mon:boss?'chief':null,job,row,slot,alive:true,defending:false,skip:0,down:null,st:null});
}
// 特殊王放進戰鬥（試算也用這個）
export function skyFoes(b,x,rng){
 b.pvp=true;b.sky=x.id;skyUnit(b,rng,x,'e0','back',0,true);
 (x.guards||[]).forEach(([name,job,look,kit,mod],i)=>skyUnit(b,rng,{name,job,look,elem:x.elem,kit,lv:x.guardLv,mod,style:job==='guard'?'wall':job==='assassin'?'dodge':'power'},'e'+(i+1),'front',i,false));
 for(const u of b.units)if(u.side==='enemy'&&u.job==='guard'&&!u.boss)u.guardOf='e0';
 return R.mudBattle(b);
}
// 單人版（試算、測試用；遊戲裡六曜之塔只能線上組隊打，Leo 2026-10-29）
export function startSky(p,id,seed){
 const x=SKY_BY_ID[id],rng=makeRng(seed),b=createBattle({party:R.partyUnits(p),enemies:[],seed:rng.int(1,2**31),canEscape:true});
 R.mudBattle(b);return skyFoes(b,x,rng);
}
// 打贏：每隻每天第一次掉 2～3 個天空素材（李貝留斯 1 顆天空之核）＋水晶碎片，組隊打是 SKY_COOP_MULT 倍（Leo 2026-10-29「掉落率可以增加 200%」）；day＝events.dayKey（沒給就當作每次都給，測試用）
export const SKY_COOP_MULT=3;
export function skyLoot(p,b,day,rng,mult=1){
 const x=SKY_BY_ID[b.sky],w=p.flags.sky||={win:{},day:{}},lines=[];w.win[x.id]=(w.win[x.id]||0)+1;
 lines.push(`打倒了${x.name}！（第 ${w.win[x.id]} 次）`);
 if(day!=null&&w.day[x.id]===day){lines.push(`今天已經拿過${x.name}的掉落了，這次只有經驗。`);return {lines,got:[]};}
 if(day!=null)w.day[x.id]=day;
 const got=[...Array((x.final?1:rng.int(2,3))*mult).fill(x.mat),...Array(mult).fill(R.SHARD)];
 return {lines,got};
}
export const skyLootInfo=(x,m=SKY_COOP_MULT)=>x.final?`掉落：天空之核 ${m}、水晶碎片 ${m}（每人每天第一次打贏）`:`掉落：${ITEMS[x.mat].name} ${2*m}～${3*m}、水晶碎片 ${m}（每人每天第一次打贏）`;
// 王戰的獎勵：王的掉落拿兩份、水晶碎片多一片、試煉徽章 1～2 個（Leo 2026-10-29，做特化裝）、每座第一次打贏另外給一顆王等級÷4 級的寶石
export function raidLoot(p,d,rng,first=!raidWins(p,d)){const out=[...bossLoot(d,rng),...bossLoot(d,rng),R.SHARD,...Array(rng.int(1,2)).fill('trialBadge')];if(first)out.push(gemId(GRADED_GEMS[rng.int(0,GRADED_GEMS.length-1)],Math.max(1,Math.min(10,Math.round(d.lv/4)))));return out;}
// ---------- 線上組隊打迷宮王（Leo 2026-10-28）：2～5 個線上玩家各帶自己的角色（沒有夥伴、收服者），打同一座王＋護衛隊 ----------
// ◎ 王的生命 ×(0.5＋0.15×人數)、護衛＝人數（最多 5）：三人約等於單人帶滿組的王戰、五人稍難一點
export const COOP_HP=n=>0.5+0.15*n,coopGuardN=n=>Math.min(5,n);
export const coopOpen=(p,d)=>cleared(p,d)>=1; // 隊長要通關過；被邀的沒通關也能跟
// 六曜之塔只能線上組隊打（Leo 2026-10-29「強制一定要兩個人以上組隊才能打」）：◎ 王和護衛的生命 ×(人數÷5)，特殊王的數字本來就是照五人隊試算的；護衛照王自己帶的（李貝留斯 3 個），不隨人數
export const SKY_COOP_HP=n=>Math.max(2,Math.min(5,n))/5;
export const coopTarget=id=>DUNGEON_BY_ID[id]||SKY_BY_ID[id];
// members＝[{uid,name,f:publicOf}...]，第 0 位是隊長；myIdx＝自己是第幾位。每個人自己的畫面上自己叫 'p'、排第一個，其他人用單子上的叫法（R.coopUid）
export function startCoop(members,id,seed,myIdx){
 const d=DUNGEON_BY_ID[id],rng=makeRng(seed),f=R.coopMap(myIdx);
 const party=members.map((m,i)=>{const fi=R.fighterFrom(m.f);if(!fi)return null;const u=R.fullUnit(fi);return {...u,uid:f(R.coopUid(i)),ai:i!==myIdx,row:R.rowOf(u,fi.row),slot:i,pos:i,coopIdx:i};}).filter(Boolean);
 party.sort((a,b)=>(a.uid==='p'?0:1)-(b.uid==='p'?0:1));
 const b=createBattle({party,enemies:[],seed:rng.int(1,2**31),canEscape:myIdx===0});
 R.mudBattle(b);b.coop=id;b.coopN=members.length;
 const x=SKY_BY_ID[id];
 if(x){skyFoes(b,x,rng);const k=SKY_COOP_HP(members.length);for(const u of b.units)if(u.side==='enemy'){u.maxHp=Math.max(1,Math.round(u.maxHp*k));u.hp=u.maxHp;}return b;}
 const top=Math.max(0,...members.map(m=>R.fighterFrom(m.f)?.lv||0));
 return raidFoes(b,d,rng,coopGuardN(members.length),COOP_HP(members.length),raidLv(d,top));
}
// 組隊打完：補滿再打、打完不扣（像擂台），經驗照自己、掉落每座王每天一份（day＝events.dayKey）
export function finishCoop(p,b,day){
 const d=DUNGEON_BY_ID[b.coop],out={lines:[]};
 if(b.over==='lose'){out.lines.push('全隊倒下……被人抬回法蘭城。');return out;}
 if(b.over!=='win'){if(b.over==='escaped')out.lines.push('離開了王的面前。');return out;}
 if(b.sky){const r=skyLoot(p,b,day,makeRng((b.rngState^0x7f4a7c15)>>>0),SKY_COOP_MULT);out.lines.push('組隊勝利！',...r.lines,...R.coopGain(p,b));for(const id of r.got)addMat(p,id);if(r.got.length)out.lines.push(`撿到材料：${r.got.map(id=>ITEMS[id].name).join('、')}。`);return out;}
 out.lines.push(`組隊勝利！打倒了${d.boss}和護衛隊。`);if(bossLine(d))out.lines.push(bossLine(d));out.lines.push(...R.coopGain(p,b));
 const w=p.flags.coop||={n:{},day:{}};
 if(w.day[d.id]===day){out.lines.push('今天這座王的獎勵已經領過了，這次只有經驗。');return out;}
 const got=raidLoot(p,d,makeRng((b.rngState^0x27d4eb2f)>>>0),!w.n[d.id]);w.n[d.id]=(w.n[d.id]||0)+1;w.day[d.id]=day;
 for(const id of got)addMat(p,id);out.lines.push(`撿到材料：${got.map(id=>ITEMS[id].name).join('、')}。`);
 return out;
}
// ◎ 王的掉落：寶石必掉一顆（一般寶石隨機，等級約王的等級÷5，上下差 1）；19 級以上的王 60% 掉鋼騎之礦或魔族的水晶；
//   31 級以上的王 2%×(等級−20) 掉一件生鏽／破爛的裝備（原作海神才掉）
export function bossLoot(d,rng){
 const out=[],types=GRADED_GEMS,g=Math.max(1,Math.min(10,Math.round(d.lv/5)+rng.int(-1,1)));
 out.push(gemId(types[rng.int(0,types.length-1)],g));out.push(R.SHARD); // 王一定掉一片水晶碎片
 // ◎ 5% 另外掉一顆任務／活動／寵物寶石（等級不超過王的寶石等級＋1）
 if(rng.chance(5)){const sp=Object.keys(GEM_TYPES).filter(t=>t!=='mouse').flatMap(t=>GEM_TYPES[t].fixed?GEM_TYPES[t].fixed.filter(x=>x<=g+1).map(x=>gemId(t,x)):[]);if(sp.length)out.push(sp[rng.int(0,sp.length-1)]);}
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
// 頁面上列掉落（Leo 2026-10-28「各關副本、迷宮王顯示掉落物」）：照 bossLoot、materialDrops、dropsFor、rivalLoot 的規則寫成字
export function lootInfo(d){
 const g=Math.max(1,Math.min(10,Math.round(d.lv/5))),gl=`${Math.max(1,g-1)}～${Math.min(10,g+1)}`;
 const boss=[`寶石 ${gl} 級一顆`,'水晶碎片一片','5% 任務／活動寶石',...(d.lv>=19?['60% 鋼騎之礦或魔族的水晶']:[]),...(d.lv>=31?[`${Math.min(100,2*(d.lv-20))}% 生鏽／破爛裝備`]:[])];
 const lo=d.monLv[0],hi=d.monLv[1],t1=tierOf(lo),t2=tierOf(hi),mats=[...new Set([t1,t2].flatMap(t=>[METAL[t],WOOD[t],LEATHER[t]]))].map(id=>ITEMS[id].name);
 const cr=[...new Set([crystalOf(lo),crystalOf(hi)])].map(id=>ITEMS[id].name);
 const floor=[`魔石（${cr.join('、')}）`,`材料 ${mats.join('、')}`,...(hi>=30?['幻之鋼條／朴／百里香']:[]),'水晶碎片 6%','回復藥 6%'];
 const rg=Math.max(1,Math.min(10,Math.round(hi*0.75/8)));
 const rival=d.lv>=10?`敵對冒險者：金幣、${RIVAL_GEM_PCT}% 約 ${rg} 級寶石`:'';
 return {boss:'王：'+boss.join('、'),floor:'樓層：'+floor.join('、'),rival,raid:`迷宮王：王的掉落兩份＋水晶碎片一片＋試煉徽章 1～2 個，第一次打贏另送 ${Math.max(1,Math.min(10,Math.round(d.lv/4)))} 級寶石`};
}
export function finishFight(p,b,day=null){
 const out=R.finishHunt(p,b);
 if(b.over==='win'){
  if(b.sky){const r=skyLoot(p,b,day,makeRng((b.rngState^0x7f4a7c15)>>>0));out.lines.push(...r.lines);for(const id of r.got)addMat(p,id);if(r.got.length)out.lines.push(`撿到材料：${r.got.map(id=>ITEMS[id].name).join('、')}。`);return out;}
  const rl=rivalLoot(b,makeRng((b.rngState^0x3c6ef372)>>>0)),got=[...materialDrops(b),...rl.gems];
  if(rl.gold){p.gold+=rl.gold;out.lines.push(`從冒險者身上搜到 ${rl.gold} 金。`);}
  for(const id of rl.items)if(P.addItem(p,id))out.lines.push(`撿到${ITEMS[id].name}。`);
  const d=b.dg&&DUNGEON_BY_ID[b.dg],boss=d&&b.floor>=FLOORS,rd=b.raid&&DUNGEON_BY_ID[b.raid];
  if(boss)got.push(...bossLoot(d,makeRng((b.rngState^0x68e31da4)>>>0)));
  if(rd){got.push(...raidLoot(p,rd,makeRng((b.rngState^0x1b873593)>>>0)));p.flags.raid={...(p.flags.raid||{}),[rd.id]:raidWins(p,rd)+1};out.lines.push(`王戰勝利！打倒了${rd.boss}和護衛隊（第 ${raidWins(p,rd)} 次）。`);if(bossLine(rd))out.lines.push(bossLine(rd));out.raidWin=true;}
  for(const id of got)addMat(p,id);
  if(got.length)out.lines.push(`撿到材料：${got.map(id=>ITEMS[id].name).join('、')}。`);
  if(d){
   if(boss){p.flags.dg={...(p.flags.dg||{}),[d.id]:cleared(p,d)+1};for(const [q,id] of Object.entries(PROMOTE_DUNGEON))if(id===d.id)p.flags[q]=true;p.dg=null;out.lines.push(`打倒了${d.boss}！${d.name}通關。`);if(bossLine(d))out.lines.push(bossLine(d));out.cleared=true;}
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
