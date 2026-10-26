// 戰鬥規則核心：不碰畫面。resolveRound 把一回合算完，回傳事件清單讓畫面照順序播（1x、3x 只是播放速度不同，結果一樣）。
// 之後做連線時，這個檔案可以原封不動搬到伺服器上跑。
import {makeRng} from './rng.mjs';
import {physBase,elemMod,raceMod,dodgeRate,critRate,critExtra,counterRate,COUNTER_MULT,DEFEND_RATE,WEAPON_MULT,speedOf,magicA,magicB,magicC,magicBase,escapeRate,expFrom} from './combat.mjs';
import {SKILLS,SKILL_EXP,SKILL_EXP_PER_USE,STATUS_NAMES,weaponOk,BARRIER_TURNS,ELEM_TURNS} from '../data/skills.mjs';
import {ITEMS} from '../data/items.mjs';
import {MONSTERS,monsterBp,dropsFor} from '../data/monsters.mjs';
import {derive} from './stats.mjs';
import {chooseEnemyAction,chooseAllyAction} from './ai.mjs';
import {captureRate} from './pet.mjs';

export function monsterUnit(id,lv,slot){
 const m=MONSTERS[id],s=derive(monsterBp(id,lv),true);
 return {uid:'e'+slot,side:'enemy',kind:'monster',mon:id,name:m.name,art:m.art,tint:m.tint,h:m.h,lv,race:m.race,elem:m.elem,luck:0,boss:!!m.boss,
  maxHp:s.hp,hp:s.hp,maxMp:s.mp,mp:s.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0,
  skills:(m.skills||[]).map(([sid,L,pct])=>({id:sid,lv:L,pct})),row:slot<5?'front':'back',slot:slot%5};
}

// party：已算好數值的我方單位（state.mjs battleUnit）；enemies：[[怪物 id, 等級], ...]
export function createBattle({party,enemies,seed,canEscape=true,captureRoom=0}){
 const units=[...party.map((u,i)=>({...u,side:'ally',slot:u.slot??i})),...enemies.map(([id,lv],i)=>monsterUnit(id,lv,i))];
 for(const u of units){u.alive=u.hp>0;u.defending=false;u.skip=0;u.down=null;u.st=null;}
 return {seed,rngState:seed>>>0,round:0,units,escapeTries:0,canEscape,captureRoom,over:null,log:[]};
}
export const allies=b=>b.units.filter(u=>u.side==='ally');
export const foes=b=>b.units.filter(u=>u.side==='enemy');
const alive=list=>list.filter(u=>u.alive);
const other=(b,u)=>alive(u.side==='ally'?foes(b):allies(b));
// 人物沒帶寵物時一回合行動兩次（照原作）
export const actionsOf=(b,u)=>u.kind==='player'&&!allies(b).some(a=>a.kind==='pet'&&a.owner===u.uid)?2:1;

// 近戰只打得到前排（文字版 b.mods.frontOnly，Leo 2026-10-26）：前排還有人站著就只能挑前排；遠攻、魔法不受限
const reachable=(b,u,melee)=>{const pool=other(b,u);if(!melee||!b.mods?.frontOnly)return pool;const fr=pool.filter(x=>x.row!=='back');return fr.length?fr:pool;};
function pickTarget(b,u,want,melee=false){
 const pool=reachable(b,u,melee);if(!pool.length)return null;
 const t=want&&pool.find(x=>x.uid===want);
 return t||pool[Math.floor(b.rng.next()*pool.length)];
}

