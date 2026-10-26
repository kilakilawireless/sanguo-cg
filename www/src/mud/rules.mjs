// 文字版擂台（MUD）的規則：角色、BP、職業、技能、裝備、戰鬥公式全部用本作的 core/ 與 data/，這裡只把它們接成文字遊戲。
// 不碰畫面。跟單機版不同的地方都標 ◎：
//  ◎ 就職不走試煉洞窟，到公會直接就職（轉職一樣付 1000 金、聲望歸零）；晉級之後再開放
//  ◎ 一次只能派一個角色（不帶寵物、傭兵），所以人物照原作一回合行動兩次；練功一群最多 2 隻
//  ◎ 擂台比武雙方都先補滿生命魔力、打完不扣、不會受傷；30 回合沒分出勝負，比剩下的生命比例
import * as P from '../core/player.mjs';
import {createBattle,resolveRound,rewards,allies,foes,actionsOf} from '../core/battle.mjs';
import {applyInjury} from '../core/injury.mjs';
import {makeRng} from '../core/rng.mjs';
import {BP_KEYS,singleCapAt,totalBpAt,expFor,ELEM_NAMES} from '../core/stats.mjs';
import {JOBS,gearCap} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS,SHOPS,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {GENERAL_BY_ID} from './generals.mjs';

const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

// 能就職的職業：戰鬥系裡不靠寵物、隊友的（封印師、馴獸師要寵物，之後再開）
export const MUD_JOBS=['sword','axe','spear','bow','fighter','guard','assassin','mage','wizard','sorcerer','priest'];
// 只對隊友、寵物有用的技能，一個人出戰學了沒用就不列
const SOLO_USELESS=new Set(['gather','craft','field','capture','rally','cover','revive']);

export function newHero(opts){const r=P.createPlayer(opts);if(!r.ok)return r;r.player.w=0;r.player.l=0;r.player.mud=1;return r;}

export function joinJob(p,id){
 if(!MUD_JOBS.includes(id))return no('');const j=JOBS[id];
 // ◎ 推薦信、神父的問題都省掉：公會直接收人
 const gave=j.letter&&!P.countItem(p,j.letter)&&P.addItem(p,j.letter);if(j.quiz)p.flags.quizPassed=true;
 const r=P.takeJob(p,id);
 if(!r.ok){if(gave)P.removeItem(p,j.letter);if(j.quiz)delete p.flags.quizPassed;}
 return r;
}
// 文字版擂台改過的技能（Leo 2026-10-26，◎）：諸刃每級攻擊 +30%（本作 +7%）、聖盾放一次撐 3 回合（本作只有當回合）
export const MODS={bladeUp:30,wallTurns:3};
const MOD_DESC={
 blade:L=>`攻擊 +${MODS.bladeUp*L}%，自己的防禦與精神 −${SKILLS.blade.selfDown(L)}% 到下回合。`,
 wall:L=>`放一次撐 ${MODS.wallTurns} 回合（含這回合）：受到的物理傷害只剩 ${Math.round(SKILLS.wall.rate(L)*100)}%，被近身打有 ${SKILLS.wall.counter(L)}% 機率反擊。撐著的時候照樣可以攻擊。`};
export const skillDesc=(id,L)=>(MOD_DESC[id]||SKILLS[id].desc)(L);
export const learnable=p=>Object.keys(SKILLS).filter(id=>!SOLO_USELESS.has(SKILLS[id].kind)&&P.capOf(p,id)>0);

// 商店：照職業與職階擋掉不能用的裝備（還是可以買，只是穿不上）
export const shopStock=k=>SHOPS[k].stock.filter(id=>ITEMS[id]);
export function buy(p,id){
 const it=ITEMS[id];if(p.gold<it.price)return no(`錢不夠：要 ${it.price} 金。`);
 if(!P.addItem(p,id))return no('道具欄滿了（20 格）。');p.gold-=it.price;return yes(`買了${it.name}。`);
}
export function sell(p,id){if(ITEMS[id].kind==='key')return no('這個不能賣。');if(!P.removeItem(p,id))return no('');const g=sellPrice(id);p.gold+=g;return yes(`賣掉${ITEMS[id].name}，得到 ${g} 金。`);}
export function sellCrystals(p){let g=0,n=0;for(const x of [...p.bag])if(ITEMS[x.id].kind==='crystal'||ITEMS[x.id].kind==='material'){g+=sellPrice(x.id)*x.n;n+=x.n;P.removeItem(p,x.id,x.n);}
 if(!n)return no('身上沒有魔石或材料。');p.gold+=g;return yes(`賣掉 ${n} 個魔石和材料，得到 ${g} 金。`);}
