// 活動（Leo 2026-10-27 選的六個企劃）：世界王、擂台賽季、每日委託、裝備耐久、借將、圖鑑成就。純規則，不碰畫面。
// 大家共用的數字（世界王傷害、賽季積分、借將紀錄、稱號）都寫在自己的 fighters/<id>（publicOf 帶出去），別人讀全部 fighters 來排名，
// 所以不用多開資料表，也不會有人改到別人的資料。週、日照台灣時間，週一換週。◎ 數字都是自訂的。
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import * as D from './dungeon.mjs';
import {createBattle} from '../core/battle.mjs';
import {ITEMS} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {MONSTERS} from '../data/monsters.mjs';

const yes=(msg,x={})=>({ok:true,msg,...x}),no=msg=>({ok:false,msg});
const TZ=8*3600e3;
export const dayKey=(t=Date.now())=>Math.floor((t+TZ)/864e5);
export const weekKey=(t=Date.now())=>Math.floor((dayKey(t)+3)/7); // 1970-01-01 是週四，+3 讓週一換週
const rand=n=>Math.floor(Math.random()*n);
const randGem=g=>D.gemId(D.GRADED_GEMS[rand(D.GRADED_GEMS.length)],Math.max(1,Math.min(10,g)));
// 發獎：gold、gem（等級）、rep、title
export function grant(p,r){
 const out=[];
 if(r.gold){p.gold+=r.gold;out.push(`${r.gold} 金`);}
 if(r.rep){const n=P.gainRep(p,r.rep);if(n)out.push(`聲望 ${n}`);}
 if(r.gem){const id=randGem(r.gem);D.addMat(p,id);out.push(ITEMS[id].name);}
 if(r.title){p.titles||=[];if(!p.titles.includes(r.title)){p.titles.push(r.title);out.push(`稱號「${r.title}」`);}}
 return out.join('、');
}

// 每次讀檔、每場打完都先換日換週
export function roll(p){
 const day=dayKey(),wk=weekKey();
 p.wb||={wk,dmg:0,day,tries:0};
 if(p.wb.wk!==wk){if(p.wb.dmg>0)p.wbPrev={wk:p.wb.wk,dmg:p.wb.dmg,claimed:false};p.wb={wk,dmg:0,day,tries:0};}
 if(p.wb.day!==day){p.wb.day=day;p.wb.tries=0;}
 p.season||={wk,pts:0,day,n:0};
 if(p.season.wk!==wk){if(p.season.pts>0)p.seasonPrev={wk:p.season.wk,pts:p.season.pts,claimed:false};p.season={wk,pts:0,day,n:0};}
 if(p.season.day!==day){p.season.day=day;p.season.n=0;}
 if(!p.daily||p.daily.day!==day)p.daily=newDaily(p,day);
 p.codex||={kill:{},boss:{},forge:0,wbTotal:0};p.ach||={};p.titles||=[];p.dur||={};
}
// 某一週的排名：docs＝[{uid,name,x}]（x＝別人 fighters 文件），自己的那份用本機的
function standings(docs,me,p,wk,cur,prev,mine){
 const rows=[];for(const d of docs){if(d.uid===me)continue;const v=d.x?.[cur]?.wk===wk?d.x[cur]:d.x?.[prev]?.wk===wk?d.x[prev]:null;const n=+(v?.dmg??v?.pts)||0;if(n>0)rows.push({uid:d.uid,name:d.name,n});}
 if(mine>0)rows.push({uid:me,name:p.name,n:mine,me:true});
 return rows.sort((a,b)=>b.n-a.n);
}

