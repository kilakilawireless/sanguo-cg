// 存檔與擂台名單。自己開（node server.mjs、存下來的網頁）時角色只存在這台瀏覽器的 localStorage，擂台只有常駐好手；
// 發布成 claude.ai 網頁（db、user 兩個能力）時，角色也存進網頁的資料庫：自己的存檔在 data/users/<id>/cg，
// 給大家看、給大家挑戰的那份在 fighters/<id>（對手不在線上也能打，由電腦代打）。每個人只寫自己的那兩份。
import {ITEMS} from '../data/items.mjs';
import {SKILLS} from '../data/skills.mjs';
import {JOBS} from '../data/jobs.mjs';
import {GENERAL_BY_ID} from './generals.mjs';
import {BP_KEYS} from '../core/stats.mjs';
import {stats,capOf,canEquip} from '../core/player.mjs';
import {publicOf,fighterFrom,soloFrom,withMate,MATE_IDS,MK,regrade,petStats,allChars,PET_MAX} from './rules.mjs';
import {roll,maxDur} from './events.mjs';
import {DUNGEON_BY_ID,ensureItem,moveMats,isMat,matCount,takeMat,addMat} from './dungeon.mjs';
import {httpNet} from './httpdb.mjs'; // 也把寶石、水龍系列加進道具表，讀檔前要先有

const KEY='sanguo-cg-mud-v1';

let netP=null;
export function net(){
 if(netP)return netP;
 const c=globalThis.window?.claude;
 // 沒有 claude.ai 的 db（自己架的 fly.io 伺服器、本機 node server.mjs）：用帳號密碼登入，介面一樣（httpdb.mjs）
 if(!c?.use)return netP=globalThis.window?(async()=>{try{return await httpNet();}catch{return null;}})():Promise.resolve(null);
 return netP=(async()=>{try{const [db,user]=await Promise.all([c.use('db'),c.use('user')]);const uid=user?await user.id():null;return db&&uid?{db,uid}:null;}catch{return null;}})();
}

