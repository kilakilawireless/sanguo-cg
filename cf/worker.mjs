// Cloudflare Workers 版的伺服器（Leo 2026-10-28：fly.io 要綁卡，Cloudflare 免費方案不用）。
// 靜態檔由 Workers Assets 直接出（wrangler.toml 的 [assets]，www/）；/api/* 全部交給一個 Durable Object（整個遊戲只有一個，名字 main），
// 資料在它的 storage 裡（每筆文件一個 key，啟動時全部讀進記憶體，之後照 api/store.mjs 的規矩跑），即時推送走 WebSocket /api/ws（hibernation API，沒人說話時不計費）。
import {DurableObject} from 'cloudflare:workers';
import {Store} from '../api/store.mjs';
import {makeApi} from '../api/index.mjs';
import {BUILD} from '../www/src/mud/version.mjs';
export class MudDb extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   const store=new Store({put:(p,d)=>ctx.storage.put(p,d),del:p=>ctx.storage.delete(p)});
   for(const [k,v] of await ctx.storage.list())store.docs.set(k,v);
   this.api=makeApi({store,ws:true,adminKey:env.ADMIN_KEY||''}); // ADMIN_KEY＝wrangler secret（GitHub secret ADMIN_KEY 部署時放進去），備份用
   store.subs.add(p=>{if(p.startsWith('_auth/'))return;const line=JSON.stringify({path:p});for(const w of ctx.getWebSockets())try{w.send(line);}catch{}});
  });
 }
 async fetch(req){
  await this.ready;
  // 部署新版後這個物件不會馬上換程式（Leo 2026-10-28：網頁已經是新版、/api/ping 還回舊版本號）：最外層的 Worker 每次都把自己的版本放在 x-build，
  // 跟這份程式的不一樣就自己重啟（abort 會丟錯，外層接住再打一次就是新程式；記憶體裡的東西 storage 都有，只掉「on」那種不落地的心跳）
  const hb=req.headers.get('x-build');if(hb&&hb!==BUILD&&hb!=='dev'&&BUILD!=='dev')this.ctx.abort('new build '+hb);
  const url=new URL(req.url);
  if(url.pathname==='/api/ws'){
   if(req.headers.get('Upgrade')!=='websocket')return new Response('expected websocket',{status:426});
   if(!this.api.whoIs(url.searchParams.get('token')||''))return new Response('沒登入',{status:401});
   const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);
   return new Response(null,{status:101,webSocket:pair[0]});
  }
  return this.api.handle(req);
 }
 webSocketMessage(ws,msg){if(msg==='ping')try{ws.send('pong');}catch{}}
 webSocketClose(ws){try{ws.close();}catch{}}
 webSocketError(ws){try{ws.close();}catch{}}
}
// 靜態檔由 Workers Assets 在進到這支程式之前就出了（存在的路徑不會跑到下面的 fetch），而且本來就帶 max-age=0, must-revalidate（每次重新驗證），
// 所以裝成 App 拿到舊程式不是快取的問題，是 App 一直開著沒重新載入——靠網頁端的版本比對（app.mjs checkBuild）處理。
// /api/*：交給 Durable Object，帶上這份 Worker 的版本；物件發現版本不同會 abort 自己重啟，這時再打一次就是新程式。
// /api/ping 的 build 由這裡（每次請求都是最新部署的程式）蓋上去，不信物件回的
async function api(req,env){
 const id=env.DB.idFromName('main'),h=new Headers(req.headers);h.set('x-build',BUILD);
 if(req.headers.get('Upgrade'))return env.DB.get(id).fetch(new Request(req,{headers:h})); // WebSocket 不重試
 const body=req.method==='GET'||req.method==='HEAD'?null:await req.arrayBuffer(); // 先把 body 讀起來，重試才有得送
 const mk=()=>new Request(req.url,{method:req.method,headers:h,body});
 let r;try{r=await env.DB.get(id).fetch(mk());}catch{r=await env.DB.get(id).fetch(mk());}
 if(new URL(req.url).pathname==='/api/ping'&&r.ok){try{const j=await r.json();j.build=BUILD;return new Response(JSON.stringify(j),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}catch{}}
 return r;
}
export default{
 fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/'))return api(req,env);
  return env.ASSETS.fetch(req);
 }
};