export const canWear=(p,id)=>P.canEquip(p,id).ok;

// ---------- 練功 ----------
export const SOLO_GROUP_MAX=2; // ◎ 試算：一群最多 3 隻時一個人打芙蕾雅每三場輸一場，2 隻約一成
export const NEWBIE_LV=3; // ◎ Leo 2026-10-26：一開局太難。3 級以前一次只遇 1 隻，怪最多比你高 1 級
export const HUNT_SPOTS=['suburb','trial','camp','forest'];
export function spotOpen(p,id){const pl=PLACES[id];
 if(pl.needJob&&p.job==='none')return no('要先就職才能去。');
 if(pl.needLv&&p.lv<pl.needLv)return no(`要 ${pl.needLv} 級。`);
 return yes();
}
// 遇敵：怪物種類、等級、一群幾隻照地點的設定；洞窟隨機挑一層
export function encounter(spot,rng,heroLv=99){
 const pl=PLACES[spot],floor=pl.floors?rng.int(1,pl.floors):1,table=pl.floorMons?pl.floorMons(floor):pl.mons;
 const cap=heroLv<=NEWBIE_LV?1:SOLO_GROUP_MAX,lvMax=heroLv<=NEWBIE_LV?Math.max(pl.lv[0],Math.min(pl.lv[1],heroLv+1)):pl.lv[1];
 const total=table.reduce((n,[,w])=>n+w,0),n=rng.int(...pl.groups.map(g=>Math.min(cap,g)));
 const out=[];for(let i=0;i<n;i++){let r=rng.next()*total,id=table[0][0];for(const [m,w] of table){r-=w;if(r<0){id=m;break;}}out.push([id,rng.int(pl.lv[0],lvMax)]);}
 return {enemies:out,floor};
}
export const myUnit=p=>({...applyInjury(P.battleUnit(p),p.inj),row:'back',slot:0});
export function startHunt(p,spot,seed){
 const rng=makeRng(seed),{enemies,floor}=encounter(spot,rng,p.lv);
 const b=createBattle({party:[myUnit(p)],enemies,seed:rng.int(1,2**31),canEscape:true});b.mods=MODS;b.spot=spot;b.floor=floor;return b;
}
// 練功結束：照原作算經驗、掉落、技能經驗、聲望、受傷；輸了被抬回醫院剩 1 點生命
export function finishHunt(p,b){
 const me=allies(b)[0],out={lines:[]};
 p.hp=Math.max(b.over==='lose'?1:0,me.hp);p.mp=me.mp;
 const hurt=P.injureParty(p,[me]);for(const [,n] of hurt)out.lines.push(`你受了傷（受傷程度 ${n}），攻擊、防禦都會變差，到醫院治傷。`);
 if(b.over==='lose'){p.hp=1;out.lines.unshift('你倒下了……被人抬回法蘭城的醫院。');return out;}
 if(b.over!=='win')return out;
 const r=rewards(b,p),ups=P.gainExp(p,r.exp);out.lines.push(`得到經驗 ${r.exp}。`);
 if(ups.length)out.lines.push(`升到 ${p.lv} 級！可以分配 ${p.freeBp} 點 BP（狀態頁）。`);
 const lost=[];for(const id of r.items)if(!P.addItem(p,id))lost.push(ITEMS[id].name);
 if(r.items.length)out.lines.push(`撿到${r.items.map(id=>ITEMS[id].name).join('、')}。`+(lost.length?`（道具欄滿了，${lost.join('、')}丟在地上）`:''));
 for(const [id,n] of Object.entries(r.skillGain)){const up=P.addSkillExp(p,id,n);if(up)out.lines.push(`${SKILLS[id].name}升到 Lv${up}！`);}
 const rep=P.gainRep(p,r.rep);if(rep)out.lines.push(`聲望 +${rep}。`);
 return out;
}