// 讀進來的存檔：缺欄位補回、改版刪掉的道具技能拿掉，免得打開狀態頁當掉
export function fixHero(p){
 if(!p||p.mud!==1||!p.bp||!JOBS[p.job])return null;
 // 加了寶石的裝備要先建出來，不然會被當成壞掉的道具丟掉
 for(const x of Array.isArray(p.bag)?p.bag:[])ensureItem(x?.id);for(const c of [p,...MATE_IDS.map(i=>p[MK(i)]),...(Array.isArray(p.roster)?p.roster:[])])for(const id of Object.values(c?.equip||{}))ensureItem(id);
 p.mats=Object.fromEntries(Object.entries(p.mats&&typeof p.mats==='object'?p.mats:{}).filter(([id,n])=>isMat(id)&&Number.isInteger(n)&&n>0));
 p.bag=(Array.isArray(p.bag)?p.bag:[]).filter(x=>ITEMS[x?.id]&&Number.isFinite(x.n));
 p.flags||={};p.officers={};p.party=[];p.quests||={};p.settings||={speed:1,auto:false};
 // 練功用的技能改成每個角色各自設定（帶頭的、夥伴各一個）
 if(p.settings.huntSkill&&p.huntSkill==null)p.huntSkill=p.settings.huntSkill;delete p.settings.huntSkill;
 if(!Number.isFinite(p.gold))p.gold=0;
 if(p.dg&&!DUNGEON_BY_ID[p.dg.id])p.dg=null;
 moveMats(p);
 mergePets(p);
 fixChar(p);
 // 隨行夥伴：壞掉的就不要了
 if(p.mate&&(!p.mate.bp||!JOBS[p.mate.job]||!p.mate.name))p.mate=null;
 if(p.mate)withMate(p,()=>fixChar(p));else p.mate=null;
 for(const i of MATE_IDS.slice(1)){const k=MK(i);if(p[k]&&(!p[k].bp||!JOBS[p[k].job]||!p[k].name||!p[MK(i-1)]))p[k]=null;if(p[k])withMate(p,()=>fixChar(p),i);else p[k]=null;} // 第二到第四位夥伴（20／30／50 級）
 // 酒館寄放的角色：一樣檢查、補欄位（借夥伴的位置跑 fixChar）
 // 借來的角色（借將）：資料壞了就不要
 if(p.guest){try{for(const id of Object.values(p.guest.f?.equip||{}))ensureItem(id);for(const k of Object.keys(p.guest.f?.equip||{}))if(p.guest.f.equip[k]&&!ITEMS[p.guest.f.equip[k]])p.guest.f.equip[k]=null;}catch{}if(!p.guest.f?.bp||!JOBS[p.guest.f.job]||!GENERAL_BY_ID[p.guest.f.look]||!(p.guest.left>0))p.guest=null;}
 roll(p);
 const keep=p.mate;p.roster=(Array.isArray(p.roster)?p.roster:[]).filter(c=>c?.bp&&JOBS[c.job]&&c.name).map(c=>{p.mate=c;withMate(p,()=>fixChar(p));return p.mate;});p.mate=keep;
 // 同一位收服的只能跟一個人（先碰到的留）
 const seen=new Set();for(const a of allChars(p)){if(!a.c)continue;if(a.c.petOut&&seen.has(a.c.petOut))a.c.petOut=null;if(a.c.petOut)seen.add(a.c.petOut);}
 return p;
}
// 收服的改成全隊共用一池（Leo 2026-10-28：寵物不歸誰、總共 10 位）：舊存檔每個角色各自的 pets 併進 p.pets，uid 撞到的重編、超過 PET_MAX 的丟掉（先留出戰中的）
function mergePets(p){
 const chars=[p,...MATE_IDS.map(i=>p[MK(i)]),...(Array.isArray(p.roster)?p.roster:[])].filter(c=>c&&typeof c==='object');
 const pool=[];let seq=Number.isFinite(p.petSeq)?p.petSeq:0;const uids=new Set();
 for(const c of chars){const list=Array.isArray(c.pets)?c.pets:[];
  for(const x of list){if(!x||typeof x!=='object')continue;if(!x.uid||uids.has(x.uid)){const nu='pet'+(++seq);if(c.petOut===x.uid)c.petOut=nu;x.uid=nu;}uids.add(x.uid);pool.push({x,out:c.petOut===x.uid});
   const n=parseInt(String(x.uid).replace(/^pet/,''),10);if(Number.isFinite(n)&&n>seq)seq=n;}
  if(c!==p){delete c.pets;delete c.petSeq;}}
 const keep=[...pool.filter(q=>q.out),...pool.filter(q=>!q.out)].slice(0,PET_MAX).map(q=>q.x);
 p.pets=keep;p.petSeq=seq;
}
// 每位武將自己的欄位
function fixChar(p){
 // 寵物（Leo 2026-10-27）：壞掉的不要；出戰的那隻要還在
 // 只留收服的冒險者（Leo 2026-10-27：不抓魔物），壞掉的不要
 p.pets=(Array.isArray(p.pets)?p.pets:[]).filter(x=>x&&!x.mon&&Array.isArray(x.grade)&&x.grade.length===5&&Number.isFinite(x.lv)).slice(0,PET_MAX); // p.pets 是全隊共用的一池，每個角色跑到時都檢查一次沒關係
 for(const x of p.pets){if(!GENERAL_BY_ID[x.look])x.look='liaohua';if(!Number.isFinite(x.hp))x.hp=1;if(!Number.isFinite(x.mp))x.mp=0;if(!Number.isFinite(x.exp))x.exp=0;if(typeof x.name!=='string'||!x.name)x.name=GENERAL_BY_ID[x.look].name;if(!Array.isArray(x.learned))x.learned=[];regrade(x);const ps=petStats(x);x.hp=Math.min(x.hp,ps.maxHp);x.mp=Math.min(x.mp,ps.maxMp);}
 if(!p.pets.some(x=>x.uid===p.petOut))p.petOut=null;if(!Number.isFinite(p.petSeq))p.petSeq=p.pets.length;
 // 改成三國武將之前建的角色（魔力寶貝造型）：先給一位武將，狀態頁可以換
 if(!GENERAL_BY_ID[p.look])p.look='liaohua';
 if(p.job==='sorcerer')p.job='priest'; // 咒術師併進傳教士，等級階級技能都留著
 for(const [k,d] of Object.entries({lv:1,exp:0,freeBp:0,rank:0,rep:0,luck:3,w:0,l:0,inj:0}))if(!Number.isFinite(p[k]))p[k]=d;
 for(const k of BP_KEYS)if(!Number.isFinite(p.bp[k]))p.bp[k]=0;
 p.skills=(Array.isArray(p.skills)?p.skills:[]).filter(x=>SKILLS[x?.id]);
 // 技能上限改成照蔚藍各職業表（2026-10-27）：超過的降回上限，學不了的拿掉
 p.skills=p.skills.filter(x=>capOf(p,x.id)>0);for(const x of p.skills)if(x.lv>capOf(p,x.id)){x.lv=capOf(p,x.id);x.exp=0;}
 p.equip={weapon:null,shield:null,head:null,body:null,feet:null,...(p.equip||{})};for(const k of Object.keys(p.equip))if(p.equip[k]&&!ITEMS[p.equip[k]])p.equip[k]=null;
 // 裝備上限照蔚藍表（2026-10-27）：穿不了的收回背包（滿了也放，不讓東西不見）
 for(const [k,id] of Object.entries(p.equip))if(id&&!canEquip(p,id).ok){p.equip[k]=null;p.bag.push({id,n:1});}
 p.elem||={};if(!p.dur||typeof p.dur!=='object')p.dur={};
 const s=stats(p);p.hp=Math.min(Number.isFinite(p.hp)?p.hp:s.maxHp,s.maxHp);p.mp=Math.min(Number.isFinite(p.mp)?p.mp:s.maxMp,s.maxMp);
}
export function loadLocal(){try{const raw=localStorage.getItem(KEY);return raw?fixHero(JSON.parse(raw)):null;}catch{return null;}}
// 存檔碼（Leo 2026-10-27：有人瀏覽器資料被清掉存檔就不見了）：整個角色轉成一串字，貼回來就能接著玩
const CODE_TAG='MUD1.';
export function exportCode(p){return CODE_TAG+btoa(unescape(encodeURIComponent(JSON.stringify(p))));}
export function importCode(str){
 try{const s=String(str||'').trim();if(!s.startsWith(CODE_TAG))return null;
  return fixHero(JSON.parse(decodeURIComponent(escape(atob(s.slice(CODE_TAG.length))))));}catch{return null;}
}
let seenRemote=false,other=null; // seenRemote＝這次有成功問過雲端；other＝雲端另一份比較強的存檔（沒問到雲端就建新角色時才會有）
export function otherSave(){return other;}
export function keepCurrent(){other=null;seenRemote=true;}
async function readRemote(n){const snap=await n.db.doc(`data/users/${n.uid}/cg`).get();const d=snap.exists?snap.data():null;seenRemote=true;
 return {d,remote:d?fixHero(JSON.parse(String(d.hero??'null'))):null};}