// 物理一擊。opts：mult 傷害倍率、atkMult 攻擊倍率、hitPenalty、melee、noCounter
function strike(b,ev,a,t,{mult=1,atkMult=1,hitPenalty=0,melee=true,counter=false,pierce=0,critAdd=0,spread=.2}={}){
 const r=b.rng;
 const g=!counter&&melee&&t.coveredBy&&b.units.find(x=>x.uid===t.coveredBy);if(g&&g.alive&&g!==a){ev.push({t:'cover',a:g.uid,d:t.uid});t=g;}
 // 騎士之譽：生命比騎士少的隊友被近身打，騎士擋下來
 else if(!counter&&melee){const k=b.units.find(x=>x.honor&&x.alive&&x.side===t.side&&x!==t&&x!==a&&t.hp<x.hp);if(k){ev.push({t:'cover',a:k.uid,d:t.uid});t=k;}}
 // 陽炎（t.haze）：閃躲率乘上去、防禦扣掉；擋人（騎士之譽）、擋魔法的時候閃不掉
 if(!t.honor&&!t.mguard&&r.chance(dodgeRate(a.agi,t.agi,{hitMod:(a.hitMod||0)-hitPenalty,avoidMod:t.avoidMod||0})*(1+(t.haze||0)))){ev.push({t:'miss',a:a.uid,d:t.uid});return;}
 const atk=a.atk*atkMult*(a.boost?1+a.boost.pct/100:1),def=t.def*(t.honorDef||1)*(t.down?1-t.down:1)*(1-(t.haze||0))*(1-pierce/100)*(t.boost?1+t.boost.pct/100:1);
 let dmg=physBase(atk,def)*(1-spread/2+r.next()*spread)*(1+(elemMod(a.elem,t.elem)+raceMod(a.race,t.race))/100)*mult;
 if((a.kind==='player'||a.kind==='officer')&&a.weaponType)dmg*=WEAPON_MULT;
 const crit=r.chance(critRate(a,critAdd));if(crit)dmg+=critExtra(t.def,a.lv,t.lv);
 if(t.defending&&!pierce)dmg*=t.wall?t.wall:DEFEND_RATE;
 if(t.covering&&!pierce)dmg*=1-t.covering/100;
 dmg=Math.max(1,Math.floor(dmg));
 if(t.barrier?.k[0]==='p'&&barrier(b,ev,a,t,dmg,melee&&!counter))return;
 hurt(b,ev,a,t,dmg,{crit,counter});
 // 反擊技能（t.counterSt＝傷害倍率）擺著時被近身打必定反擊
 if(melee&&!counter&&t.alive&&a.alive&&!a.ranged&&(t.counterSt||r.chance(t.wallCounter||counterRate(t)))){ev.push({t:'counter',a:t.uid,d:a.uid});strike(b,ev,t,a,{mult:t.counterSt||COUNTER_MULT,counter:true});}
}
// 巫師的屏障：吸收＝變成回復、反彈＝打回去（遠攻、魔法以外的遠距離只擋掉）、無效＝不受傷。回傳 true 表示這下被擋掉了
function barrier(b,ev,a,t,dmg,back){
 const k=t.barrier.k;if(--t.barrier.n<=0)t.barrier=null;
 if(k.endsWith('Absorb')){const n=Math.min(dmg,t.maxHp-t.hp);t.hp+=n;ev.push({t:'msg',text:`${t.name}的屏障把傷害吸了進去`});if(n>0)ev.push({t:'heal',d:t.uid,n,hp:t.hp});return true;}
 if(k.endsWith('Reflect')&&back&&a.alive){ev.push({t:'msg',text:`${t.name}的屏障把攻擊彈了回去`});hurt(b,ev,t,a,dmg);return true;}
 ev.push({t:'msg',text:`${t.name}的屏障擋下了攻擊`});return true;
}
function hurt(b,ev,a,t,dmg,extra={}){
 t.hp=Math.max(0,t.hp-dmg);ev.push({t:'hit',a:a.uid,d:t.uid,dmg,hp:t.hp,...extra});
 if(t.hp<=0){t.alive=false;t.defending=false;t.st=null;t.downs=(t.downs||0)+1;ev.push({t:'die',d:t.uid});}
 else if(t.st?.k==='sleep'){t.st=null;ev.push({t:'wake',d:t.uid});} // 昏睡被打就醒
}
// 站位：slot 0 在正中間，1、2 在上下兩側，3、4 在最外側（畫面上的順序是 3,1,0,2,4）
export const SLOT_ORDER=[2,1,3,0,4];
// 範圍：十字＝目標、同排左右（畫面上相鄰）、另一排同位置；全體＝那一邊所有活著的
export function areaOf(b,t,area){
 const side=b.units.filter(u=>u.side===t.side&&u.alive);
 if(area==='all')return side;
 if(area==='cross')return [t,...side.filter(u=>u!==t&&(u.row===t.row?Math.abs(SLOT_ORDER[u.slot]-SLOT_ORDER[t.slot])===1:u.slot===t.slot))];
 return [t];
}
// 異常狀態：一次只會有一種，新的蓋掉舊的。◎ 成功率＝50＋5×技能等級＋2×等級差（5～90），頭目減半；持續 2＋等級/3 回合
export const statusRate=(a,t,L)=>{const r=Math.max(5,Math.min(90,50+5*L+2*(a.lv-t.lv)));return t.boss?Math.floor(r/2):r;};
function inflict(b,ev,a,t,st,L){
 // 忍者的狀態抵抗（被動）：成功率 −4%×等級、持續少 等級/4 回合；被下咒就累積熟練度
 const res=t.skills?.find(s=>s.id===st+'Res'),rl=res?.lv||0;if(res)skillExp(b,t,res.id);
 const ok=b.rng.next()*100<statusRate(a,t,L)-4*rl-(t.res?.[st]||0);
 if(ok)t.st={k:st,n:Math.max(1,(st==='poison'?3:2)+Math.floor(L/3)-Math.floor(rl/4)),L};
 ev.push({t:'status',a:a.uid,d:t.uid,st,ok});
}
function castMagic(b,ev,a,t,sk,L){
 const e=sk.elem?{[sk.elem]:10}:(a.elem||{}),r=b.rng,pet=a.kind!=='player';
 const k=magicBase(sk.area||'single',L)*magicA(a.spr,t.spr,pet)*(magicB(a.spr,L)+magicC(a.matk||0,L))*(.95+r.next()*.1)*(100+elemMod(e,t.elem)+raceMod(a.race,t.race))/100;
 let dmg=Math.max(1,Math.floor(k*(sk.mult||1)));
 // 攻擊魔法防禦：隨機剩 1 點或 10%～50%
 if(t.mguard){const f=[0,.1,.2,.3,.4,.5][Math.floor(r.next()*6)];dmg=f?Math.max(1,Math.floor(dmg*f)):1;}
 if(t.barrier?.k[0]==='m'&&barrier(b,ev,a,t,dmg,true))return;
 hurt(b,ev,a,t,dmg,{elem:sk.elem});
 if(sk.drain&&a.alive){const n=Math.min(Math.floor(dmg*sk.drain/100),a.maxHp-a.hp);if(n>0){a.hp+=n;ev.push({t:'heal',d:a.uid,n,hp:a.hp});}}
}

