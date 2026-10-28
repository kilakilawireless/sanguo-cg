// 自己架伺服器用的小資料庫（Leo 2026-10-28：claude.ai 的資料庫只有擁有者能寫，朋友掛單看不到）。
// 介面照 claude.ai 的 db 來：路徑「集合/文件」，get／set／update／delete／add／query（只支援 ==），改了就通知訂閱的人。
// 全部放記憶體，改了就（延遲 300ms）整份寫到 DATA_DIR/db.json；玩家幾十人、幾 MB 以內夠用。
import fs from 'node:fs';
import path from 'node:path';
export class Store{
 constructor(file){this.file=file;this.docs=new Map();this.subs=new Set();this.timer=null;this.load();}
 load(){if(!this.file)return;try{const j=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const [k,v] of Object.entries(j))this.docs.set(k,v);}catch{}}
 flush(){if(!this.file)return;clearTimeout(this.timer);this.timer=null;try{fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(Object.fromEntries(this.docs)));fs.renameSync(tmp,this.file);}catch(e){console.error('db save failed',e.message);}}
 changed(p){for(const s of [...this.subs])try{s(p);}catch{}if(this.file&&!this.timer)this.timer=setTimeout(()=>this.flush(),300);}
 get(p){return this.docs.has(p)?{exists:true,data:this.docs.get(p)}:{exists:false,data:null};}
 set(p,d){this.docs.set(p,clone(d));this.changed(p);}
 update(p,d){if(!this.docs.has(p))throw new Error('not_found');this.docs.set(p,{...this.docs.get(p),...clone(d)});this.changed(p);}
 delete(p){const had=this.docs.delete(p);if(had)this.changed(p);}
 add(col,d){const id=newId();this.set(col+'/'+id,d);return id;}
 query(col,filters=[]){const depth=col.split('/').length+1,out=[];
  for(const [k,v] of this.docs){if(!k.startsWith(col+'/')||k.split('/').length!==depth)continue;if(filters.every(([f,op,val])=>op==='=='?v?.[f]===val:op==='!='?v?.[f]!==val:op==='in'?Array.isArray(val)&&val.includes(v?.[f]):true))out.push({id:k.slice(col.length+1),data:v});}
  return out.sort((a,b)=>a.id<b.id?-1:1);}
}
const clone=d=>JSON.parse(JSON.stringify(d??null));
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
// 誰能讀寫哪裡：自己的存檔 data/users/<自己>、名片 fighters/<自己>、戰報 bouts/<自己> 只有自己能寫；交易所 market、PK 單子 pk 登入的人都能寫；_auth 只有伺服器自己
export const PUBLIC_COLS=new Set(['market','pk']);
export const OWN_COLS=new Set(['fighters','bouts']);
export function canRead(uid,p){const s=p.split('/');if(s[0]==='_auth')return false;if(s[0]==='data'&&s[1]==='users')return s[2]===uid;return true;}
export function canWrite(uid,p){const s=p.split('/');if(!uid||s.some(x=>!x))return false;if(s[0]==='data'&&s[1]==='users')return s[2]===uid&&s.length>=4;if(OWN_COLS.has(s[0]))return s[1]===uid&&s.length===2;return PUBLIC_COLS.has(s[0])&&s.length===2;}
export function canQuery(uid,col){const s=col.split('/');return s[0]!=='_auth'&&!(s[0]==='data'&&s[1]==='users');}