// 本機跟雲端各有一份時拿哪份（Leo 2026-10-28：在另一台沒登入先建了新角色、再登入，新角色比較新就把雲端的真正進度蓋掉了）：
//  同一個角色（cid 一樣；舊存檔沒 cid 就看名字）→ 新的那份；不是同一個角色、或新的那份反而比舊的低 5 級以上 → 先用等級高的玩，另一份放 other 讓玩家在「有兩份存檔」那張卡選，選之前雲端不蓋
const sameHero=(a,b)=>a.cid&&b.cid?a.cid===b.cid:a.name===b.name;
export function pickHero(local,remote,remoteT){
 if(!remote)return {p:local,other:null};if(!local)return {p:remote,other:null};
 const newer=(remoteT||0)>=(local.t||0)?remote:local,older=newer===remote?local:remote;
 if(sameHero(local,remote)&&newer.lv>=older.lv-5)return {p:newer,other:null};
 const hi=remote.lv>=local.lv?remote:local;return {p:hi,other:hi===remote?local:remote};
}
export async function loadHero(){
 const local=loadLocal(),n=await net();if(!n)return local;
 try{const {d,remote}=await readRemote(n);const r=pickHero(local,remote,d?.t);other=r.other;return r.p;}catch{}
 return local;
}
// 玩家名稱（Leo 2026-10-28：擂台、借將要知道是誰的角色，要的是帳號主人的名稱、不是帳號）：p.pid 自己填的，沒填就不顯示；寫在 fighters 的 acct、PK 單子的 hostAcct、bouts 的 acct
export const pidOf=p=>String(p?.pid||'').trim().slice(0,12);
let writing=Promise.resolve();
export function saveHero(p){
 p.t=Date.now();const json=JSON.stringify(p);
 try{localStorage.setItem(KEY,json);}catch{}
 if(other)return; // 還有另一份沒選：雲端先不動
 writing=writing.then(async()=>{const n=await net();if(!n||other)return;
  try{
   // 讀檔時沒問到雲端（斷線、太慢），又建了新角色：雲端那份比較強就先別蓋掉，讓玩家選
   if(!seenRemote){const {remote}=await readRemote(n);if(remote&&remote.lv>p.lv){other=remote;seenRemote=false;return;}}
   await n.db.doc(`data/users/${n.uid}/cg`).set({hero:json,t:Date.now()});await n.db.doc(`fighters/${n.uid}`).set({...publicOf(p),acct:pidOf(p),on:Date.now()});}catch{}});
}
export function clearLocal(){try{localStorage.removeItem(KEY);}catch{}}