// ---------- 世界王 ----------
// 每週一隻，生命大家共用；一天挑戰 3 次、每次 5 回合，打掉多少算多少。王的強度跟著帶頭的人的等級走
export const WB_HP=200000,WB_TRIES=3,WB_ROUNDS=5;
export const WB_LIST=[
 {name:'樹精長老',job:'priest',look:'xuchu',elem:{earth:10},kit:['heal2','regen2','earth2','poison2']},
 {name:'咆哮的神獸',job:'axe',look:'dianwei',elem:{fire:10},kit:['allin','terror','smash','counter']},
 {name:'詛咒之王',job:'priest',look:'jiaxu',elem:{wind:10},kit:['sleep2','confuse2','forget2','wind2']},
 {name:'海神',job:'spear',look:'lubu',elem:{water:10},kit:['combo','blade','honor','counter']},
];
export const wbOf=(wk=weekKey())=>WB_LIST[wk%WB_LIST.length];
export const wbBoard=(docs,me,p,wk=weekKey())=>standings(docs,me,p,wk,'wb','wbp',wk===p.wb?.wk?p.wb.dmg:p.wbPrev?.wk===wk?p.wbPrev.dmg:0);
export const wbLeft=(docs,me,p)=>Math.max(0,WB_HP-wbBoard(docs,me,p).reduce((n,r)=>n+r.n,0));
export function startWorld(p,left,seed){
 roll(p);if(p.lv<10)return no('10 級以上才能挑戰世界王。');if(p.wb.tries>=WB_TRIES)return no(`今天的 ${WB_TRIES} 次用完了，明天再來。`);if(left<=0)return no('這週的世界王已經被打倒了，下週一換新的。');
 const w=wbOf(),lv=p.lv,f=R.buildFighter(lv,w.job,w.look,w.name,w.elem,seed%100000,w.kit,D.bossRank(lv));f.name=w.name;
 const party=R.partyUnits(p).map(u=>({...u,hp:u.maxHp,mp:u.maxMp})); // 世界王照擂台：補滿打、打完不扣
 const b=createBattle({party,enemies:[],seed,canEscape:false});b.pvp=true;b.world=true;
 const u=R.fullUnit(f);u.maxHp=WB_HP;u.hp=left;
 b.units.push({...u,uid:'e0',side:'enemy',ai:true,boss:true,mon:'chief',row:'front',slot:0,alive:true,defending:false,skip:0,down:null,st:null});
 b.wbStart=left;p.wb.tries++;return yes('',{b:R.mudBattle(b)});
}
export const worldTimeout=b=>{if(!b.over&&b.round>=WB_ROUNDS)b.over='timeup';};
export function finishWorld(p,b){
 const boss=b.units.find(u=>u.uid==='e0'),dmg=Math.max(0,b.wbStart-Math.max(0,boss.hp));
 roll(p);p.wb.dmg+=dmg;p.codex.wbTotal+=dmg;track(p,'world');
 const lines=[`對${boss.name}造成 ${dmg} 傷害（這週累計 ${p.wb.dmg}）。`];
 const g=grant(p,{gold:Math.round(dmg*.3)});if(g)lines.push(`拿到 ${g}。`);
 if(!boss.alive||boss.hp<=0){lines.push(`${boss.name}倒下了！你打出最後一擊。`);lines.push('最後一擊獎勵：'+grant(p,{gem:Math.round(p.lv/8)+2}));}
 return lines;
}
// 上週的排名獎（第 1 名 7 級寶石、前 3 名 5 級、其他有出手的 3 級；有打倒再加一級）
export function wbPrize(docs,me,p){
 const v=p.wbPrev;if(!v||v.claimed||v.dmg<=0)return null;const rows=wbBoard(docs,me,p,v.wk),rank=rows.findIndex(r=>r.me)+1,killed=rows.reduce((n,r)=>n+r.n,0)>=WB_HP;
 return {rank,total:rows.length,killed,gem:(rank===1?7:rank<=3?5:3)+(killed?1:0)};
}
export function claimWb(docs,me,p){const z=wbPrize(docs,me,p);if(!z)return no('');p.wbPrev.claimed=true;return yes(`上週世界王第 ${z.rank} 名：拿到 ${grant(p,{gem:z.gem,title:z.rank===1?'討伐王':null})}。`);}

// ---------- 擂台賽季 ----------
// 每週一季：贏真人 3 分、贏常駐好手 1 分、平手 1 分；一天只算前 10 場
export const SEASON_DAILY=10;
export function seasonBout(p,result,npc){
 roll(p);track(p,'bout');if(p.season.n>=SEASON_DAILY)return '';p.season.n++;
 const pts=result==='win'?(npc?1:3):result==='draw'?1:0;p.season.pts+=pts;return pts?`賽季積分 +${pts}（這週 ${p.season.pts}）。`:'';
}
export const seasonBoard=(docs,me,p,wk=weekKey())=>standings(docs,me,p,wk,'s','sp',wk===p.season?.wk?p.season.pts:p.seasonPrev?.wk===wk?p.seasonPrev.pts:0);
export function seasonPrize(docs,me,p){
 const v=p.seasonPrev;if(!v||v.claimed||v.pts<=0)return null;const rows=seasonBoard(docs,me,p,v.wk),rank=rows.findIndex(r=>r.me)+1;
 return {rank,total:rows.length,...(rank===1?{gem:6,title:'擂台王者'}:rank<=3?{gem:4,title:'擂台好手'}:rank<=10?{gem:2}:{}),gold:1000};
}
export function claimSeason(docs,me,p){const z=seasonPrize(docs,me,p);if(!z)return no('');p.seasonPrev.claimed=true;return yes(`上週賽季第 ${z.rank} 名：拿到 ${grant(p,z)}。`);}

