// 存檔與擂台名單。自己開（node server.mjs、存下來的網頁）時角色只存在這台瀏覽器的 localStorage，擂台只有常駐好手；
// 發布成 claude.ai 網頁（db、user 兩個能力）時，角色也存進網頁的資料庫：自己的存檔在 data/users/<id>/cg，
// 給大家看、給大家挑戰的那份在 fighters/<id>（對手不在線上也能打，由電腦代打）。每個人只寫自己的那兩份。
import {ITEMS} from '../data/items.mjs';
import {SKILLS} from '../data/skills.mjs';
import {JOBS} from '../data/jobs.mjs';
import {GENERAL_BY_ID} from './generals.mjs';
import {BP_KEYS} from '../core/stats.mjs';
import {stats} from '../core/player.mjs';
import {publicOf,fighterFrom,withMate} from './rules.mjs';
import {DUNGEON_BY_ID} from './dungeon.mjs'; // 也把寶石、水龍系列加進道具表，讀檔前要先有

const KEY='sanguo-cg-mud-v1';

let netP=null;
export function net(){
 if(netP)return netP;
 const c=globalThis.window?.claude;if(!c?.use)return netP=Promise.resolve(null);
 return netP=(async()=>{try{const [db,user]=await Promise.all([c.use('db'),c.use('user')]);const uid=user?await user.id():null;return db&&uid?{db,uid}:null;}catch{return null;}})();
}

// 讀進來的存檔：缺欄位補回、改版刪掉的道具技能拿掉，免得打開狀態頁當掉
export function fixHero(p){
 if(!p||p.mud!==1||!p.bp||!JOBS[p.job])return null;
 p.bag=(Array.isArray(p.bag)?p.bag:[]).filter(x=>ITEMS[x?.id]&&Number.isFinite(x.n));
 p.flags||={};p.officers={};p.party=[];p.pets=[];p.petOut=null;p.quests||={};p.settings||={speed:1,auto:false};
 if(!Number.isFinite(p.gold))p.gold=0;
 if(p.dg&&!DUNGEON_BY_ID[p.dg.id])p.dg=null;
 fixChar(p);
 // 隨行夥伴：壞掉的就不要了
 if(p.mate&&(!p.mate.bp||!JOBS[p.mate.job]||!p.mate.name))p.mate=null;
 if(p.mate)withMate(p,()=>fixChar(p));else p.mate=null;
 return p;
}
// 每位武將自己的欄位
function fixChar(p){
 // 改成三國武將之前建的角色（魔力寶貝造型）：先給一位武將，狀態頁可以換
 if(!GENERAL_BY_ID[p.look])p.look='liaohua';
 for(const [k,d] of Object.entries({lv:1,exp:0,freeBp:0,rank:0,rep:0,luck:3,w:0,l:0,inj:0}))if(!Number.isFinite(p[k]))p[k]=d;
 for(const k of BP_KEYS)if(!Number.isFinite(p.bp[k]))p.bp[k]=0;
 p.skills=(Array.isArray(p.skills)?p.skills:[]).filter(x=>SKILLS[x?.id]);
 p.equip={weapon:null,head:null,body:null,feet:null,...(p.equip||{})};for(const k of Object.keys(p.equip))if(p.equip[k]&&!ITEMS[p.equip[k]])p.equip[k]=null;
 p.elem||={};
 const s=stats(p);p.hp=Math.min(Number.isFinite(p.hp)?p.hp:s.maxHp,s.maxHp);p.mp=Math.min(Number.isFinite(p.mp)?p.mp:s.maxMp,s.maxMp);
}
export function loadLocal(){try{const raw=localStorage.getItem(KEY);return raw?fixHero(JSON.parse(raw)):null;}catch{return null;}}
export async function loadHero(){
 const local=loadLocal(),n=await net();if(!n)return local;
 try{const snap=await n.db.doc(`data/users/${n.uid}/cg`).get();const d=snap.exists?snap.data():null;
  const remote=d?fixHero(JSON.parse(String(d.hero??'null'))):null;
  // 新的那份（手機、電腦都能玩）
  if(remote&&(!local||(d.t||0)>=(local.t||0)))return remote;
 }catch{}
 return local;
}
let writing=Promise.resolve();
export function saveHero(p){
 p.t=Date.now();const json=JSON.stringify(p);
 try{localStorage.setItem(KEY,json);}catch{}
 writing=writing.then(async()=>{const n=await net();if(!n)return;
  try{await n.db.doc(`data/users/${n.uid}/cg`).set({hero:json,t:Date.now()});await n.db.doc(`fighters/${n.uid}`).set(publicOf(p));}catch{}});
}
export function clearLocal(){try{localStorage.removeItem(KEY);}catch{}}

// 線上的其他玩家（即時更新）
export async function watchRivals(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('fighters').onSnapshot(q=>{
  const out=[];for(const d of q.docs){if(d.id===n.uid)continue;const x=d.data(),f=fighterFrom(x);if(f)out.push({key:'fighters/'+d.id,npc:false,name:f.name,look:f.look,lv:f.lv,job:f.job,rank:f.rank,w:+x.w||0,l:+x.l||0,fighter:f});}
  on(out.sort((a,b)=>b.lv-a.lv));
 },()=>{});
}

// 戰報：bouts/<自己的 id> 存最近 30 場（g:2 是這一版）
const BOUTS_MAX=30;
export async function recordBout(myName,rec){
 const n=await net();if(!n)return;const ref=n.db.doc(`bouts/${n.uid}`);
 try{const snap=await ref.get();const list=((snap.exists?snap.data()?.list:[])||[]).slice(-(BOUTS_MAX-1));list.push({...rec,g:2});await ref.set({name:myName,list});}catch{}
}
// 別人來挑戰我的紀錄
export async function boutsAgainstMe(){
 const n=await net();if(!n)return [];
 try{const q=await n.db.collection('bouts').get(),me='fighters/'+n.uid,out=[];
  for(const d of q.docs){if(d.id===n.uid)continue;const x=d.data();for(const r of x?.list||[])if(r.g===2&&r.vs===me)out.push({...r,byName:String(x.name||'')});}
  return out.sort((a,b)=>b.t-a.t).slice(0,20);
 }catch{return [];}
}

