// Cloudflare Workers 版的伺服器（Leo 2026-10-28：fly.io 要綁卡，Cloudflare 免費方案不用）。
// 靜態檔由 Workers Assets 直接出（wrangler.toml 的 [assets]，www/）；/api/* 全部交給一個 Durable Object（整個遊戲只有一個，名字 main），
// 資料在它的 storage 裡（每筆文件一個 key，啟動時全部讀進記憶體，之後照 api/store.mjs 的規矩跑），即時推送走 WebSocket /api/ws（hibernation API，沒人說話時不計費）。
import {DurableObject} from 'cloudflare:workers';
import {Store} from '../api/store.mjs';
import {makeApi} from '../api/index.mjs';
export class MudDb extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   const store=new Store({put:(p,d)=>ctx.storage.put(p,d),del:p=>ctx.storage.delete(p)});
   for(const [k,v] of await ctx.storage.list())store.docs.set(k,v);
   this.api=makeApi({store,ws:true});
   store.subs.add(p=>{if(p.startsWith('_auth/'))return;const line=JSON.stringify({path:p});for(const w of ctx.getWebSockets())try{w.send(line);}catch{}});
  });
 }
 async fetch(req){
  await this.ready;
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
export default{
 fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/'))return env.DB.get(env.DB.idFromName('main')).fetch(req);
  return env.ASSETS.fetch(req);
 }
};