// 線上的其他玩家（即時更新）
export async function watchRivals(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('fighters').onSnapshot(q=>{
  const out=[],raw=[];for(const d of q.docs){if(d.id===n.uid)continue;raw.push({uid:d.id,name:String(d.data().name||''),x:d.data()});const x=d.data();try{for(const id of Object.values(JSON.parse(String(x.hero)).equip||{}))ensureItem(id);}catch{}const f=fighterFrom(x);if(f)out.push({key:'fighters/'+d.id,uid:d.id,npc:false,name:f.name,acct:String(x.acct||''),look:f.look,lv:f.lv,job:f.job,rank:f.rank,w:+x.w||0,l:+x.l||0,on:+x.on||0,fighter:f,team:soloFrom(x)});}
  on(out.sort((a,b)=>b.lv-a.lv),raw,n.uid);
 },()=>{});
}

// 線上：每 45 秒在自己的 fighters/<id> 寫一下時間，兩分鐘內寫過的算在線上（即時 PK 只能找在線上的人）
export const ONLINE_MS=2*60*1000;
export const isOnline=x=>Date.now()-(+(x?.on)||0)<ONLINE_MS;
let hb=null;
export function heartbeat(){
 if(hb)return;const tick=async()=>{const n=await net();if(!n||globalThis.document?.hidden)return;try{await n.db.doc(`fighters/${n.uid}`).update({on:Date.now()});}catch{}};
 hb=setInterval(tick,45000);setTimeout(tick,3000);
}

// ---------- 即時 PK：pk/<id> 一張單子兩個人寫（Leo 2026-10-28） ----------
// {host,hostName,hostF,guest,guestName,guestF,state:'ask'|'on'|'declined'|'done',seed,t,upd, gc:{n,cmds}（被挑戰的人每回合的指令）, res:{n,ev,snap}（挑戰的人算完的結果）, ff:'host'|'guest'（誰認輸／離開）}
// extra＝團 PK 多帶的欄位（kind:'team'、hostT＝teamOf）
export async function sendChallenge(p,rival,extra={}){
 const n=await net();if(!n||!rival?.uid)return null;const id=`${n.uid}_${Date.now().toString(36)}`;
 // 順手把自己以前開的舊單子清掉
 try{const q=await n.db.collection('pk').where('host','==',n.uid).get();for(const d of q.docs)if(Date.now()-(+d.data().t||0)>10*60*1000)n.db.doc('pk/'+d.id).delete().catch(()=>{});}catch{}
 try{await n.db.doc('pk/'+id).set({host:n.uid,hostName:p.name,hostAcct:pidOf(p),hostF:publicOf(p),guest:rival.uid,guestName:rival.name,state:'ask',seed:(Math.random()*2**31)>>>0,t:Date.now(),upd:Date.now(),...extra});return id;}catch{return null;}
}
// 別人找我 PK（還沒回、還沒過期的）
export async function watchChallenges(on,ttl){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('pk').where('guest','==',n.uid).onSnapshot(q=>on(q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.state==='ask'&&Date.now()-(+x.t||0)<ttl).sort((a,b)=>b.t-a.t)),()=>{});
}
// myT＝團 PK 時自己整隊的描述（teamOf），寫成 guestT
export async function answerChallenge(p,c,ok,myT=null){
 const n=await net();if(!n)return false;
 try{await n.db.doc('pk/'+c.id).update(ok?{state:'on',guestF:publicOf(p),...(myT?{guestT:myT}:{}),upd:Date.now()}:{state:'declined',upd:Date.now()});return true;}catch{return false;}
}
export async function watchPk(id,on){const n=await net();if(!n)return ()=>{};return n.db.doc('pk/'+id).onSnapshot(s=>on(s.exists?{id,...s.data()}:null),()=>{});}
export async function writePk(id,data){const n=await net();if(!n)return false;try{await n.db.doc('pk/'+id).update({...data,upd:Date.now()});return true;}catch{return false;}}
export async function deletePk(id){const n=await net();if(!n||!id)return;try{await n.db.doc('pk/'+id).delete();}catch{}}