function capture(b,ev,a,want,bonus){
 const t=b.units.find(x=>x.uid===want&&x.side!==a.side&&x.alive)||pickTarget(b,a,null);if(!t)return;
 const rate=t.boss?0:Math.min(95,captureRate(a,t)+bonus),ok=b.captureRoom>0&&b.rng.next()*100<rate;
 ev.push({t:'capture',a:a.uid,d:t.uid,ok,full:b.captureRoom<=0});
 if(ok){t.alive=false;t.captured=true;b.captureRoom--;(b.captured||=[]).push({mon:t.mon,lv:t.lv});}
}
function skillExp(b,a,id){
 if(a.kind!=='player')return;const s=a.skills.find(x=>x.id===id);if(!s)return;
 const avg=Math.max(1,Math.round(foes(b).reduce((n,u)=>n+u.lv,0)/Math.max(1,foes(b).length)));
 s.gain=(s.gain||0)+SKILL_EXP_PER_USE*avg;
}

// 照原作可以選用比學會的等級低的技能（c.lv），威力和耗魔一起降，打雜兵省魔用
const useLv=(u,c)=>{const own=u.skills?.find(s=>s.id===c.skill)?.lv||1;return Math.max(1,Math.min(c.lv||own,own));};
function act(b,ev,c){
 const a=c.actor;if(!a.alive||b.over)return;
 if(c.kind==='skip')return;
 // 異常狀態：昏睡、石化不能動；混亂亂打（敵我不分）；遺忘不能用技能
 if(a.st?.k==='sleep'||a.st?.k==='stone'){ev.push({t:'stuck',a:a.uid,st:a.st.k});return;}
 if(a.st?.k==='confuse'&&['attack','skill','capture'].includes(c.kind)){
  const pool=b.units.filter(u=>u.alive&&u!==a),t=pool[Math.floor(b.rng.next()*pool.length)];if(!t)return;
  ev.push({t:'act',a:a.uid,kind:'attack',ranged:!!a.ranged,confused:true});strike(b,ev,a,t,{melee:!a.ranged});return;
 }
 if(a.st?.k==='forget'&&c.kind==='skill'){ev.push({t:'msg',text:`${a.name}忘了怎麼用技能`});c={...c,kind:'attack'};}
 // b.mods.oneSkill（文字版，Leo 2026-10-26）：一回合兩動但技能只能放一次，第二次改普攻
 if(c.kind==='skill'&&b.mods?.oneSkill){if(a.skillRound===b.round)c={...c,kind:'attack',target:SKILLS[c.skill]?.target==='enemy'?c.target:null};else a.skillRound=b.round;}
 if(c.kind==='defend'){ev.push({t:'act',a:a.uid,kind:'defend'});return;}
 if(c.kind==='capture')return capture(b,ev,a,c.target,0);
 if(c.kind==='escape'){
  b.escapeTries++;const maxLv=Math.max(...foes(b).map(u=>u.lv));
  let ok=b.canEscape&&b.rng.next()<escapeRate(b.escapeTries,a.luck||1,a.lv,maxLv);
  // 虛死為上（被動）：逃跑失敗時有機會裝死逃掉
  const pd=b.canEscape&&!ok&&a.skills?.find(s=>s.id==='playdead');if(pd){skillExp(b,a,'playdead');if(b.rng.chance(SKILLS.playdead.rate(pd.lv))){ok=true;ev.push({t:'msg',text:`${a.name}倒地裝死，騙過了敵人`});}}
  ev.push({t:'escape',a:a.uid,ok});if(ok)b.over='escaped';return;
 }
 if(c.kind==='item'){
  const it=ITEMS[c.item],t=b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;
  if(!c.useItem||!c.useItem(c.item)){ev.push({t:'msg',text:'道具不夠了'});return;}
  ev.push({t:'act',a:a.uid,kind:'item',name:it.name});
  if(it.hp){const n=Math.min(it.hp,t.maxHp-t.hp);t.hp+=n;ev.push({t:'heal',d:t.uid,n,hp:t.hp});}
  if(it.mp){const n=Math.min(it.mp,t.maxMp-t.mp);t.mp+=n;ev.push({t:'mp',d:t.uid,n,mp:t.mp});}
  return;
 }
 if(c.kind==='skill'){
  const sk=SKILLS[c.skill],L=useLv(a,c),cost=sk.mp(L);
  if(!weaponOk(a,c.skill)){ev.push({t:'msg',text:`${a.name}手上的武器用不了${sk.name}，改用普通攻擊`});return act(b,ev,{...c,kind:'attack'});}
  if(a.mp<cost){ev.push({t:'msg',text:`${a.name}魔力不足，改用普通攻擊`});return act(b,ev,{...c,kind:'attack'});}
  a.mp-=cost;ev.push({t:'act',a:a.uid,kind:'skill',skill:c.skill,name:sk.name,lv:L,mp:a.mp});skillExp(b,a,c.skill);
  if(sk.kind==='heal'){const c0=b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;
   for(const t of areaOf(b,c0,sk.area)){const n=Math.min(Math.floor(t.rec*(sk.healPct||60)/100*L),t.maxHp-t.hp);t.hp+=n;ev.push({t:'heal',d:t.uid,n,hp:t.hp});}return;}
  if(['cover','wall','stance','honor','passive'].includes(sk.kind))return;
  const ally=()=>b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;
  if(sk.kind==='regen'){for(const t of areaOf(b,ally(),sk.area)){t.regen={n:6,amt:Math.max(1,Math.floor(t.rec*sk.pct/100*L))};ev.push({t:'msg',text:`${t.name}身上的符發出微光`});}return;}
  if(sk.kind==='barrier'){const t=ally();t.barrier={k:c.skill,n:sk.hits,turns:BARRIER_TURNS[L-1]};ev.push({t:'msg',text:`${t.name}身邊張開了${sk.name}的屏障`});return;}
  if(sk.kind==='elemset'){const t=sk.flip?pickTarget(b,a,c.target):ally();if(!t)return;t.elem0||=t.elem||{};
   t.elem=sk.flip?Object.fromEntries(Object.entries(t.elem||{}).map(([e,v])=>[{earth:'fire',fire:'earth',water:'wind',wind:'water'}[e],v])):{[sk.elem]:10};t.elemT=ELEM_TURNS[L-1];
   ev.push({t:'msg',text:`${t.name}的屬性變了`});return;}
  if(sk.kind==='steal'){const t=pickTarget(b,a,c.target);if(!t)return;
   if(t.kind!=='monster'||!MONSTERS[t.mon]||t.stolen){ev.push({t:'msg',text:`${t.name}身上沒東西可偷`});return;}
   const got=b.rng.chance(sk.rate(L))?dropsFor(t.mon,t.lv,b.rng)[0]:null;
   if(got){t.stolen=true;(b.stolen||=[]).push(got);ev.push({t:'msg',text:`${a.name}從${t.name}身上偷到${ITEMS[got]?.name||'東西'}！`});}else ev.push({t:'msg',text:`${a.name}什麼也沒偷到`});return;}
  if(sk.kind==='copycat'){const t=pickTarget(b,a,c.target);if(!t)return;const K=['atk','def','agi','spr','rec'];
   if(!a.copy)a.copy={orig:Object.fromEntries(K.map(k=>[k,a[k]]))};for(const k of K)a[k]=t[k];a.copy.n=L;ev.push({t:'msg',text:`${a.name}學起了${t.name}的樣子`});return;}
  if(sk.kind==='psy'){const t=pickTarget(b,a,c.target);if(!t)return;const row=alive(other(b,a)).filter(x=>x.row===t.row),m=1.5/(row.length+.5);
   for(const x of row){if(x.alive)castMagic(b,ev,a,x,{area:'cross',mult:m*.5},L);if(x.alive&&a.alive)strike(b,ev,a,x,{mult:m*.5,melee:false});}return;}
  if(sk.kind==='rally'){const pet=allies(b).find(x=>x.kind==='pet'&&x.owner===a.uid&&x.alive);if(!pet){ev.push({t:'msg',text:'沒有出戰的寵物'});return;}pet.boost={n:3,pct:sk.pct(L)};ev.push({t:'msg',text:`${pet.name}士氣大振`});return;}
  if(sk.kind==='capture')return capture(b,ev,a,c.target,sk.bonus(L)); // 回合一開始就生效（見 resolveRound）
  if(sk.kind==='selfheal'){const n=Math.min(Math.floor(a.rec*sk.healPct/100*L),a.maxHp-a.hp);a.hp+=n;ev.push({t:'heal',d:a.uid,n,hp:a.hp});if(a.st){a.st=null;ev.push({t:'cure',d:a.uid,ok:true});}return;}
  if(sk.kind==='cure'){const t=b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;const had=t.st;t.st=null;ev.push({t:'cure',d:t.uid,ok:!!had});return;}
  if(sk.kind==='status'){const t=pickTarget(b,a,c.target);if(t)for(const x of areaOf(b,t,sk.area))inflict(b,ev,a,x,sk.st,L);return;}
  if(sk.kind==='revive'){const t=b.units.find(x=>x.uid===c.target&&x.side===a.side&&!x.alive);if(!t){ev.push({t:'msg',text:'沒有氣絕的人'});return;}
   t.alive=true;t.hp=Math.min(t.maxHp,60*L);ev.push({t:'revive',d:t.uid,hp:t.hp});return;}
  if(sk.kind==='magic'){const t=pickTarget(b,a,c.target);if(t)for(const x of areaOf(b,t,sk.area))if(x.alive)castMagic(b,ev,a,x,sk,L);return;}
  // 物理招
  const mod=b.mods?.skill?.[c.skill]; // 文字版改過的數字（rules.mjs MODS.skill）
  if(c.skill==='volley'){
   const got=new Map();
   for(let i=0;i<sk.arrows(L)&&a.alive;i++){const t=pickTarget(b,a,null);if(!t)break;const n=got.get(t)||0;got.set(t,n+1);strike(b,ev,a,t,{mult:(mod?.arrowMult?.(L)??sk.arrowMult)*sk.decay**n,melee:false});}
   return;
  }
  if(c.skill==='combo'){
   const rand=sk.randomTarget(L),mel=sk.melee&&!a.ranged;let n=sk.hits(L),per=1/n,spread=.2;
   // 文字版：每下固定、次數隨機（MODS.skill.combo）
   if(mod?.extra){const [m,p]=mod.extra(L);n=2;for(let i=0;i<m;i++)if(b.rng.chance(p))n++;per=mod.per;spread=mod.spread;}
   let first=pickTarget(b,a,c.target,mel);
   for(let i=0;i<n&&a.alive;i++){const t=rand&&i>0?pickTarget(b,a,null,mel):first?.alive?first:pickTarget(b,a,null,mel);if(!t)break;strike(b,ev,a,t,{mult:per,melee:sk.melee,spread});}
   return;
  }
  if(c.skill==='qigong'){
   const first=pickTarget(b,a,c.target);if(!first)return;const rest=alive(other(b,a)).filter(x=>x!==first);
   const hit=[first];while(hit.length<sk.targets(L)&&rest.length)hit.push(rest.splice(Math.floor(b.rng.next()*rest.length),1)[0]);
   for(const t of hit)if(t.alive)strike(b,ev,a,t,{mult:sk.mult(L),melee:false});return;
  }
  if(c.skill==='moon'){
   const [lo,hi]=sk.targets(L),first=pickTarget(b,a,c.target,true);if(!first)return;const rest=reachable(b,a,true).filter(x=>x!==first),want=b.rng.int(lo,hi);
   const hit=[first];while(hit.length<want&&rest.length)hit.push(rest.splice(Math.floor(b.rng.next()*rest.length),1)[0]);
   for(const t of hit)if(t.alive&&a.alive)strike(b,ev,a,t);return;
  }
  const t=pickTarget(b,a,c.target,sk.melee&&!a.ranged&&c.skill!=='twobird');if(!t)return; // 一石二鳥前後排都打得到
  if(c.skill==='twobird'){
   const col=alive(b.units.filter(u=>u.side===t.side&&u.slot===t.slot)),fr=col.find(u=>u.row==='front'),bk=col.find(u=>u.row==='back');
   if(fr)strike(b,ev,a,fr,{mult:sk.front(L)});if(bk&&fr&&a.alive&&bk.alive)strike(b,ev,a,bk,{mult:sk.back(L)});else if(!fr)strike(b,ev,a,t,{mult:sk.back(L)}); // ◎ 前面沒人就照後排算
   return;
  }
  if(c.skill==='karma'){const before=t.hp;strike(b,ev,a,t,{mult:sk.mult(L)*[.8,1,1.2][Math.floor(b.rng.next()*3)],melee:false});
   const n=Math.min(a.hp-1,Math.floor((before-t.hp)*sk.self(L)/100));if(n>0&&a.alive){a.hp-=n;ev.push({t:'recoil',d:a.uid,dmg:n,hp:a.hp});}return;}
  if(c.skill==='terror'){const n=Math.floor((t.mp||0)*sk.pct(L)/100);t.mp=Math.max(0,(t.mp||0)-n);ev.push({t:'mpLoss',a:a.uid,d:t.uid,n,mp:t.mp});return;}
  if(c.skill==='chaos'){strike(b,ev,a,t);if(t.alive&&!t.st){const pool=sk.pool(L);inflict(b,ev,a,t,pool[Math.floor(b.rng.next()*pool.length)],L);}return;}
  if(c.skill==='focus'||c.skill==='sure'){strike(b,ev,a,t,{mult:mod?.mult?.(L)??sk.mult(L),critAdd:sk.crit(L),melee:!a.ranged});return;}
  if(c.skill==='kill'){if(!t.boss&&b.rng.chance(sk.chance(L)*(2-t.hp/t.maxHp))){ev.push({t:'hit',a:a.uid,d:t.uid,dmg:t.hp,hp:0,crit:true,kill:true});t.hp=0;t.alive=false;t.st=null;t.downs=(t.downs||0)+1;ev.push({t:'die',d:t.uid});}else strike(b,ev,a,t);return;}
  if(c.skill==='venom'){strike(b,ev,a,t);if(t.alive){const ok=b.rng.next()*100<statusRate(a,t,L);if(ok)t.st={k:'poison',n:3+Math.floor(L/3),L};ev.push({t:'status',a:a.uid,d:t.uid,st:'poison',ok});}return;}
  if(c.skill==='smash')strike(b,ev,a,t,{pierce:sk.pierce(L)});
  else if(c.skill==='allin')strike(b,ev,a,t,{mult:mod?.mult?.(L)??sk.mult(L),hitPenalty:sk.hitPenalty(L)});
  else if(c.skill==='blade'){strike(b,ev,a,t,{atkMult:1+sk.atkUp(L)*(b.mods?.bladeMult||1)/100});a.down=sk.selfDown(L)/100;}
  else if(c.skill==='swift'){strike(b,ev,a,t,{atkMult:mod?.atkMult?.(L)??sk.atkMult(L)});a.skip=2;}
  return;
 }
 // 普通攻擊
 const t=pickTarget(b,a,c.target,!a.ranged);if(!t)return;
 ev.push({t:'act',a:a.uid,kind:'attack',ranged:!!a.ranged});
 strike(b,ev,a,t,{melee:!a.ranged});
}

