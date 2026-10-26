// 文字版擂台的地下城與打造（Leo 2026-10-26）。不碰畫面。
// ◎ 裝備改成打造：武器店、防具店只賣國民裝備；其他裝備拿材料和工錢給工房師傅做。材料打怪掉（原作是採集，這裡沒有採集職業）。
//   配方照本作 recipes.mjs 的算法（主材料 4＋2×裝備等級個、副材料 1 個；材料階級＝裝備等級），短刀比照劍用礦石。
// ◎ 地下城：15 座，每座 3 層，前兩層是魔物，第三層是王。生命魔力一路帶著走，打完一層可以撤退。
//   王是電腦操作的人物（跟擂台的對手一樣，一回合兩動），生命加倍；打倒會掉寶石和水龍系列素材，拿去打造水龍系列裝備。
//   王的名字是 Leo 給的；地下城名、王的職業等級、寶石與水龍素材的名字和數字都是自訂。
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import {createBattle,foes} from '../core/battle.mjs';
import {makeRng} from '../core/rng.mjs';
import {ITEMS} from '../data/items.mjs';
import {GENERAL_BY_ID} from './generals.mjs';

const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

// ---------- 寶石、水龍素材、水龍系列裝備（只有文字版擂台有，載入時加進道具表） ----------
const GEMS={gemRed:['紅寶石','火'],gemBlue:['藍寶石','水'],gemGreen:['綠寶石','風'],gemYellow:['黃寶石','地']};
const DRAGON_MATS={dragonFang:['水龍之牙','做水龍系列兵器的主材料。'],dragonScale:['水龍之鱗','做水龍系列防具的主材料。']};
export const MUD_ITEMS={
 ...Object.fromEntries(Object.entries(GEMS).map(([id,[name,el]])=>[id,{name,kind:'material',gem:true,tier:4,sell:300,desc:`帶著${el}屬性光芒的寶石，地下城的王身上才找得到。打造水龍系列要用。`}])),
 ...Object.fromEntries(Object.entries(DRAGON_MATS).map(([id,[name,desc]])=>[id,{name,kind:'material',dragon:true,tier:4,sell:500,desc:`${desc}地下城的王身上才找得到。`}])),
 // 水龍系列：4 級（見習就穿得上），比同級的打造品強三成左右
 dragonSword:{name:'水龍劍',kind:'weapon',slot:'weapon',type:'sword',lv:4,price:9000,atk:88,dragon:true},
 dragonAxe:{name:'水龍斧',kind:'weapon',slot:'weapon',type:'axe',lv:4,price:9000,atk:98,agi:-3,dragon:true},
 dragonSpear:{name:'水龍槍',kind:'weapon',slot:'weapon',type:'spear',lv:4,price:9000,atk:92,dragon:true},
 dragonBow:{name:'水龍弓',kind:'weapon',slot:'weapon',type:'bow',lv:4,price:9000,atk:78,dragon:true},
 dragonStaff:{name:'水龍杖',kind:'weapon',slot:'weapon',type:'staff',lv:4,price:9000,atk:22,spr:20,matk:130,dragon:true},
 dragonDagger:{name:'水龍短刀',kind:'weapon',slot:'weapon',type:'dagger',lv:4,price:9000,atk:60,agi:20,dragon:true},
 dragonMail:{name:'水龍鎧',kind:'armor',slot:'body',armor:'heavy',lv:4,price:9000,def:65,agi:-2,dragon:true},
 dragonCloth:{name:'水龍衣',kind:'armor',slot:'body',armor:'light',lv:4,price:9000,def:40,agi:6,dragon:true},
 dragonRobe:{name:'水龍袍',kind:'armor',slot:'body',armor:'robe',lv:4,price:9000,def:28,spr:20,dragon:true},
 dragonHelm:{name:'水龍盔',kind:'armor',slot:'head',armor:'heavy',lv:4,price:6000,def:14,dragon:true},
 dragonHood:{name:'水龍頭巾',kind:'armor',slot:'head',armor:'light',lv:4,price:6000,def:9,agi:3,dragon:true},
 dragonHat:{name:'水龍帽',kind:'armor',slot:'head',armor:'robe',lv:4,price:6000,def:6,spr:7,dragon:true},
 dragonBoots:{name:'水龍靴',kind:'armor',slot:'feet',lv:4,price:6000,def:12,agi:4,dragon:true},
};
for(const [id,it] of Object.entries(MUD_ITEMS))ITEMS[id]??=it;