// ---------- 每日委託（酒館） ----------
const DAILY_KINDS={kill:['打倒魔物',[15,25,40]],dungeon:['通關地下城',[1]],forge:['在工房打造裝備',[1,2]],bout:['擂台比武',[3,5]],world:['挑戰世界王',[1]],floor:['地下城往下走一層',[3,5]]};
function newDaily(p,day){
 const ks=Object.keys(DAILY_KINDS).filter(k=>k!=='world'||p.lv>=10),pick=[];
 while(pick.length<3&&ks.length)pick.push(ks.splice(rand(ks.length),1)[0]);
 return {day,tasks:pick.map(k=>{const ns=DAILY_KINDS[k][1];return {k,need:ns[rand(ns.length)],got:0,claimed:false};}),bonus:false};
}
export const dailyName=t=>`${DAILY_KINDS[t.k][0]} ${t.need}${t.k==='kill'?' 隻':t.k==='forge'?' 件':t.k==='bout'?' 場':' 次'}`;
export function track(p,k,n=1){if(!p.daily)return;for(const t of p.daily.tasks)if(t.k===k&&!t.claimed)t.got=Math.min(t.need,t.got+n);}
export const dailyReward=p=>({gold:p.lv*60,rep:100+p.lv*5});
export function claimDaily(p,i){
 const t=p.daily?.tasks[i];if(!t||t.claimed||t.got<t.need)return no('');t.claimed=true;let msg=`委託完成：${grant(p,dailyReward(p))}。`;
 if(!p.daily.bonus&&p.daily.tasks.every(x=>x.claimed)){p.daily.bonus=true;msg+=` 三個都做完，另外拿到 ${grant(p,{gem:Math.max(1,Math.round(p.lv/10))})}。`;}
 return yes(msg);
}

// ---------- 裝備耐久 ----------
// 練功、地下城每打一場，身上每件裝備耐久 −1；到 0 就壞了，戰鬥中沒有效果，到工房修理
export const maxDur=id=>100+20*(ITEMS[id]?.lv||1);
export const durOf=(c,slot)=>{const id=c.equip?.[slot];if(!id)return null;const v=c.dur?.[slot];return v==null?maxDur(id):v;};
export const brokenSlots=c=>Object.keys(c.equip||{}).filter(s=>c.equip[s]&&durOf(c,s)<=0);
export const repairFee=(c,slot)=>{const id=c.equip[slot];if(!id)return 0;const lost=1-durOf(c,slot)/maxDur(id);return lost<=0?0:Math.max(1,Math.ceil(D.forgeFee(ITEMS[id])*.3*lost));};
export function wear(c){const broke=[];c.dur||={};for(const s of Object.keys(c.equip||{})){const id=c.equip[s];if(!id)continue;const before=durOf(c,s);if(before<=0)continue;c.dur[s]=before-1;if(before-1<=0)broke.push(ITEMS[id].name);}return broke;}
export function repair(p,c,slot){
 const slots=slot?[slot]:Object.keys(c.equip||{}).filter(s=>c.equip[s]),fee=slots.reduce((n,s)=>n+repairFee(c,s),0);
 if(!fee)return no('不用修。');if(p.gold<fee)return no(`修理費要 ${fee} 金。`);
 p.gold-=fee;for(const s of slots)if(c.equip[s])c.dur[s]=maxDur(c.equip[s]);return yes(`修好了，花了 ${fee} 金。`);
}

// ---------- 借將（酒館） ----------
// 借一位線上玩家的角色當第三人，跟著打 5 場練功或地下城（電腦代打、不拿經驗）；租金 等級×30，一半給角色的主人（他下次上線時收）
export const GUEST_FIGHTS=5;
export const guestFee=f=>f.lv*30;
export function borrow(p,r){
 if(!r?.fighter||r.npc)return no('');if(p.mate2||!p.mate)return no(p.mate2?'隊伍已經三個人了。':'要先有一位隨行夥伴，才能再借一位。');
 const fee=guestFee(r.fighter);if(p.gold<fee)return no(`租金要 ${fee} 金。`);
 p.gold-=fee;const uid=r.key.split('/')[1];p.guest={uid,name:r.name,f:r.fighter,left:GUEST_FIGHTS};
 p.borLog=[...(p.borLog||[]),{to:uid,fee:Math.floor(fee/2),t:Date.now()}].slice(-10);
 return yes(`借到${r.name}（Lv${r.fighter.lv}），會跟你打 ${GUEST_FIGHTS} 場。`);
}
export const guestOn=p=>!!(p.guest&&p.guest.left>0&&!p.mate2&&R.goingMates(p).length===1);
export function guestUsed(p){if(!p.guest)return '';p.guest.left--;if(p.guest.left>0)return '';const n=p.guest.name;p.guest=null;return `${n}的借期到了，回去了。`;}
// 別人借了我的角色：從大家的 fighters 文件找寫給我的租金
export function collectLends(p,docs,me){
 const got=[];p.lendT||={};
 for(const d of docs){if(d.uid===me)continue;let top=p.lendT[d.uid]||0;
  for(const e of d.x?.bor||[])if(e?.to===me&&+e.t>(p.lendT[d.uid]||0)&&Number.isInteger(e.fee)&&e.fee>0&&e.fee<=100000){p.gold+=e.fee;got.push(`${d.name}借了你的角色，收到 ${e.fee} 金。`);top=Math.max(top,+e.t);}
  p.lendT[d.uid]=top;}
 return got;
}