// cmds：我方每個行動 {actor:uid, kind, target, skill, item, useItem}。敵方由 ai.mjs 決定。
export function resolveRound(b,cmds){
 const rng=makeRng(b.rngState);b.rng=rng;b.round++;const ev=[{t:'round',n:b.round}];
 const list=[];
 for(const c of cmds){const u=b.units.find(x=>x.uid===c.actor);if(u?.alive)list.push({...c,actor:u});}
 // 對面是電腦代打的玩家角色（擂台，u.ai）：照傭兵的判斷出手，人物沒帶寵物一樣一回合兩次
 for(const u of alive(foes(b)))for(let i=0;i<(u.ai?actionsOf(b,u):1);i++)list.push({...(u.ai?chooseAllyAction(b,u,rng):chooseEnemyAction(b,u,rng)),actor:u});
 // 傭兵自己決定行動（每回合一次；電腦代打的玩家角色，像文字版擂台的隨行夥伴，照人物規則兩次）；主角這回合已經指定要補的人，傭兵就不重複補
 b.healing=new Set(cmds.filter(c=>c.kind==='skill'&&SKILLS[c.skill]?.kind==='heal').map(c=>c.target));
 for(const u of alive(allies(b)).filter(u=>(u.ai||u.kind==='pet')&&!cmds.some(c=>c.actor===u.uid)))for(let i=0;i<(u.ai&&u.kind==='player'?actionsOf(b,u):1);i++)list.push({...chooseAllyAction(b,u,rng),actor:u});
 delete b.healing;
 // 迅速果斷：下一回合不能行動
 for(const c of list)if(c.actor.skip===1)c.kind='skip';
 for(const c of list){if(c.kind==='defend')c.actor.defending=true;
  if(c.kind==='skill'&&(c.skill==='wall'||c.skill==='cover')){const u=c.actor,L=useLv(u,c),sk=SKILLS[c.skill];if(u.mp>=sk.mp(L)&&!u.st){
   if(c.skill==='wall'){u.defending=true;u.wall=sk.rate(L);u.wallCounter=sk.counter(L);if(b.mods?.wallTurns)u.wallLeft=b.mods.wallTurns;}
   else{const t=b.units.find(x=>x.uid===c.target&&x.side===u.side&&x.alive&&x!==u);if(t){t.coveredBy=u.uid;u.covering=sk.cut(L);}}}}
  if(c.kind==='skill'&&c.skill==='honor'){const u=c.actor,L=useLv(u,c),sk=SKILLS.honor;if(u.mp>=sk.mp(L)&&!u.st){u.honor=true;u.honorDef=sk.def(L);}}
  // 反擊、陽炎：回合一開始就擺好架勢；同一回合第二次放就改成普通攻擊
  if(c.kind==='skill'&&SKILLS[c.skill]?.kind==='stance'){const u=c.actor,L=useLv(u,c),sk=SKILLS[c.skill];
   if(u.stance===c.skill){c.kind='attack';c.target=null;}
   else if(u.mp>=sk.mp(L)&&!u.st){u.stance=c.skill;if(c.skill==='counter')u.counterSt=sk.mult(L);else if(c.skill==='mguard')u.mguard=true;else u.haze=sk.pct(L)/100;}}
  c.speed=speedOf(c.actor,rng,0)*(c.kind==='skill'&&SKILLS[c.skill]?.speedMult?SKILLS[c.skill].speedMult(useLv(c.actor,c)):1)*(c.actor.st?.k==='drunk'?.3:1);}
 list.sort((x,y)=>y.speed-x.speed);
 for(const c of list){if(b.over)break;act(b,ev,c);checkEnd(b,ev);}
 // 回合結束：中毒扣血（◎ 最大生命 8%，不會扣到死；文字版見下），狀態倒數
 if(!b.over)for(const u of b.units){if(!u.alive)continue;
  if(u.regen){const n=Math.min(u.regen.amt,u.maxHp-u.hp);if(n>0){u.hp+=n;ev.push({t:'heal',d:u.uid,n,hp:u.hp});}if(--u.regen.n<=0)u.regen=null;}
  if(u.boost&&--u.boost.n<=0)u.boost=null;
  if(u.barrier&&--u.barrier.turns<=0){u.barrier=null;ev.push({t:'msg',text:`${u.name}的屏障消失了`});}
  if(u.elemT&&--u.elemT<=0){u.elem=u.elem0;u.elem0=null;ev.push({t:'msg',text:`${u.name}的屬性變回來了`});}
  if(u.copy&&--u.copy.n<=0){Object.assign(u,u.copy.orig);u.copy=null;}
  if(!u.st)continue;
  // b.mods.poison（文字版）：扣血看下毒的技能等級、可以毒死，頭目減半
  if(u.st.k==='poison'){const pm=b.mods?.poison,raw=Math.max(1,Math.floor(u.maxHp*(pm?pm.pct(u.st.L||1)/(u.boss?2:1):.08))),n=pm?.lethal?Math.min(u.hp,raw):Math.min(u.hp-1,raw);
   if(n>0){u.hp-=n;ev.push({t:'poison',d:u.uid,dmg:n,hp:u.hp});}
   if(u.hp<=0){u.alive=false;u.defending=false;u.st=null;u.downs=(u.downs||0)+1;ev.push({t:'die',d:u.uid});continue;}}
  if(--u.st.n<=0){ev.push({t:'recover',d:u.uid,st:u.st.k});u.st=null;}}
 checkEnd(b,ev); // 被毒死也可能分出勝負
 // 聖盾撐好幾回合（b.mods.wallTurns，文字版擂台用）：還沒到期就留著
 for(const u of b.units){if(u.wallLeft>1&&u.alive){u.wallLeft--;u.defending=true;}else{u.wallLeft=0;u.defending=false;u.wall=0;u.wallCounter=0;}u.coveredBy=null;u.covering=0;u.stance=null;u.counterSt=0;u.haze=0;u.mguard=false;u.honor=false;u.honorDef=0;if(u.skip>0)u.skip--;if(u.down&&!list.some(c=>c.actor===u&&c.skill==='blade'))u.down=null;}
 b.rngState=Math.floor(rng.next()*4294967296);delete b.rng;
 return ev;
}
function checkEnd(b,ev){
 if(b.over)return;
 if(!alive(foes(b)).length){b.over='win';ev.push({t:'end',result:'win'});}
 else if(!alive(allies(b)).length){b.over='lose';ev.push({t:'end',result:'lose'});}
}