// ---------- 擂台 ----------
export const BOUT_ROUNDS=30;
// 別人看得到、拿來打的那一份：只有戰鬥用得到的欄位（道具欄、錢、任務不給看）
export function publicOf(p){
 const keep={name:p.name,look:p.look,lv:p.lv,bp:p.bp,elem:p.elem,luck:p.luck,job:p.job,rank:p.rank,skills:p.skills.map(s=>({id:s.id,lv:s.lv})),equip:p.equip,settings:{row:'back'}};
 return {v:2,name:p.name,look:p.look,lv:p.lv,job:p.job,rank:p.rank,w:p.w||0,l:p.l||0,hero:JSON.stringify(keep),t:Date.now()};
}
// 讀別人的公開資料，壞掉或是舊版（武俠版）的就跳過
export function fighterFrom(doc){
 if(!doc||doc.v!==2)return null;
 try{const f=JSON.parse(String(doc.hero));if(!f?.bp||!JOBS[f.job]||!GENERAL_BY_ID[f.look])return null;
  f.skills=(f.skills||[]).filter(s=>SKILLS[s.id]);for(const k of Object.keys(f.equip||{}))if(f.equip[k]&&!ITEMS[f.equip[k]])f.equip[k]=null;f.bag=[];f.inj=0;return f;}catch{return null;}
}
const fullUnit=f=>{const u=P.battleUnit({...f,hp:0,mp:0,bag:[]});u.hp=u.maxHp;u.mp=u.maxMp;return u;};
export function startBout(p,foe,seed){
 const me={...fullUnit(p),row:'back',slot:0};
 const b=createBattle({party:[me],enemies:[],seed,canEscape:false});b.pvp=true;b.mods=MODS;
 b.units.push({...fullUnit(foe),uid:'e0',side:'enemy',ai:true,row:'back',slot:0,alive:true,defending:false,skip:0,down:null,st:null});
 return b;
}
// 30 回合到了還沒分勝負：剩下的生命比例高的贏（◎）
export function boutTimeout(b){
 if(b.over||b.round<BOUT_ROUNDS)return null;
 const r=u=>u.hp/u.maxHp,me=allies(b)[0],foe=foes(b)[0];
 b.over=r(me)>r(foe)?'win':r(me)<r(foe)?'lose':'draw';return b.over;
}
// 擂台打完：只記勝負。用掉的藥照算（藥是真的喝掉了）
export function finishBout(p,b){if(b.over==='win')p.w=(p.w||0)+1;else if(b.over==='lose')p.l=(p.l||0)+1;}

// ---------- 擂台的常駐好手 ◎（三國名將；等級、職業、配點、配裝都是自訂的，讓擂台不會空著） ----------
// [等級, 職業, 武將]
const NPC=[[2,'sword','liaohua'],[4,'mage','xunyou'],[6,'axe','xuchu'],[8,'priest','huatuo'],[10,'bow','huangzhong'],[13,'fighter','dianwei'],[16,'spear','zhaoyun'],[20,'sorcerer','jiaxu'],[25,'assassin','diaochan'],[30,'wizard','zhouyu'],[35,'axe','guanyu'],[40,'spear','lubu']];
const MAGE_JOBS=new Set(['mage','wizard','sorcerer','priest']);
// 配點比例（體力、力量、強度、速度、魔法）
const BUILD={phys:[.3,.5,.05,.15,0],magic:[.35,0,.05,.1,.5]};
function spendBp(lv,ratio){
 const total=totalBpAt(lv),cap=singleCapAt(lv),bp={};let left=total;
 BP_KEYS.forEach((k,i)=>{const n=Math.min(cap,Math.floor(total*ratio[i]));bp[k]=n;left-=n;});
 for(const k of ['vit','qui','tgh','str','mgc'])while(left>0&&bp[k]<cap){bp[k]++;left--;}
 return bp;
}
export function npcRivals(){
 return NPC.map(([lv,job,gid],i)=>{const name=GENERAL_BY_ID[gid].name;
  const magic=MAGE_JOBS.has(job),bp=spendBp(lv,BUILD[magic?'magic':'phys']);
  // 創角先放 30 點（照比例），升級後的點數直接補上
  const p=newHero({name,look:gid,bp:{vit:10,str:magic?0:15,tgh:0,qui:5,mgc:magic?15:0},elem:[{fire:10},{wind:10},{earth:10},{water:10}][i%4],seed:777+i}).player;
  p.lv=lv;p.exp=expFor(lv);for(const k of BP_KEYS)p.bp[k]=bp[k]*100;p.freeBp=0;
  joinJob(p,job);p.gold=0;
  // 本行技能：等級約每 5 級升一級，不超過見習的上限
  for(const id of JOBS[job].main.filter(id=>!SOLO_USELESS.has(SKILLS[id].kind)).slice(0,3))p.skills.push({id,lv:Math.max(1,Math.min(P.capOf(p,id),1+Math.floor(lv/6))),exp:0});
  if(job==='mage')p.skills=p.skills.filter(s=>s.id.endsWith('1')).slice(0,2);
  // 裝備：商店裡這個職業穿得上、等級跟得上的最好那件
  const gearLv=lv<8?1:lv<18?2:3;
  for(const slot of ['weapon','head','body','feet']){
   const pick=[...shopStock('weapon'),...shopStock('armor')].filter(id=>ITEMS[id].slot===slot&&ITEMS[id].lv<=gearLv&&ITEMS[id].lv<=gearCap(job,0,ITEMS[id])&&gearCap(job,0,ITEMS[id])>0&&!ITEMS[id].cheap)
    .sort((a,b)=>ITEMS[b].lv-ITEMS[a].lv||ITEMS[b].price-ITEMS[a].price)[0];
   if(pick)p.equip[slot]=pick;
  }
  return {key:'npc:'+i,npc:true,...publicOf(p),fighter:p};
 });
}

