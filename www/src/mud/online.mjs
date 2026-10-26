// 存檔與擂台名單。自己開（node server.mjs、存下來的網頁）時角色只存在這台瀏覽器的 localStorage，擂台只有常駐好手；
// 發布成 claude.ai 網頁（db、user 兩個能力）時，角色也存進網頁的資料庫：自己的存檔在 data/users/<id>/cg，
// 給大家看、給大家挑戰的那份在 fighters/<id>（對手不在線上也能打，由電腦代打）。每個人只寫自己的那兩份。
import {ITEMS} from '../data/items.mjs';
import {SKILLS} from '../data/skills.mjs';
import {JOBS} from '../data/jobs.mjs';
import {LOOKS} from '../data/looks.mjs';
import {BP_KEYS} from '../core/stats.mjs';
import {stats} from '../core/player.mjs';
import {publicOf,fighterFrom} from './rules.mjs';

const KEY='sanguo-cg-mud-v1';

let netP=null;
export function net(){
 if(netP)return netP;
 const c=globalThis.window?.claude;if(!c?.use)return netP=Promise.resolve(null);
 return netP=(async()=>{try{const [db,user]=await Promise.all([c.use('db'),c.use('user')]);const uid=user?await user.id():null;return db&&uid?{db,uid}:null;}catch{return null;}})();
}

// 讀進來的存檔：缺欄位補回、改版刪掉的道具技能拿掉，免得打開狀態頁當掉
export function fixHero(p){
 if(!p||p.mud!==1||!p.bp||!JOBS[p.job]||!LOOKS.some(l=>l.id===p.look))return null;
 for(const [k,d] of Object.entries({lv:1,exp:0,freeBp:0,rank:0,rep:0,gold:0,luck:3,w:0,l:0,inj:0}))if(!Number.isFinite(p[k]))p[k]=d;
 for(const k of BP_KEYS)if(!Number.isFinite(p.bp[k]))p.bp[k]=0;
 p.bag=(Array.isArray(p.bag)?p.bag:[]).filter(x=>ITEMS[x?.id]&&Number.isFinite(x.n));
 p.skills=(Array.isArray(p.skills)?p.skills:[]).filter(x=>SKILLS[x?.id]);
 p.equip={weapon:null,head:null,body:null,feet:null,...(p.equip||{})};for(const k of Object.keys(p.equip))if(p.equip[k]&&!ITEMS[p.equip[k]])p.equip[k]=null;
 p.flags||={};p.officers={};p.party=[];p.pets=[];p.petOut=null;p.quests||={};p.settings||={speed:1,auto:false};p.elem||={};
 const s=stats(p);p.hp=Math.min(Number.isFinite(p.hp)?p.hp:s.maxHp,s.maxHp);p.mp=Math.min(Number.isFinite(p.mp)?p.mp:s.maxMp,s.maxMp);
 return p;
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