// ---------- 組隊打迷宮王：party/<id> 一張單子（Leo 2026-10-28）----------
// {host,hostName,dg,seed,state:'ask'|'on'|'done',t,upd, members:[{uid,name,f}]（隊長寫、第 0 位是隊長）, gc_<uid>:{n,cmds}（隊員每回合的指令）, res:{n,ev,snap}（隊長算完的結果）, ff_<uid>:1（誰離隊）, ffHost:1（隊長解散）}
// 邀請用 pk/ 的單子（kind:'coop'、party:<id>），被邀的人按加入就 answerChallenge → state on＋guestF，隊長收齊後在出發時把 members 寫定
export async function createParty(p,dg){
 const n=await net();if(!n)return null;const id=`${n.uid}_${Date.now().toString(36)}`;
 try{const q=await n.db.collection('party').where('host','==',n.uid).get();for(const d of q.docs)if(Date.now()-(+d.data().t||0)>10*60*1000)n.db.doc('party/'+d.id).delete().catch(()=>{});}catch{}
 try{await n.db.doc('party/'+id).set({host:n.uid,hostName:p.name,dg,state:'ask',seed:(Math.random()*2**31)>>>0,t:Date.now(),upd:Date.now(),members:[{uid:n.uid,name:p.name,f:publicOf(p)}]});return id;}catch{return null;}
}
export async function inviteParty(p,id,dg,rival){
 const n=await net();if(!n||!rival?.uid)return null;const pid=`${n.uid}_c${Date.now().toString(36)}`;
 try{await n.db.doc('pk/'+pid).set({kind:'coop',party:id,dg,host:n.uid,hostName:p.name,hostF:publicOf(p),guest:rival.uid,guestName:rival.name,state:'ask',t:Date.now(),upd:Date.now()});return pid;}catch{return null;}
}
// 我發出去的邀請（看誰加入了、誰婉拒）
export async function watchInvites(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('pk').where('host','==',n.uid).onSnapshot(q=>on(q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.kind==='coop')),()=>{});
}
export async function watchParty(id,on){const n=await net();if(!n)return ()=>{};return n.db.doc('party/'+id).onSnapshot(s=>on(s.exists?{id,...s.data()}:null),()=>{});}
export async function writeParty(id,data){const n=await net();if(!n)return false;try{await n.db.doc('party/'+id).update({...data,upd:Date.now()});return true;}catch{return false;}}
export async function deleteParty(id){const n=await net();if(!n||!id)return;try{await n.db.doc('party/'+id).delete();}catch{}}

