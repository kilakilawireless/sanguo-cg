// /api/*：帳號、資料庫、即時推送。用標準的 Request／Response 寫，Node（server.mjs）和 Cloudflare Workers（cf/worker.mjs）共用同一份。
// 即時推送：這裡提供 SSE /api/events（Node 用）；Cloudflare 版另外在 Durable Object 上開 WebSocket /api/ws（ping 會回 ws:true，網頁端就改連 WebSocket）。
import {canRead,canWrite,canQuery} from './store.mjs';
import {register,login,whoIs,logout} from './auth.mjs';
export function makeApi({store,ws=false}){
 const streams=new Set(),enc=new TextEncoder();
 const push=line=>{for(const c of [...streams])try{c.enqueue(enc.encode(line));}catch{streams.delete(c);}};
 store.subs.add(p=>{if(p.startsWith('_auth/'))return;push(`data: ${JSON.stringify({path:p})}\n\n`);});
 const pinger=setInterval(()=>push(': ping\n\n'),25000);pinger.unref?.();
 const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 const bodyOf=async req=>{const t=await req.text();if(t.length>1e6)throw new Error('too big');return t?JSON.parse(t):{};};
 const tokenOf=(req,url)=>{const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')?h.slice(7):url.searchParams.get('token')||'';};
 async function handle(req){
  const url=new URL(req.url),p=url.pathname;
  if(p==='/api/ping')return json(200,{ok:true,server:'mud',ws,users:store.query('_auth/users').length});
  if(req.method==='POST'&&(p==='/api/register'||p==='/api/login')){let b;try{b=await bodyOf(req);}catch{return json(400,{ok:false,msg:'資料格式不對。'});}
   const r=await (p==='/api/register'?register:login)(store,String(b.name||'').trim(),String(b.pass||''));return json(r.ok?200:400,r);}
  const me=whoIs(store,tokenOf(req,url));
  if(p==='/api/me')return json(200,me?{ok:true,uid:me.uid,name:me.name}:{ok:false});
  if(!me)return json(401,{ok:false,msg:'沒登入。'});
  if(p==='/api/logout'){logout(store,tokenOf(req,url));return json(200,{ok:true});}
  if(p==='/api/events'){let ctl;const body=new ReadableStream({start(c){ctl=c;streams.add(c);c.enqueue(enc.encode(': hi\n\n'));},cancel(){streams.delete(ctl);}});
   return new Response(body,{status:200,headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'}});}
  if(p==='/api/db'&&req.method==='POST'){let b;try{b=await bodyOf(req);}catch{return json(400,{ok:false,msg:'資料格式不對。'});}
   const {op,path,data,filters}=b;if(typeof path!=='string'||path.length>200||/[^\w\-./]/.test(path))return json(400,{ok:false,msg:'路徑不對。'});
   try{
    if(op==='get'){if(!canRead(me.uid,path))return json(200,{exists:false,data:null});return json(200,store.get(path));}
    if(op==='query'){if(!canQuery(me.uid,path))return json(403,{ok:false});return json(200,store.query(path,Array.isArray(filters)?filters.filter(f=>Array.isArray(f)&&f.length===3):[]));}
    if(op==='add'){if(!canWrite(me.uid,path+'/x'))return json(403,{ok:false,msg:'不能寫這裡。'});return json(200,{id:store.add(path,data)});}
    if(!canWrite(me.uid,path))return json(403,{ok:false,msg:'不能寫這裡。'});
    if(op==='set'){store.set(path,data);return json(200,{ok:true});}
    if(op==='update'){try{store.update(path,data);}catch{return json(404,{ok:false,msg:'沒有這份。'});}return json(200,{ok:true});}
    if(op==='delete'){store.delete(path);return json(200,{ok:true});}
   }catch(e){return json(500,{ok:false,msg:e.message});}
   return json(400,{ok:false,msg:'不認識的操作。'});}
  return json(404,{ok:false});
 }
 return {store,handle,whoIs:token=>whoIs(store,token),close(){clearInterval(pinger);store.flush();}};
}