// ---------- 圖鑑、成就 ----------
let monMemo=null;
export function allMonsters(){
 if(monMemo)return monMemo;const s=new Set();
 for(const k of R.HUNT_SPOTS){const pl=PLACES[k];for(const [id] of pl.mons||[])s.add(id);for(let f=1;f<=(pl.floors||0);f++)for(const [id] of pl.floorMons?.(f)||[])s.add(id);}
 for(const d of D.DUNGEONS)for(const id of d.mons)s.add(id);
 return monMemo=[...s].filter(id=>MONSTERS[id]).sort((a,b)=>(MONSTERS[a].lv||0)-(MONSTERS[b].lv||0));
}
export function recordKills(p,b){
 if(b.over!=='win')return;let n=0;
 for(const u of b.units)if(u.side==='enemy'&&u.mon&&u.mon!=='chief'&&!u.alive){p.codex.kill[u.mon]=(p.codex.kill[u.mon]||0)+1;n++;}
 if(n)track(p,'kill',n);
}
const kills=p=>Object.values(p.codex?.kill||{}).reduce((a,b)=>a+b,0);
const dgDone=p=>Object.keys(p.flags?.dg||{}).length;
export const ACH=[
 ['kill100','討伐魔物 100 隻',p=>[kills(p),100],{gold:2000},'見習獵人'],
 ['kill1000','討伐魔物 1000 隻',p=>[kills(p),1000],{gem:4},'魔物剋星'],
 ['kill5000','討伐魔物 5000 隻',p=>[kills(p),5000],{gem:7},'屠魔者'],
 ['mon','圖鑑收集一半的魔物',p=>[Object.keys(p.codex?.kill||{}).length,Math.ceil(allMonsters().length/2)],{gem:3},'魔物學者'],
 ['monAll','圖鑑收集全部魔物',p=>[Object.keys(p.codex?.kill||{}).length,allMonsters().length],{gem:7},'魔物博士'],
 ['dg5','通關 5 座地下城',p=>[dgDone(p),5],{gold:5000},'探險新手'],
 ['dg15','通關 15 座地下城',p=>[dgDone(p),15],{gem:5},'探險家'],
 ['dgAll','通關全部地下城',p=>[dgDone(p),D.DUNGEONS.length],{gem:9},'迷宮踏破'],
 ['forge10','打造 10 件裝備',p=>[p.codex?.forge||0,10],{gold:5000},'學徒工匠'],
 ['forge100','打造 100 件裝備',p=>[p.codex?.forge||0,100],{gem:6},'名匠'],
 ['win10','擂台 10 勝',p=>[p.w||0,10],{gold:3000},'挑戰者'],
 ['win100','擂台 100 勝',p=>[p.w||0,100],{gem:6},'百戰百勝'],
 ['wb10k','世界王累積 1 萬傷害',p=>[p.codex?.wbTotal||0,10000],{gem:3},'討伐隊員'],
 ['wb100k','世界王累積 10 萬傷害',p=>[p.codex?.wbTotal||0,100000],{gem:6},'討伐英雄'],
 ['lv50','升到 50 級',p=>[p.lv,50],{gold:10000},'老練冒險者'],
 ['lv80','升到 80 級',p=>[p.lv,80],{gem:8},'傳說冒險者'],
];
export function claimAch(p,key){
 const a=ACH.find(x=>x[0]===key);if(!a||p.ach?.[key])return no('');const [v,need]=a[2](p);if(v<need)return no('還沒達成。');
 p.ach[key]=Date.now();return yes(`成就「${a[1]}」：拿到 ${grant(p,{...a[3],title:a[4]})}。`);
}
