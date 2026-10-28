// 自己架伺服器用的小資料庫（Leo 2026-10-28：claude.ai 的資料庫只有擁有者能寫，朋友掛單看不到）。
// 介面照 claude.ai 的 db 來：路徑「集合/文件」，get／set／update／delete／add／query（只支援 ==），改了就通知訂閱的人。
// 全部放記憶體；落地交給 persist（Node 版 filestore.mjs 整份寫 db.json，Cloudflare 版一筆一筆放 Durable Object storage）。
// 這個檔不能 import node:*，Cloudflare Workers 也要能跑。
export class Store{
 constructor(persist=null){this.docs=new Map();this.subs=new Set();this.persist=persist;}
 // light＝只有 on（心跳）在改：通知訂閱的人，但不寫進持久儲存（Cloudflare 每天寫入次數有限）
 changed(p,light=false){for(const s of [...this.subs])try{s(p);}catch{}
  if(this.persist&&!light)try{this.docs.has(p)?this.persist.put(p,this.docs.get(p)):this.persist.del(p);}catch(e){console.error('db persist failed',e?.message);}}
 flush(){try{this.persist?.flush?.();}catch{}}
 get(p){return this.docs.has(p)?{exists:true,data:this.docs.get(p)}:{exists:false,data:null};}
 set(p,d){this.docs.set(p,clone(d));this.changed(p);}
 update(p,d){if(!this.docs.has(p))throw new Error('not_found');const keys=Object.keys(d||{});this.docs.set(p,{...this.docs.get(p),...clone(d)});this.changed(p,keys.length>0&&keys.every(k=>k==='on'));}
 delete(p){const had=this.docs.delete(p);if(had)this.changed(p);}
 add(col,d){const id=newId();this.set(col+'/'+id,d);return id;}
 query(col,filters=[]){const depth=col.split('/').length+1,out=[];
  for(const [k,v] of this.docs){if(!k.startsWith(col+'/')||k.split('/').length!==depth)continue;if(filters.every(([f,op,val])=>op==='=='?v?.[f]===val:op==='!='?v?.[f]!==val:op==='in'?Array.isArray(val)&&val.includes(v?.[f]):true))out.push({id:k.slice(col.length+1),data:v});}
  return out.sort((a,b)=>a.id<b.id?-1:1);}
}
const clone=d=>JSON.parse(JSON.stringify(d??null));
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
// 誰能讀寫哪裡：自己的存檔 data/users/<自己>、名片 fighters/<自己>、戰報 bouts/<自己> 只有自己能寫；交易所 market、PK 單子 pk、組隊單 party 登入的人都能寫；_auth 只有伺服器自己
export const PUBLIC_COLS=new Set(['market','pk','party']);
export const OWN_COLS=new Set(['fighters','bouts']);
export function canRead(uid,p){const s=p.split('/');if(s[0]==='_auth')return false;if(s[0]==='data'&&s[1]==='users')return s[2]===uid;return true;}
export function canWrite(uid,p){const s=p.split('/');if(!uid||s.some(x=>!x))return false;if(s[0]==='data'&&s[1]==='users')return s[2]===uid&&s.length>=4;if(OWN_COLS.has(s[0]))return s[1]===uid&&s.length===2;return PUBLIC_COLS.has(s[0])&&s.length===2;}
export function canQuery(uid,col){const s=col.split('/');return s[0]!=='_auth'&&!(s[0]==='data'&&s[1]==='users');}
