// 戰鬥規則核心：不碰畫面。resolveRound 把一回合算完，回傳事件清單讓畫面照順序播（1x、3x 只是播放速度不同，結果一樣）。
// 之後做連線時，這個檔案可以原封不動搬到伺服器上跑。
import {makeRng} from './rng.mjs';
import {physBase,elemMod,raceMod,dodgeRate,critRate,critExtra,counterRate,COUNTER_MULT,DEFEND_RATE,WEAPON_MULT,speedOf,magicA,magicB,magicC,magicBase,escapeRate,expFrom} from './combat.mjs';
import {SKILLS,SKILL_EXP,SKILL_EXP_PER_USE,STATUS_NAMES} from '../data/skills.mjs';
import {ITEMS} from '../data/items.mjs';
import {MONSTERS,monsterBp,dropsFor} from '../data/monsters.mjs';
import {derive} from './stats.mjs';
import {chooseEnemyAction,chooseAllyAction} from './ai.mjs';
import {captureRate} from './pet.mjs';

export function monsterUnit(id,lv,slot){
 const m=MONSTERS[id],s=derive(monsterBp(id,lv),true);
 return {uid:'e'+slot,side:'enemy',kind:'monster',mon:id,name:m.name,art:m.art,h:m.h,lv,race:m.race,elem:m.elem,luck:0,boss:!!m.boss,
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

function pickTarget(b,u,want){
 const pool=other(b,u);if(!pool.length)return null;
 const t=want&&b.units.find(x=>x.uid===want);
 return t&&t.alive&&t.side!==u.side?t:pool[Math.floor(b.rng.next()*pool.length)];
}

// 物理一擊。opts：mult 傷害倍率、atkMult 攻擊倍率、hitPenalty、melee、noCounter
function strike(b,ev,a,t,{mult=1,atkMult=1,hitPenalty=0,melee=true,counter=false}={}){
 const r=b.rng;
 if(r.chance(dodgeRate(a.agi,t.agi,{hitMod:-hitPenalty}))){ev.push({t:'miss',a:a.uid,d:t.uid});return;}
 const atk=a.atk*atkMult*(a.down?1:1),def=t.def*(t.down?1-t.down:1);
 let dmg=physBase(atk,def)*(.9+r.next()*.2)*(1+(elemMod(a.elem,t.elem)+raceMod(a.race,t.race))/100)*mult;
 if((a.kind==='player'||a.kind==='officer')&&a.weaponType)dmg*=WEAPON_MULT;
 const crit=r.chance(critRate(a));if(crit)dmg+=critExtra(t.def,a.lv,t.lv);
 if(t.defending)dmg*=DEFEND_RATE;
 dmg=Math.max(1,Math.floor(dmg));
 hurt(b,ev,a,t,dmg,{crit,counter});
 if(melee&&!counter&&t.alive&&a.alive&&!a.ranged&&r.chance(counterRate(t))){ev.push({t:'counter',a:t.uid,d:a.uid});strike(b,ev,t,a,{mult:COUNTER_MULT,counter:true});}
}
function hurt(b,ev,a,t,dmg,extra={}){
 t.hp=Math.max(0,t.hp-dmg);ev.push({t:'hit',a:a.uid,d:t.uid,dmg,hp:t.hp,...extra});
 if(t.hp<=0){t.alive=false;t.defending=false;t.st=null;ev.push({t:'die',d:t.uid});}
 else if(t.st?.k==='sleep'){t.st=null;ev.push({t:'wake',d:t.uid});} // 昏睡被打就醒
}
// 範圍：十字＝目標、同排左右、另一排同位置；全體＝那一邊所有活著的
export function areaOf(b,t,area){
 const side=b.units.filter(u=>u.side===t.side&&u.alive);
 if(area==='all')return side;
 if(area==='cross')return [t,...side.filter(u=>u!==t&&(u.row===t.row?Math.abs(u.slot-t.slot)===1:u.slot===t.slot))];
 return [t];
}
// 異常狀態：一次只會有一種，新的蓋掉舊的。◎ 成功率＝50＋5×技能等級＋2×等級差（5～90），頭目減半；持續 2＋等級/3 回合
export const statusRate=(a,t,L)=>{const r=Math.max(5,Math.min(90,50+5*L+2*(a.lv-t.lv)));return t.boss?Math.floor(r/2):r;};
function inflict(b,ev,a,t,st,L){
 const ok=b.rng.next()*100<statusRate(a,t,L);
 if(ok)t.st={k:st,n:(st==='poison'?3:2)+Math.floor(L/3)};
 ev.push({t:'status',a:a.uid,d:t.uid,st,ok});
}
function castMagic(b,ev,a,t,sk,L){
 const e={[sk.elem]:10},r=b.rng,pet=a.kind!=='player';
 const k=magicBase(sk.area||'single',L)*magicA(a.spr,t.spr,pet)*(magicB(a.spr,L)+magicC(a.matk||0,L))*(.95+r.next()*.1)*(100+elemMod(e,t.elem)+raceMod(a.race,t.race))/100;
 hurt(b,ev,a,t,Math.max(1,Math.floor(k)),{elem:sk.elem});
}

function skillExp(b,a,id){
 if(a.kind!=='player')return;const s=a.skills.find(x=>x.id===id);if(!s)return;
 const avg=Math.max(1,Math.round(foes(b).reduce((n,u)=>n+u.lv,0)/Math.max(1,foes(b).length)));
 s.gain=(s.gain||0)+SKILL_EXP_PER_USE*avg;
}

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
 if(c.kind==='defend'){ev.push({t:'act',a:a.uid,kind:'defend'});return;}
 if(c.kind==='capture'){
  const t=b.units.find(x=>x.uid===c.target&&x.side!==a.side&&x.alive)||pickTarget(b,a,null);if(!t)return;
  const ok=b.captureRoom>0&&b.rng.next()*100<captureRate(a,t);
  ev.push({t:'capture',a:a.uid,d:t.uid,ok,full:b.captureRoom<=0});
  if(ok){t.alive=false;t.captured=true;b.captureRoom--;(b.captured||=[]).push({mon:t.mon,lv:t.lv});}
  return;
 }
 if(c.kind==='escape'){
  b.escapeTries++;const maxLv=Math.max(...foes(b).map(u=>u.lv));
  const ok=b.canEscape&&b.rng.next()<escapeRate(b.escapeTries,a.luck||1,a.lv,maxLv);
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
  const sk=SKILLS[c.skill],own=a.skills.find(s=>s.id===c.skill),L=own?.lv||1,cost=sk.mp(L);
  if(a.mp<cost){ev.push({t:'msg',text:`${a.name}魔力不足，改用普通攻擊`});return act(b,ev,{...c,kind:'attack'});}
  a.mp-=cost;ev.push({t:'act',a:a.uid,kind:'skill',skill:c.skill,name:sk.name,lv:L,mp:a.mp});skillExp(b,a,c.skill);
  if(sk.kind==='heal'){const c0=b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;
   for(const t of areaOf(b,c0,sk.area)){const n=Math.min(Math.floor(t.rec*(sk.healPct||60)/100*L),t.maxHp-t.hp);t.hp+=n;ev.push({t:'heal',d:t.uid,n,hp:t.hp});}return;}
  if(sk.kind==='cure'){const t=b.units.find(x=>x.uid===c.target&&x.side===a.side&&x.alive)||a;const had=t.st;t.st=null;ev.push({t:'cure',d:t.uid,ok:!!had});return;}
  if(sk.kind==='status'){const t=pickTarget(b,a,c.target);if(t)for(const x of areaOf(b,t,sk.area))inflict(b,ev,a,x,sk.st,L);return;}
  if(sk.kind==='revive'){const t=b.units.find(x=>x.uid===c.target&&x.side===a.side&&!x.alive);if(!t){ev.push({t:'msg',text:'沒有氣絕的人'});return;}
   t.alive=true;t.hp=Math.min(t.maxHp,60*L);ev.push({t:'revive',d:t.uid,hp:t.hp});return;}
  if(sk.kind==='magic'){const t=pickTarget(b,a,c.target);if(t)for(const x of areaOf(b,t,sk.area))if(x.alive)castMagic(b,ev,a,x,sk,L);return;}
  // 物理招
  if(c.skill==='combo'||c.skill==='volley'){
   const n=sk.hits(L),rand=sk.randomTarget(L);let first=pickTarget(b,a,c.target);
   for(let i=0;i<n&&a.alive;i++){const t=rand&&i>0?pickTarget(b,a,null):first?.alive?first:pickTarget(b,a,null);if(!t)break;strike(b,ev,a,t,{mult:1/n,melee:sk.melee});}
   return;
  }
  const t=pickTarget(b,a,c.target);if(!t)return;
  if(c.skill==='allin')strike(b,ev,a,t,{mult:sk.mult(L),hitPenalty:sk.hitPenalty(L)});
  else if(c.skill==='blade'){strike(b,ev,a,t,{atkMult:1+sk.atkUp(L)/100});a.down=sk.selfDown(L)/100;}
  else if(c.skill==='swift'){strike(b,ev,a,t,{atkMult:sk.atkMult(L)});a.skip=2;}
  return;
 }
 // 普通攻擊
 const t=pickTarget(b,a,c.target);if(!t)return;
 ev.push({t:'act',a:a.uid,kind:'attack',ranged:!!a.ranged});
 strike(b,ev,a,t,{melee:!a.ranged});
}

// cmds：我方每個行動 {actor:uid, kind, target, skill, item, useItem}。敵方由 ai.mjs 決定。
export function resolveRound(b,cmds){
 const rng=makeRng(b.rngState);b.rng=rng;b.round++;const ev=[{t:'round',n:b.round}];
 const list=[];
 for(const c of cmds){const u=b.units.find(x=>x.uid===c.actor);if(u?.alive)list.push({...c,actor:u});}
 for(const u of alive(foes(b)))list.push({...chooseEnemyAction(b,u,rng),actor:u});
 // 武將自己決定行動（每回合一次）
 for(const u of alive(allies(b)).filter(u=>(u.ai||u.kind==='pet')&&!cmds.some(c=>c.actor===u.uid)))list.push({...chooseAllyAction(b,u,rng),actor:u});
 // 迅速果斷：下一回合不能行動
 for(const c of list)if(c.actor.skip===1)c.kind='skip';
 for(const c of list){if(c.kind==='defend')c.actor.defending=true;
  c.speed=speedOf(c.actor,rng,0)*(c.kind==='skill'&&c.skill==='swift'?SKILLS.swift.speedMult(c.actor.skills?.find(s=>s.id==='swift')?.lv||1):1)*(c.actor.st?.k==='drunk'?.3:1);}
 list.sort((x,y)=>y.speed-x.speed);
 for(const c of list){if(b.over)break;act(b,ev,c);checkEnd(b,ev);}
 // 回合結束：中毒扣血（◎ 最大生命 8%，不會扣到死），狀態倒數
 if(!b.over)for(const u of b.units){if(!u.alive||!u.st)continue;
  if(u.st.k==='poison'){const n=Math.min(u.hp-1,Math.max(1,Math.floor(u.maxHp*.08)));if(n>0){u.hp-=n;ev.push({t:'poison',d:u.uid,dmg:n,hp:u.hp});}}
  if(--u.st.n<=0){ev.push({t:'recover',d:u.uid,st:u.st.k});u.st=null;}}
 for(const u of b.units){u.defending=false;if(u.skip>0)u.skip--;if(u.down&&!list.some(c=>c.actor===u&&c.skill==='blade'))u.down=null;}
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
 // 武將各自照自己的等級算經驗；氣絕的拿不到（照原作）
 const officerExp=Object.fromEntries(allies(b).filter(u=>u.kind==='officer'&&u.alive).map(u=>[u.oid,beaten.reduce((n,e)=>n+expFrom(e.lv,u.lv),0)]));
 const me=allies(b).find(u=>u.kind==='player');
 const skillGain=Object.fromEntries((me?.skills||[]).filter(s=>s.gain).map(s=>[s.id,s.gain]));
 const pet=allies(b).find(u=>u.kind==='pet'&&u.alive),petExp=pet?beaten.reduce((n,e)=>n+expFrom(e.lv,pet.lv),0):0;
 const repBase=beaten.reduce((n,e)=>n+e.lv,0); // ◎ 每場戰鬥得「敵方等級合計」點聲望（仍受每日上限）
 return {exp:me?.alive?exp:0,items,skillGain,rep:repBase,officerExp,petExp,captured:b.captured||[]};
}
export {SKILL_EXP};