// ---------- 布告（Leo 2026-10-28 提案 c：隊伍留言板，組隊前在這裡約人）：chat/<id>＝{uid,name,text,t}，大家能寫，只留最近 BOARD_MAX 則 ----------
export const BOARD_MAX=50,BOARD_LEN=120;
const no=msg=>({ok:false,msg}),yes=msg=>({ok:true,msg});
export async function watchBoard(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('chat').onSnapshot(q=>on(q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x&&typeof x.text==='string').sort((a,b)=>(+b.t||0)-(+a.t||0)).slice(0,BOARD_MAX)),()=>{});
}
export async function postBoard(p,text,list){
 const n=await net();if(!n)return no('沒連上伺服器。');text=String(text||'').replace(/\s+/g,' ').trim();if(!text)return no('先寫點什麼。');if(text.length>BOARD_LEN)return no(`最多 ${BOARD_LEN} 字。`);
 const last=(list||[]).find(x=>x.uid===n.uid);if(last&&Date.now()-(+last.t||0)<5000)return no('慢一點，五秒後再貼。');
 try{await n.db.collection('chat').add({uid:n.uid,name:p.name,text,t:Date.now()});}catch{return no('貼不上去，等一下再試。');}
 // 順手把太舊的刪掉（誰貼誰清）
 try{const q=await n.db.collection('chat').get();const docs=q.docs.map(d=>({id:d.id,t:+d.data().t||0})).sort((a,b)=>b.t-a.t);for(const d of docs.slice(BOARD_MAX+10))n.db.doc('chat/'+d.id).delete().catch(()=>{});}catch{}
 return yes('');
}
export async function deleteBoard(m){const n=await net();if(!n||m.uid!==n.uid)return false;try{await n.db.doc('chat/'+m.id).delete();return true;}catch{return false;}}

// 戰報：bouts/<自己的 id> 存最近 30 場（g:2 是這一版）
const BOUTS_MAX=30;
export async function recordBout(myName,rec,acct=''){
 const n=await net();if(!n)return;const ref=n.db.doc(`bouts/${n.uid}`);
 try{const snap=await ref.get();const list=((snap.exists?snap.data()?.list:[])||[]).slice(-(BOUTS_MAX-1));list.push({...rec,g:2});await ref.set({name:myName,acct:String(acct||''),list});}catch{}
}
// 別人來挑戰我的紀錄
export async function boutsAgainstMe(){
 const n=await net();if(!n)return [];
 try{const q=await n.db.collection('bouts').get(),me='fighters/'+n.uid,out=[];
  for(const d of q.docs){if(d.id===n.uid)continue;const x=d.data();for(const r of x?.list||[])if(r.g===2&&r.vs===me)out.push({...r,byName:String(x.name||'')+(x.acct?`（${x.acct}）`:'')});}
  return out.sort((a,b)=>b.t-a.t).slice(0,20);
 }catch{return [];}
}