// 勝利結算：經驗（每隻怪各自算，照原作公式）、掉落、技能經驗
export function rewards(b,player){
 const rng=makeRng(b.rngState^0x5bd1e995);const items=[];let exp=0;
 const beaten=foes(b).filter(e=>!e.captured); // 抓走的怪沒有經驗也不掉東西
 for(const e of beaten){exp+=expFrom(e.lv,player.lv);items.push(...dropsFor(e.mon,e.lv,rng));}
 items.push(...(b.stolen||[])); // 偷竊偷到的
 // 傭兵各自照自己的等級算經驗；氣絕的拿不到（照原作）
 const officerExp=Object.fromEntries(allies(b).filter(u=>u.kind==='officer'&&u.alive).map(u=>[u.oid,beaten.reduce((n,e)=>n+expFrom(e.lv,u.lv),0)]));
 const me=allies(b).find(u=>u.kind==='player');
 const skillGain=Object.fromEntries((me?.skills||[]).filter(s=>s.gain).map(s=>[s.id,s.gain]));
 const pet=allies(b).find(u=>u.kind==='pet'&&u.alive),petExp=pet?beaten.reduce((n,e)=>n+expFrom(e.lv,pet.lv),0):0;
 const repBase=beaten.reduce((n,e)=>n+e.lv,0); // ◎ 每場戰鬥得「敵方等級合計」點聲望
 return {exp:me?.alive?exp:0,items,skillGain,rep:repBase,officerExp,petExp,captured:b.captured||[],killed:beaten.map(e=>e.mon)};
}
export {SKILL_EXP};