// ---------- 材料與配方 ----------
const METAL=[,'copper','ironOre','silver','goldOre'],WOOD=[,'pine','oak','cypress','ebony'],LEATHER=[,'hide','hide','marten','tigerSkin'];
export const tierOf=lv=>lv<8?1:lv<18?2:lv<30?3:4; // ◎ 魔物等級 → 掉的材料階級
function mats(it){
 const L=it.lv,n=4+2*L;
 if(it.slot==='weapon'){
  if(it.type==='bow')return [[WOOD[L],n],[LEATHER[L],1]];
  if(it.type==='staff')return [[WOOD[L],n],[METAL[L],1]];
  return [[METAL[L],n],[WOOD[L],1]];
 }
 if(it.armor==='heavy')return [[METAL[L],n],[LEATHER[L],1]];
 if(it.slot==='feet'||it.slot==='head')return [[LEATHER[L],Math.max(2,n-3)]];
 return it.armor==='robe'?[[LEATHER[L],n-1],[WOOD[L],1]]:[[LEATHER[L],n]];
}
function dragonMats(it){
 if(it.slot==='weapon')return [['dragonFang',3],['gemRed',1],[it.type==='bow'||it.type==='staff'?'ebony':'goldOre',4]];
 if(it.slot==='body')return [['dragonScale',3],['gemBlue',1],['tigerSkin',4]];
 return [['dragonScale',2],[it.slot==='head'?'gemGreen':'gemYellow',1],['tigerSkin',2]];
}
// 一般裝備：4 級以下（還沒有晉級，見習穿不上更高的）
export const RECIPES=Object.fromEntries(Object.entries(ITEMS).filter(([,it])=>it.slot&&!it.cheap&&it.lv<=4)
 .map(([id,it])=>[id,{mats:it.dragon?dragonMats(it):mats(it),fee:it.dragon?2000:Math.round(it.price/20)}])); // ◎ 工錢：一般裝備是商店行情的 5%（1 級主裝備 75 金）
export const recipeKind=id=>ITEMS[id].dragon?'dragon':ITEMS[id].slot==='weapon'?'weapon':'armor';
export function canForge(p,id){
 const r=RECIPES[id];if(!r)return no('');
 const lack=r.mats.filter(([m,n])=>P.countItem(p,m)<n).map(([m,n])=>`${ITEMS[m].name}還差 ${n-P.countItem(p,m)}`);
 if(lack.length)return no(lack.join('、')+'。');
 if(p.gold<r.fee)return no(`工錢要 ${r.fee} 金。`);
 return yes('');
}
export function forge(p,id){
 const c=canForge(p,id);if(!c.ok)return c;const r=RECIPES[id];
 // 材料拿走以後道具欄一定空得出位置（主材料至少一整格）
 for(const [m,n] of r.mats)P.removeItem(p,m,n);p.gold-=r.fee;P.addItem(p,id);
 return yes(`工房師傅替你打好了${ITEMS[id].name}。`);
}

// ---------- 打怪掉材料 ----------
// ◎ 每隻魔物 50% 掉一個材料（礦石、木材、毛皮各三分之一），階級看魔物等級
export function materialDrops(b){
 const rng=makeRng((b.rngState^0x2545f491)>>>0),out=[];
 for(const e of foes(b))if(e.kind==='monster'&&rng.chance(50)){const t=tierOf(e.lv);out.push([METAL,WOOD,LEATHER][rng.int(0,2)][t]);}
 return out;
}

// ---------- 地下城 ----------
// [王的名字, 等級, 職業, 武將立繪, 屬性]
const BOSSES=[
 ['楓楓洋洋',4,'sword','xiaoqiao',{wind:10}],['祖師爺',7,'priest','huangyueying',{earth:10}],['火龍',10,'mage','zhurong',{fire:10}],
 ['左青龍又胖虎',13,'axe','zhangfei',{earth:5,water:5}],['君子',16,'spear','jiangwei',{wind:10}],['Damonk',19,'fighter','taishici',{fire:5,wind:5}],
 ['Soduk',22,'guard','caoren',{earth:10}],['淡然',25,'wizard','luxun',{water:10}],['CUTIE',28,'bow','sunshangxiang',{fire:10}],
 ['宰羊拿鐵的QQ',31,'assassin','zhenji',{water:5,fire:5}],['顧家',34,'sorcerer','guojia',{wind:5,earth:5}],['阿宏',37,'axe','xuhuang',{earth:10}],
 ['笑死人',40,'sword','sunce',{fire:10}],['陳小白',43,'mage','daqiao',{water:10}],['我來解任務的',46,'spear','machao',{wind:10}],
];
// 地下城的魔物：照等級挑（只用畫面上有動作圖的）
const MON_BANDS=[[10,['bat','wolf','bee','rat']],[20,['rat','bronze','thief','lancer','brute']],[30,['sapling','redWolf','thief','lancer','brute','tiger']],[99,['tiger','lynx','zombie','gargoyle','redWolf']]];
export const FLOORS=3;
export const BOSS_HP=1.5; // ◎ 王的生命倍數（試算：跟王同等級、穿同級打造裝，一個人打物理系約一到九成，看王的職業；帶夥伴約五成以上）
export const DUNGEONS=BOSSES.map(([boss,lv,job,look,elem],i)=>({id:'d'+(i+1),n:i+1,name:boss.endsWith('的')?`${boss}地下城`:`${boss}的地下城`,boss,lv,job,look,elem,
 mons:MON_BANDS.find(([max])=>lv<max)[1],monLv:[Math.max(1,lv-4),Math.max(1,lv-1)],needLv:Math.max(1,lv-3)}));