// ---------- 交易所 ◎（原作是擺攤，這裡改成大家共用的一張掛單表） ----------
// market/<id>：{seller,sellerName,item,n,price,t,buyer,buyerName}。上架時東西先從道具欄拿走；
// 有人買了就在單子上寫下買家，賣家下次打開時收錢、把單子刪掉。沒有交易鎖：買的時候寫完隔一下再讀一次，確定是自己才算成交。
import {ITEMS as IT} from '../data/items.mjs';
import * as PL from '../core/player.mjs';
export const PRICE_MAX=999999,LIST_MAX=10;
const okListing=x=>x&&ensureItem(x.item)&&IT[x.item]&&IT[x.item].kind!=='key'&&Number.isInteger(x.n)&&x.n>0&&Number.isInteger(x.price)&&x.price>0&&x.price<=PRICE_MAX&&typeof x.seller==='string';
export async function watchMarket(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('market').onSnapshot(q=>on(q.docs.map(d=>({id:d.id,...d.data()})).filter(okListing).sort((a,b)=>b.t-a.t),n.uid),()=>{});
}
const give=(p,id,n)=>isMat(id)?addMat(p,id,n):PL.addItem(p,id,n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function postListing(p,id,price,mine){
 const n=await net();if(!n)return {ok:false,msg:'離線版沒有交易所。'};
 price=Math.floor(+price);if(!(price>0&&price<=PRICE_MAX))return {ok:false,msg:`價錢要 1～${PRICE_MAX} 金。`};
 if(mine>=LIST_MAX)return {ok:false,msg:`最多同時掛 ${LIST_MAX} 張單。`};
 const it=IT[id],mat=isMat(id),cnt=mat?matCount(p,id):PL.countItem(p,id);if(!it||it.kind==='key'||!cnt)return {ok:false,msg:'這個不能賣。'};
 const e0=it.slot&&p.bag.find(x=>x.id===id);if(e0?.dur!=null&&e0.dur<maxDur(id))return {ok:false,msg:'這件有磨損，先穿上到工房修好再上架。'};
 const nn=it.slot?1:cnt;if(mat)takeMat(p,id,nn);else PL.removeItem(p,id,nn);saveHero(p);
 try{await n.db.collection('market').add({seller:n.uid,sellerName:p.name,item:id,n:nn,price,t:Date.now(),buyer:null,buyerName:null});}
 catch{if(mat)addMat(p,id,nn);else PL.addItem(p,id,nn);saveHero(p);return {ok:false,msg:'上架失敗，東西還給你了。'};}
 return {ok:true,msg:`${it.name}${nn>1?` ×${nn}`:''}上架了，${price} 金。`};
}
export async function cancelListing(p,l){
 const n=await net();if(!n||l.seller!==n.uid)return {ok:false,msg:''};
 const ref=n.db.doc('market/'+l.id);
 try{const s=await ref.get();if(!s.exists)return {ok:false,msg:'單子已經不在了。'};if(s.data().buyer)return {ok:false,msg:'已經有人買走了。'};
  const room=isMat(l.item)||(IT[l.item].slot?p.bag.length+l.n<=PL.BAG_SIZE:PL.countItem(p,l.item)>0||p.bag.length<PL.BAG_SIZE);if(!room)return {ok:false,msg:'道具欄滿了，先空出位置。'};
  await ref.delete();give(p,l.item,l.n);saveHero(p);return {ok:true,msg:`收回了${IT[l.item].name}。`};}catch{return {ok:false,msg:'沒辦法收回，等一下再試。'};}
}
export async function buyListing(p,l){
 const n=await net();if(!n)return {ok:false,msg:''};if(l.seller===n.uid)return {ok:false,msg:'不能買自己的東西。'};
 if(p.gold<l.price)return {ok:false,msg:`錢不夠：要 ${l.price} 金。`};
 const room=isMat(l.item)||(IT[l.item].slot?p.bag.length+l.n<=PL.BAG_SIZE:PL.countItem(p,l.item)>0||p.bag.length<PL.BAG_SIZE);if(!room)return {ok:false,msg:'道具欄滿了。'};
 const ref=n.db.doc('market/'+l.id);
 try{let s=await ref.get();if(!s.exists||s.data().buyer)return {ok:false,msg:'晚了一步，被別人買走了。'};
  await ref.update({buyer:n.uid,buyerName:p.name,boughtAt:Date.now()});
  p.gold-=l.price;saveHero(p); // 先付錢，確定沒搶輸再拿東西；搶輸了退錢
  await sleep(1200);s=await ref.get();
  // 單子不見了＝賣家已經收錢把單子刪了（只有賣家會刪，而且要先有 buyer），也算買到
  if(!s.exists||s.data().buyer===n.uid){give(p,l.item,l.n);saveHero(p);return {ok:true,msg:`買到${IT[l.item].name}${l.n>1?` ×${l.n}`:''}，付了 ${l.price} 金。`};}
  p.gold+=l.price;saveHero(p);return {ok:false,msg:'晚了一步，被別人買走了，錢退給你。'};
 }catch{return {ok:false,msg:'交易沒成功，等一下再試。'};}
}
// 賣掉的單子：刪掉單子再收錢（刪不掉就不收，免得收兩次）
const collecting=new Set();
export async function collectSales(p,list){
 const n=await net();if(!n)return [];const got=[];
 for(const l of list){if(l.seller!==n.uid||!l.buyer||collecting.has(l.id))continue;collecting.add(l.id);
  // 買家付錢後會等 1.2 秒再確認單子上是不是自己；賣家在線上收得太快會把單子刪掉害他誤判，所以先等 3 秒
  try{const age=Date.now()-(+l.boughtAt||0);if(age<3000)await sleep(3000-age);await n.db.doc('market/'+l.id).delete();p.gold+=l.price;got.push(`交易所：${l.buyerName||'有人'}買了你的${IT[l.item].name}${l.n>1?` ×${l.n}`:''}，收到 ${l.price} 金。`);}catch{collecting.delete(l.id);}}
 if(got.length)saveHero(p);return got;
}