// ---------- 戰鬥事件 → 文字 ----------
import {STATUS_NAMES} from '../data/skills.mjs';
export function narrate(b,e){
 const n=id=>b.units.find(u=>u.uid===id)?.name||'？';
 switch(e.t){
  case 'round':return {c:'sys',t:`── 第 ${e.n} 回合 ──`};
  case 'act':return e.kind==='skill'?{c:'skill',t:`${n(e.a)}使出${e.name} Lv${e.lv}！`}:e.kind==='defend'?{c:'sys',t:`${n(e.a)}擺出防禦架勢。`}:e.kind==='item'?{c:'heal',t:`${n(e.a)}使用${e.name}。`}:e.confused?{c:'dot',t:`${n(e.a)}混亂中亂打一通！`}:null;
  case 'miss':return {c:'miss',t:`${n(e.d)}閃開了${n(e.a)}的攻擊。`};
  case 'hit':return {c:e.crit?'crit':'hit',t:e.kill?`一擊斃命！${n(e.d)}倒地。`:e.elem?`${n(e.d)}被${ELEM_NAMES[e.elem]}屬性魔法打中，受到 ${e.dmg} 傷害。`
   :`${n(e.a)}${e.counter?'反擊':'打中'}${n(e.d)}，${e.crit?'必殺一擊！':''}造成 ${e.dmg} 傷害。`};
  case 'counter':return {c:'skill',t:`${n(e.a)}趁勢反擊！`};
  case 'cover':return {c:'sys',t:`${n(e.a)}擋在${n(e.d)}前面。`};
  case 'heal':return {c:'heal',t:`${n(e.d)}回復 ${e.n} 生命。`};
  case 'mp':return {c:'heal',t:`${n(e.d)}回復 ${e.n} 魔力。`};
  case 'die':return {c:'lose',t:`${n(e.d)}倒下了。`};
  case 'wake':return {c:'sys',t:`${n(e.d)}被打醒了。`};
  case 'status':return e.ok?{c:'dot',t:`${n(e.d)}${STATUS_NAMES[e.st]}了！`}:{c:'miss',t:`${n(e.d)}沒有${STATUS_NAMES[e.st]}。`};
  case 'stuck':return {c:'dot',t:`${n(e.a)}${STATUS_NAMES[e.st]}中，不能行動。`};
  case 'poison':return {c:'dot',t:`${n(e.d)}毒發，受到 ${e.dmg} 傷害。`};
  case 'recover':return {c:'sys',t:`${n(e.d)}的${STATUS_NAMES[e.st]}解除了。`};
  case 'cure':return {c:'heal',t:e.ok?`${n(e.d)}的異常狀態解除了。`:`${n(e.d)}沒有異常狀態。`};
  case 'revive':return {c:'heal',t:`${n(e.d)}站了起來！`};
  case 'escape':return e.ok?{c:'sys',t:'逃跑成功。'}:{c:'miss',t:'逃跑失敗！'};
  case 'msg':return {c:'sys',t:e.text};
  case 'end':return null;
  default:return null;
 }
}
export {resolveRound,allies,foes,actionsOf};