// ---------- 交易所 ◎（原作是擺攤，這裡改成大家共用的一張掛單表） ----------
// market/<id>：{seller,sellerName,item,n,price,t,buyer,buyerName}。上架時東西先從道具欄拿走；
// 有人買了就在單子上寫下買家，賣家下次打開時收錢、把單子刪掉。沒有交易鎖：買的時候寫完隔一下再讀一次，確定是自己才算成交。
import {ITEMS as IT} from '../data/items.mjs';
import * as PL from '../core/player.mjs';
export const PRICE_MAX=999999,LIST_MAX=10;
const okListing=x=>x&&IT[x.item]&&IT[x.item].kind!=='key'&&Number.isInteger(x.n)&&x.n>0&&Number.isInteger(x.price)&&x.price>0&&x.price<=PRICE_MAX&&typeof x.seller==='string';
export async function watchMarket(on){
 const n=await net();if(!n)return ()=>{};
 return n.db.collection('market').onSnapshot(q=>on(q.docs.map(d=>({id:d.id,...d.data()})).filter(okListing).sort((a,b)=>b.t-a.t),n.uid),()=>{});
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function postListing(p,id,price,mine){
 const n=await net();if(!n)return {ok:false,msg:'離線版沒有交易所。'};
 price=Math.floor(+price);if(!(price>0&&price<=PRICE_MAX))return {ok:false,msg:`價錢要 1～${PRICE_MAX} 金。`};
 if(mine>=LIST_MAX)return {ok:false,msg:`最多同時掛 ${LIST_MAX} 張單。`};
 const it=IT[id],cnt=PL.countItem(p,id);if(!it||it.kind==='key'||!cnt)return {ok:false,msg:'這個不能賣。'};
 const nn=it.slot?1:cnt;PL.removeItem(p,id,nn);saveHero(p);
 try{await n.db.collection('market').add({seller:n.uid,sellerName:p.name,item:id,n:nn,price,t:Date.now(),buyer:null,buyerName:null});}
 catch{PL.addItem(p,id,nn);saveHero(p);return {ok:false,msg:'上架失敗，東西還給你了。'};}
 return {ok:true,msg:`${it.name}${nn>1?` ×${nn}`:''}上架了，${price} 金。`};
}
export async function cancelListing(p,l){
 const n=await net();if(!n||l.seller!==n.uid)return {ok:false,msg:''};
 const ref=n.db.doc('market/'+l.id);
 try{const s=await ref.get();if(!s.exists)return {ok:false,msg:'單子已經不在了。'};if(s.data().buyer)return {ok:false,msg:'已經有人買走了。'};
  const room=IT[l.item].slot?p.bag.length+l.n<=PL.BAG_SIZE:PL.countItem(p,l.item)>0||p.bag.length<PL.BAG_SIZE;if(!room)return {ok:false,msg:'道具欄滿了，先空出位置。'};
  await ref.delete();PL.addItem(p,l.item,l.n);saveHero(p);return {ok:true,msg:`收回了${IT[l.item].name}。`};}catch{return {ok:false,msg:'沒辦法收回，等一下再試。'};}
}
export async function buyListing(p,l){
 const n=await net();if(!n)return {ok:false,msg:''};if(l.seller===n.uid)return {ok:false,msg:'不能買自己的東西。'};
 if(p.gold<l.price)return {ok:false,msg:`錢不夠：要 ${l.price} 金。`};
 const room=IT[l.item].slot?p.bag.length+l.n<=PL.BAG_SIZE:PL.countItem(p,l.item)>0||p.bag.length<PL.BAG_SIZE;if(!room)return {ok:false,msg:'道具欄滿了。'};
 const ref=n.db.doc('market/'+l.id);
 try{let s=await ref.get();if(!s.exists||s.data().buyer)return {ok:false,msg:'晚了一步，被別人買走了。'};
  await ref.update({buyer:n.uid,buyerName:p.name,boughtAt:Date.now()});
  p.gold-=l.price;saveHero(p); // 先付錢，確定沒搶輸再拿東西；搶輸了退錢
  await sleep(1200);s=await ref.get();
  if(s.exists&&s.data().buyer===n.uid){PL.addItem(p,l.item,l.n);saveHero(p);return {ok:true,msg:`買到${IT[l.item].name}${l.n>1?` ×${l.n}`:''}，付了 ${l.price} 金。`};}
  p.gold+=l.price;saveHero(p);return {ok:false,msg:'晚了一步，被別人買走了，錢退給你。'};
 }catch{return {ok:false,msg:'交易沒成功，等一下再試。'};}
}
// 賣掉的單子：刪掉單子再收錢（刪不掉就不收，免得收兩次）
const collecting=new Set();
export async function collectSales(p,list){
 const n=await net();if(!n)return [];const got=[];
 for(const l of list){if(l.seller!==n.uid||!l.buyer||collecting.has(l.id))continue;collecting.add(l.id);
  try{await n.db.doc('market/'+l.id).delete();p.gold+=l.price;got.push(`交易所：${l.buyerName||'有人'}買了你的${IT[l.item].name}${l.n>1?` ×${l.n}`:''}，收到 ${l.price} 金。`);}catch{collecting.delete(l.id);}}
 if(got.length)saveHero(p);return got;
}
