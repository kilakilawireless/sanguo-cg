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
import {ITEMS} from '../data/items.mjs';
import {QUEST_NAMES} from '../core/player.mjs';
import {GENERAL_BY_ID} from './generals.mjs';
import {rankName} from '../data/jobs.mjs';
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
 dragonDagger:D7('水龍的小刀','weapon',{type:'dagger',atk:130,hit:25},'rustyDagger','phantomBar',10),
 dragonShield:D7('水龍之盾','shield',{atk:20,def:100,dodge:-5},'rustyShield','phantomBar',10),
 dragonHelm:D7('水龍之盔','head',{armor:'heavy',def:110},'rustyHelm','phantomBar',10),
 dragonHat:D7('水龍之帽','head',{armor:'robe',def:53,spr:20,hit:5},'ragHat','lingzhi',20),
 dragonMail:D7('水龍鎧甲','body',{armor:'heavy',def:170},'rustyMail','phantomBar',20),
 dragonCloth:D7('水龍之衣','body',{armor:'light',def:30,dodge:80},'ragCloth','lingzhi',20),
 dragonRobe:D7('水龍法袍','body',{armor:'robe',def:70,mp:500},'ragRobe','pu',20),
 dragonBoots:D7('水龍之靴','feet',{def:100,crit:5,hit:5,mp:150},'ragBoots','phantomBar',10),
 dragonShoes:D7('水龍之鞋','feet',{def:30,agi:30,hit:2,dodge:2},'ragShoes','pu',10),
};
// ---------- 寶石（原作第一組，10 個等級） ----------
const GRADES=['的碎片','破損的很嚴重的','破破的','有點破損的','','還不錯的','優良的','非常優良的','接近完美的','完全結晶體的'];
const gradeName=(gem,g)=>g===1?gem+'的碎片':GRADES[g-1]+gem;
const pct=(v,n)=>Math.round((v||0)*n/100);
// 每顆寶石加在兵器上、防具上的效果（g＝等級 1～10）
export const GEM_TYPES={
 yellow:{name:'黃寶石',w:(it,g)=>({crit:g,atk:-pct(it.atk,2*g)}),a:(it,g)=>({counter:g,def:-pct(it.def,2*g)}),wt:'必殺＋、攻擊－',at:'反擊＋、防禦－'},
 green:{name:'綠寶石',w:(it,g)=>({crit:g,counter:-g}),a:(it,g)=>({crit:-g,counter:g}),wt:'必殺＋、反擊－',at:'反擊＋、必殺－'},
 blue:{name:'藍寶石',w:(it,g)=>({atk:pct(it.atk,1+2*g)}),a:(it,g)=>({hit:-g,def:pct(it.def,1+2*g)}),wt:'攻擊＋%',at:'防禦＋%、命中－'},
 star:{name:'冒險之星',w:(it,g)=>({atk:pct(it.atk,8+2*g)}),a:(it,g)=>({def:pct(it.def,8+2*g)}),wt:'攻擊＋%',at:'防禦＋%'},
 amethyst:{name:'紫水晶',w:(it,g)=>({def:8*g,atk:pct(it.atk,g)}),a:(it,g)=>({atk:4*g,def:pct(it.def,g)}),wt:'防禦＋、攻擊＋%',at:'攻擊＋、防禦＋%'},
 knight:{name:'騎士寶石',w:(it,g)=>({hit:g,atk:-pct(it.atk,2*g)}),a:(it,g)=>({dodge:g,def:-pct(it.def,2*g)}),wt:'命中＋、攻擊－',at:'閃躲＋、防禦－'},
};
const gemId=(t,g)=>`gem_${t}_${g}`;
export const parseGem=id=>{const m=/^gem_([a-z]+)_(\d+)$/.exec(id||'');return m&&GEM_TYPES[m[1]]&&+m[2]>=1&&+m[2]<=10?{t:m[1],g:+m[2]}:null;};
export const MUD_ITEMS={
 ...CG_GEAR,
 ...Object.fromEntries(RUSTY.map(([id,name])=>[id,{name,kind:'material',tier:7,sell:300,desc:'帶著海神魔力的舊裝備，打造水龍系列的底子。31 級以上的地下城王身上找得到。'}])),
 knightOre:{name:'鋼騎之礦',kind:'material',tier:7,sell:200,desc:'打造水龍系列要用。地下城的王身上找得到。'},
 demonCrystal:{name:'魔族的水晶',kind:'material',tier:7,sell:200,desc:'打造水龍系列要用。地下城的王身上找得到。'},
 phantomBar:{name:'幻之鋼條',kind:'material',tier:7,sell:60,desc:'打造水龍系列兵器、鎧甲的主材料。30 級以上的魔物會掉。'},
 pu:{name:'朴',kind:'material',tier:7,sell:50,desc:'打造水龍系列弓、杖、法袍、鞋的主材料。30 級以上的魔物會掉。'},
 ...Object.fromEntries(Object.keys(GEM_TYPES).flatMap(t=>Array.from({length:10},(_,i)=>[gemId(t,i+1),{name:gradeName(GEM_TYPES[t].name,i+1),kind:'material',gem:t,grade:i+1,sell:40*(i+1)**2,
  desc:`打造時加進去：兵器${GEM_TYPES[t].wt}，防具${GEM_TYPES[t].at}。等級 ${i+1}／10。`}]))),
 ...Object.fromEntries(Object.entries(DRAGON).map(([id,it])=>[id,(({recipe,...x})=>x)(it)])),
};
for(const [id,it] of Object.entries(MUD_ITEMS))ITEMS[id]??=it;
// 加了寶石的裝備：代號是「裝備@寶石」，讀檔、看別人的裝備、交易所遇到時才建出來
export function ensureItem(id){
 if(!id||ITEMS[id])return !!ITEMS[id];
 const [base,gem]=String(id).split('@'),it=ITEMS[base],gm=parseGem(gem);if(!it?.slot||!gm||String(base).includes('@'))return false;
 const ty=GEM_TYPES[gm.t],mod=(it.slot==='weapon'?ty.w:ty.a)(it,gm.g),out={...it,name:`${it.name}（${ty.name}${gm.g}）`,gemmed:gem,price:it.price};
 for(const [k,v] of Object.entries(mod))out[k]=(out[k]||0)+v;
 ITEMS[id]=out;return true;
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
// 工房做得出來的：原作裝備（gear.mjs，1～11 級）和水龍系列
export const RECIPES=Object.fromEntries(Object.entries(ITEMS).filter(([id,it])=>CG_GEAR[id]||DRAGON[id])
 .map(([id,it])=>[id,{mats:DRAGON[id]?DRAGON[id].recipe:mats(it),fee:DRAGON[id]?3000:Math.round(it.price/20)}])); // ◎ 工錢：一般裝備是商店行情的 5%（1 級主裝備 75 金），水龍系列 3000
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
export function forge(p,id,gem){
 const c=canForge(p,id,gem);if(!c.ok)return c;const r=RECIPES[id];
 for(const [m,n] of r.mats)takeMat(p,m,n);if(gem)takeMat(p,gem,1);p.gold-=r.fee;
 const out=gem?withGem(id,gem):id;P.addItem(p,out);
 return yes(`工房師傅替你打好了${ITEMS[out].name}。`);
}

// ---------- 打怪掉材料 ----------
// ◎ 每隻魔物 50% 掉一個材料（礦石、木材、毛皮各三分之一），階級看魔物等級；30 級以上的魔物另外 25% 掉幻之鋼條、朴或百里香
export function materialDrops(b){
 const rng=makeRng((b.rngState^0x2545f491)>>>0),out=[];
 for(const e of foes(b)){if(e.kind!=='monster')continue;
  if(rng.chance(50))out.push([METAL,WOOD,LEATHER][rng.int(0,2)][tierOf(e.lv)]);
  if(e.lv>=30&&rng.chance(25))out.push(['phantomBar','pu','lingzhi'][rng.int(0,2)]);}
 return out;
}

// ---------- 地下城 ----------
// [代號, 王的名字, 職業, 武將立繪, 屬性, 第二個王（有的話）]；順序＝難度（Leo 2026-10-26 排的），等級從 4 起每座 +3
// 代號固定不跟著順序變（存檔的通關次數、打到一半的進度都記代號）
const BOSSES=[
 ['d1','楓楓洋洋','sword','xiaoqiao',{wind:10}],['d13','笑死人','sword','sunce',{fire:10}],['d3','火龍','mage','zhurong',{fire:10}],
 ['d4','左青龍又胖虎','axe','zhangfei',{earth:5,water:5}],['d5','君子','spear','jiangwei',{wind:10}],['d6','Damonk','fighter','taishici',{fire:5,wind:5}],
 ['d7','Soduk','guard','caoren',{earth:10}],['d8','淡然','wizard','luxun',{water:10}],['d16','小吃','fighter','diaochan',{wind:10}],
 ['d10','宰羊拿鐵的QQ','assassin','zhenji',{water:5,fire:5}],['d11','顧家','sorcerer','guojia',{wind:5,earth:5}],['d17','鮭魚','bow','huangzhong',{water:10}],
 ['d12','阿宏','axe','xuhuang',{earth:10}],['d2','祖師爺','priest','huangyueying',{earth:10}],['d9','CUTIE','bow','sunshangxiang',{fire:10}],
 ['d15','我來解任務的','spear','machao',{wind:10}],['d14','陳小白','mage','daqiao',{water:10},['KLY','guard','dianwei',{earth:10}]],['d18','學測','sorcerer','xunyu',{earth:5,water:5}],
];
// 地下城的魔物：照等級挑（只用畫面上有動作圖的）
const MON_BANDS=[[10,['bat','wolf','bee','rat']],[20,['rat','bronze','thief','lancer','brute']],[30,['sapling','redWolf','thief','lancer','brute','tiger']],[99,['tiger','lynx','zombie','gargoyle','redWolf']]];
export const FLOORS=3;
export const BOSS_HP=1.5,PAIR_HP=1; // ◎ 王的生命倍數（試算：跟王同等級、穿同級打造裝，一個人打物理系約一到九成，看王的職業；帶夥伴約五成以上）
export const DUNGEONS=BOSSES.map(([id,boss1,job,look,elem,pair],i)=>{const lv=4+3*i,boss=pair?`${boss1}與${pair[0]}`:boss1;return {id,n:i+1,name:boss.endsWith('的')?`${boss}地下城`:`${boss}的地下城`,boss,boss1,lv,job,look,elem,pair,
 mons:MON_BANDS.find(([max])=>lv<max)[1],monLv:[Math.max(1,lv-4),Math.max(1,lv-1)],needLv:Math.max(1,lv-3)};});
export const DUNGEON_BY_ID=Object.fromEntries(DUNGEONS.map(d=>[d.id,d]));
export const dungeonOpen=(p,d)=>p.lv>=d.needLv?yes(''):no(`要 ${d.needLv} 級。`);
export const cleared=(p,d)=>p.flags?.dg?.[d.id]||0;

// 進地下城：從第 1 層開始；p.dg 記著走到哪（關掉網頁再回來可以接著打）
export function enterDungeon(p,id){const d=DUNGEON_BY_ID[id];if(!d)return no('');const o=dungeonOpen(p,d);if(!o.ok)return o;p.dg={id,floor:1};return yes(`走進${d.name}。`);}
export function leaveDungeon(p){p.dg=null;}
export function bossFighter(d,second=false){const [name,job,look,elem]=second?d.pair:[d.boss1,d.job,d.look,d.elem];const f=R.buildFighter(d.lv,job,look,name,elem,1000+d.n+(second?500:0));f.name=name;return f;}
export function startFloor(p,seed){
 const d=DUNGEON_BY_ID[p.dg.id],rng=makeRng(seed),mate=p.mate&&p.mate.hp>0;
 const party=[R.myUnit(p),...(mate?[R.mateUnit(p)]:[])];
 if(p.dg.floor<FLOORS){
  const cap=p.lv<=R.NEWBIE_LV?1:mate?3:2,n=rng.int(1,cap); // ◎ 地下城一群：一個人最多 2 隻、帶夥伴 3 隻
  const enemies=[];for(let i=0;i<n;i++)enemies.push([d.mons[rng.int(0,d.mons.length-1)],rng.int(...d.monLv)]);
  const b=createBattle({party,enemies,seed:rng.int(1,2**31),canEscape:true});b.mods=R.MODS;b.dg=d.id;b.floor=p.dg.floor;return b;
 }
 const b=createBattle({party,enemies:[],seed:rng.int(1,2**31),canEscape:false});b.mods=R.MODS;b.dg=d.id;b.floor=p.dg.floor;b.pvp=true; // 王全力出手
 // 兩個王的地下城（陳小白與 KLY）：兩個都是一般生命（◎ PAIR_HP），一前一後站
 for(const [i,second] of (d.pair?[[0,false],[1,true]]:[[0,false]])){const u=R.fullUnit(bossFighter(d,second));u.maxHp=Math.round(u.maxHp*(d.pair?PAIR_HP:BOSS_HP));u.hp=u.maxHp;
  b.units.push({...u,uid:'e'+i,side:'enemy',ai:true,boss:true,mon:'chief',row:second?'front':'back',slot:0,alive:true,defending:false,skip:0,down:null,st:null});}
 return b;
}
// ◎ 王的掉落：寶石必掉一顆（六種隨機，等級約王的等級÷5，上下差 1）；19 級以上的王 60% 掉鋼騎之礦或魔族的水晶；
//   31 級以上的王 2%×(等級−20) 掉一件生鏽／破爛的裝備（原作海神才掉）
export function bossLoot(d,rng){
 const out=[],types=Object.keys(GEM_TYPES),g=Math.max(1,Math.min(10,Math.round(d.lv/5)+rng.int(-1,1)));
 out.push(gemId(types[rng.int(0,types.length-1)],g));
 if(d.lv>=19&&rng.chance(60))out.push(rng.chance(50)?'knightOre':'demonCrystal');
 if(d.lv>=31&&rng.chance(2*(d.lv-20)))out.push(RUSTY[rng.int(0,RUSTY.length-1)][0]);
 return out;
}
// 晉級任務 ◎：原作的晉級任務改成通關指定的地下城
export const PROMOTE_DUNGEON={treant:'d6',beast:'d15'}; // Damonk（19 級）、我來解任務的（49 級）
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
  const got=[...materialDrops(b)];
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
export const bossLabel=d=>[[d.boss1,d.job],...(d.pair?[[d.pair[0],d.pair[1]]]:[])].map(([n,j])=>`${n}（Lv${d.lv} ${rankName(j,0)}）`).join('、');
// 材料整組賣給道具店
export function sellMat(p,id){const n=p.mats?.[id]||0;if(!n)return no('');const g=(ITEMS[id].sell||0)*n;delete p.mats[id];p.gold+=g;return yes(`賣掉${ITEMS[id].name} ×${n}，得到 ${g} 金。`);}
