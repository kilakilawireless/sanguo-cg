// 連自己架的伺服器（api/）：沒有 claude.ai 的 db 時用。介面做成跟 claude.ai 的 db 一樣（doc／collection、get／set／update／delete／add／where／onSnapshot），
// online.mjs 不用改。即時更新靠 SSE（/api/events）：伺服器說哪個路徑變了，訂閱那個路徑（或那個集合）的就再讀一次。
const TOKEN_KEY='sanguo-cg-mud-token';
export const base=()=>globalThis.MUD_API||'';
export const getToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||'';}catch{return '';}};
export const setToken=t=>{try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch{}};
let infoP=null;
// 這個網頁後面有沒有我們的伺服器（開 mud.html 的那台）；1.5 秒沒回就當沒有
export function serverInfo(){
 if(infoP)return infoP;
 return infoP=(async()=>{try{const c=new AbortController();const t=setTimeout(()=>c.abort(),1500);const r=await fetch(base()+'/api/ping',{signal:c.signal});clearTimeout(t);const j=await r.json();return j?.server==='mud'?j:null;}catch{return null;}})();
}
async function post(path,bodyObj,token){
 const r=await fetch(base()+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(bodyObj||{})});
 let j=null;try{j=await r.json();}catch{}
 if(!r.ok){const e=new Error(j?.msg||('HTTP '+r.status));e.code=r.status;e.body=j;throw e;}
 return j;
}
export async function register(name,pass){try{const j=await post('/api/register',{name,pass});setToken(j.token);return {ok:true,name:j.name};}catch(e){return {ok:false,msg:e.message};}}
export async function login(name,pass){try{const j=await post('/api/login',{name,pass});setToken(j.token);return {ok:true,name:j.name};}catch(e){return {ok:false,msg:e.message};}}
export async function logout(){const t=getToken();setToken('');if(t)try{await post('/api/logout',{},t);}catch{}}
// 登入了就回 {db,uid,name}，沒登入回 null
export async function httpNet(){
 const token=getToken();if(!token)return null;const info=await serverInfo();if(!info)return null;
 let me;try{const r=await fetch(base()+'/api/me',{headers:{Authorization:'Bearer '+token}});me=await r.json();}catch{return null;}
 if(!me?.ok){setToken('');return null;}
 return {db:httpDb(token),uid:me.uid,name:me.name};
}
export function httpDb(token){
 const call=(op,path,data,filters)=>post('/api/db',{op,path,data:data??null,filters:filters??null},token);
 const subs=new Set();let es=null;
 const ensureEs=()=>{if(es||typeof EventSource==='undefined')return;es=new EventSource(base()+'/api/events?token='+encodeURIComponent(token));
  es.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}for(const s of [...subs])s(m.path);};
  es.onerror=()=>{};}; // 斷了瀏覽器會自己重連
 const docRef=path=>({path,id:path.split('/').pop(),
  async get(){const r=await call('get',path);return {exists:!!r.exists,id:path.split('/').pop(),data:()=>r.exists?r.data:undefined};},
  set:d=>call('set',path,d),update:d=>call('update',path,d),delete:()=>call('delete',path),
  onSnapshot(fn,err){ensureEs();const run=async()=>{try{const r=await call('get',path);fn({exists:!!r.exists,data:()=>r.exists?r.data:undefined});}catch(e){err?.(e);}};const sub=p=>{if(p===path)run();};subs.add(sub);run();return ()=>subs.delete(sub);}});
 const query=(col,filters)=>({where:(f,op,v)=>query(col,[...filters,[f,op,v]]),
  async get(){const l=await call('query',col,null,filters);return {docs:l.map(x=>({id:x.id,data:()=>x.data}))};},
  onSnapshot(fn,err){ensureEs();const run=async()=>{try{const l=await call('query',col,null,filters);fn({docs:l.map(x=>({id:x.id,data:()=>x.data}))});}catch(e){err?.(e);}};const sub=p=>{if(p.startsWith(col+'/'))run();};subs.add(sub);run();return ()=>subs.delete(sub);},
  doc(id){return docRef(col+'/'+(id||Date.now().toString(36)+Math.random().toString(36).slice(2,8)));},
  async add(d){const r=await call('add',col,d);return docRef(col+'/'+r.id);}});
 return {doc:docRef,collection:col=>query(col,[])};
}
