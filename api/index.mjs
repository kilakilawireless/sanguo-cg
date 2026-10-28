// /api/*：帳號、資料庫、即時推送（SSE）。server.mjs 把 /api 開頭的請求丟進來。
import {Store,canRead,canWrite,canQuery} from './store.mjs';
import {register,login,whoIs,logout} from './auth.mjs';
export function makeApi(file){
 const store=new Store(file),streams=new Set();
 store.subs.add(p=>{if(p.startsWith('_auth/'))return;const line=`data: ${JSON.stringify({path:p})}\n\n`;for(const r of [...streams])try{r.write(line);}catch{streams.delete(r);}});
 setInterval(()=>{for(const r of [...streams])try{r.write(': ping\n\n');}catch{streams.delete(r);}},25000).unref();
 const json=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 const body=req=>new Promise((ok,bad)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6){bad(new Error('too big'));req.destroy();}});req.on('end',()=>{try{ok(s?JSON.parse(s):{});}catch{bad(new Error('bad json'));}});req.on('error',bad);});
 const tokenOf=(req,url)=>{const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):url.searchParams.get('token')||'';};
 async function handle(req,res,url){
  const p=url.pathname;
  if(p==='/api/ping')return json(res,200,{ok:true,server:'mud',users:store.query('_auth/users').length});
  if(req.method==='POST'&&(p==='/api/register'||p==='/api/login')){let b;try{b=await body(req);}catch{return json(res,400,{ok:false,msg:'資料格式不對。'});}
   const r=(p==='/api/register'?register:login)(store,String(b.name||'').trim(),String(b.pass||''));return json(res,r.ok?200:400,r);}
  const me=whoIs(store,tokenOf(req,url));
  if(p==='/api/me')return json(res,200,me?{ok:true,uid:me.uid,name:me.name}:{ok:false});
  if(!me)return json(res,401,{ok:false,msg:'沒登入。'});
  if(p==='/api/logout'){logout(store,tokenOf(req,url));return json(res,200,{ok:true});}
  if(p==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'});res.write(': hi\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return;}
  if(p==='/api/db'&&req.method==='POST'){let b;try{b=await body(req);}catch{return json(res,400,{ok:false,msg:'資料格式不對。'});}
   const {op,path,data,filters}=b;if(typeof path!=='string'||path.length>200||/[^\w\-./]/.test(path))return json(res,400,{ok:false,msg:'路徑不對。'});
   try{
    if(op==='get'){if(!canRead(me.uid,path))return json(res,200,{exists:false,data:null});return json(res,200,store.get(path));}
    if(op==='query'){if(!canQuery(me.uid,path))return json(res,403,{ok:false});return json(res,200,store.query(path,Array.isArray(filters)?filters.filter(f=>Array.isArray(f)&&f.length===3):[]));}
    if(op==='add'){if(!canWrite(me.uid,path+'/x'))return json(res,403,{ok:false,msg:'不能寫這裡。'});return json(res,200,{id:store.add(path,data)});}
    if(!canWrite(me.uid,path))return json(res,403,{ok:false,msg:'不能寫這裡。'});
    if(op==='set'){store.set(path,data);return json(res,200,{ok:true});}
    if(op==='update'){try{store.update(path,data);}catch{return json(res,404,{ok:false,msg:'沒有這份。'});}return json(res,200,{ok:true});}
    if(op==='delete'){store.delete(path);return json(res,200,{ok:true});}
   }catch(e){return json(res,500,{ok:false,msg:e.message});}
   return json(res,400,{ok:false,msg:'不認識的操作。'});}
  json(res,404,{ok:false});
 }
 return {store,handle,close(){store.flush();}};
}