export const DUNGEON_BY_ID=Object.fromEntries(DUNGEONS.map(d=>[d.id,d]));
export const dungeonOpen=(p,d)=>p.lv>=d.needLv?yes(''):no(`要 ${d.needLv} 級。`);
export const cleared=(p,d)=>p.flags?.dg?.[d.id]||0;

// 進地下城：從第 1 層開始；p.dg 記著走到哪（關掉網頁再回來可以接著打）
export function enterDungeon(p,id){const d=DUNGEON_BY_ID[id];if(!d)return no('');const o=dungeonOpen(p,d);if(!o.ok)return o;p.dg={id,floor:1};return yes(`走進${d.name}。`);}
export function leaveDungeon(p){p.dg=null;}
export function bossFighter(d){const f=R.buildFighter(d.lv,d.job,d.look,d.boss,d.elem,1000+d.n);f.name=d.boss;return f;}
export function startFloor(p,seed){
 const d=DUNGEON_BY_ID[p.dg.id],rng=makeRng(seed),mate=p.mate&&p.mate.hp>0;
 const party=[R.myUnit(p),...(mate?[R.mateUnit(p)]:[])];
 if(p.dg.floor<FLOORS){
  const cap=p.lv<=R.NEWBIE_LV?1:mate?3:2,n=rng.int(1,cap); // ◎ 地下城一群：一個人最多 2 隻、帶夥伴 3 隻
  const enemies=[];for(let i=0;i<n;i++)enemies.push([d.mons[rng.int(0,d.mons.length-1)],rng.int(...d.monLv)]);
  const b=createBattle({party,enemies,seed:rng.int(1,2**31),canEscape:true});b.mods=R.MODS;b.dg=d.id;b.floor=p.dg.floor;return b;
 }
 const b=createBattle({party,enemies:[],seed:rng.int(1,2**31),canEscape:false});b.mods=R.MODS;b.dg=d.id;b.floor=p.dg.floor;b.pvp=true; // 王全力出手
 const u=R.fullUnit(bossFighter(d));u.maxHp*=BOSS_HP;u.hp=u.maxHp;
 b.units.push({...u,uid:'e0',side:'enemy',ai:true,boss:true,mon:'chief',row:'back',slot:0,alive:true,defending:false,skip:0,down:null,st:null});
 return b;
}
// ◎ 王的掉落：寶石必掉一顆（四種隨機）；水龍素材機率 20%＋2%×王的等級（最多 90%）；25 級以上的王再多擲一次
export function bossLoot(d,rng){
 const out=[],gems=Object.keys(GEMS),mats=Object.keys(DRAGON_MATS);
 for(let k=0;k<(d.lv>=25?2:1);k++){out.push(gems[rng.int(0,3)]);if(rng.chance(Math.min(90,20+2*d.lv)))out.push(mats[rng.int(0,1)]);}
 return out;
}
// 練功、地下城打完一場：照 rules.finishHunt 算經驗、掉落、受傷，再加材料；地下城另外處理樓層和王的掉落
export function finishFight(p,b){
 const out=R.finishHunt(p,b);
 if(b.over==='win'){
  const got=[...materialDrops(b)];
  const d=b.dg&&DUNGEON_BY_ID[b.dg],boss=d&&b.floor>=FLOORS;
  if(boss)got.push(...bossLoot(d,makeRng((b.rngState^0x68e31da4)>>>0)));
  const kept=[],lost=[];for(const id of got)(P.addItem(p,id)?kept:lost).push(ITEMS[id].name);
  if(kept.length)out.lines.push(`撿到材料：${kept.join('、')}。`+(lost.length?`（道具欄滿了，${lost.join('、')}丟在地上）`:''));
  if(d){
   if(boss){p.flags.dg={...(p.flags.dg||{}),[d.id]:cleared(p,d)+1};p.dg=null;out.lines.push(`打倒了${d.boss}！${d.name}通關。`);out.cleared=true;}
   else{p.dg={id:d.id,floor:b.floor+1};out.next=b.floor+1;}
  }
 }else if(b.dg){p.dg=null;if(b.over==='escaped')out.lines.push('逃出了地下城。');}
 return out;
}
export const bossLook=d=>GENERAL_BY_ID[d.look];
