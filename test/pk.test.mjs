// 即時 PK（Leo 2026-10-28）：挑戰的人算回合、對方照著播；單子寫在資料庫。這裡用假的資料庫跑一遍。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../www/src/mud/rules.mjs';
import * as P from '../www/src/core/player.mjs';
import * as B from '../www/src/core/battle.mjs';

// ---- 假的 db／user（照 artifact 的 db 介面：doc/collection、get/set/update/delete、where、onSnapshot、add）----
function fakeDb(){
 const docs=new Map(),subs=[];const notify=()=>{for(const s of [...subs])s();};
 const docRef=path=>({path,id:path.split('/').pop(),
  async get(){return {exists:docs.has(path),id:path.split('/').pop(),data:()=>docs.get(path)};},
  async set(d){docs.set(path,JSON.parse(JSON.stringify(d)));notify();},
  async update(d){if(!docs.has(path))throw new Error('no doc');docs.set(path,{...docs.get(path),...JSON.parse(JSON.stringify(d))});notify();},
  async delete(){docs.delete(path);notify();},
  onSnapshot(fn){const run=()=>fn({exists:docs.has(path),data:()=>docs.get(path)});subs.push(run);run();return ()=>{const i=subs.indexOf(run);if(i>=0)subs.splice(i,1);};}});
 const query=(col,filters)=>({where:(f,op,v)=>query(col,[...filters,[f,op,v]]),
  match(){return [...docs.entries()].filter(([k,v])=>k.startsWith(col+'/')&&k.split('/').length===2&&filters.every(([f,op,val])=>op==='=='?v[f]===val:true)).map(([k,v])=>({id:k.split('/').pop(),data:()=>v}));},
  async get(){return {docs:this.match()};},
  onSnapshot(fn){const run=()=>fn({docs:this.match()});subs.push(run);run();return ()=>{const i=subs.indexOf(run);if(i>=0)subs.splice(i,1);};},
  doc(id){return docRef(col+'/'+(id||Math.random().toString(36).slice(2)));},
  async add(d){const r=this.doc();await r.set(d);return r;}});
 return {docs,doc:docRef,collection:col=>query(col,[])};
}
const db=fakeDb();
globalThis.window={claude:{use:async name=>name==='db'?db:name==='user'?{id:async()=>'u1'}:null}};
const O=await import('../www/src/mud/online.mjs');

const hero=(name,job,look)=>{const p=R.newHero({name,look,bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:3}).player;R.joinJob(p,job);p.lv=12;return p;};
const A=hero('甲','sword','zhaoyun'),Bp=hero('乙','axe','xuchu');
const fighterOf=p=>R.fighterFrom(R.publicOf(p));

test('resolveRound：對面玩家自己下的令會用，不再電腦代打', ()=>{
 const b=R.startBout(A,fighterOf(Bp),7);
 const ev=B.resolveRound(b,[{actor:'p',kind:'defend'},{actor:'p',kind:'defend'},{actor:'e0',kind:'defend'},{actor:'e0',kind:'defend'}]);
 assert.equal(ev.filter(e=>e.t==='hit').length,0);
 assert.equal(ev.filter(e=>e.t==='act'&&e.kind==='defend'&&e.a==='e0').length,2);
 const b2=R.startBout(A,fighterOf(Bp),7);const ev2=B.resolveRound(b2,[{actor:'p',kind:'defend'},{actor:'p',kind:'defend'}]);
 assert.ok(ev2.some(e=>e.a==='e0'&&e.t==='act'&&e.kind!=='defend'),'沒給指令時還是電腦代打');
});

test('pkCmds 只信攻擊／防禦／技能，招要會的，數量照行動次數補齊', ()=>{
 const b=R.startBout(A,fighterOf(Bp),7);
 const out=R.pkCmds(b,'e0',[{actor:'e0',kind:'escape'},{actor:'e0',kind:'skill',skill:'nope',target:'p'},{actor:'e0',kind:'attack',target:'zzz'},{actor:'p',kind:'attack',target:'e0'}]);
 assert.equal(out.length,B.actionsOf(b,b.units[1]));
 assert.deepEqual(out[0],{actor:'e0',kind:'attack',target:null});assert.equal(out[1].kind,'defend');
 assert.equal(R.pkCmds(b,'e0',[]).every(c=>c.kind==='defend'),true);
});

test('兩邊各自的戰鬥物件：挑戰的人算完、對方蓋上快照後數字一樣（uid、勝負對調）', ()=>{
 const seed=1234,host=R.startBout(A,fighterOf(Bp),seed),guest=R.startBout(Bp,fighterOf(A),seed);
 const guestCmds=[{actor:'p',kind:'attack',target:'e0'},{actor:'p',kind:'attack',target:'e0'}]; // 對方那邊的視角
 const gc=R.pkCmds(host,'e0',R.flipCmds(R.cleanCmds(guestCmds)));assert.deepEqual(gc.map(c=>c.actor),['e0','e0']);assert.deepEqual(gc.map(c=>c.target),['p','p']);
 const ev=B.resolveRound(host,[{actor:'p',kind:'attack',target:'e0'},{actor:'p',kind:'attack',target:'e0'},...gc]);
 const snap=JSON.parse(JSON.stringify(R.pkSnap(host))),fev=R.flipEvents(JSON.parse(JSON.stringify(ev)));
 R.pkApply(guest,snap);
 const hp=(b,id)=>b.units.find(u=>u.uid===id).hp;
 assert.equal(guest.round,1);assert.equal(hp(guest,'p'),hp(host,'e0'));assert.equal(hp(guest,'e0'),hp(host,'p'));assert.equal(guest.rngState,host.rngState);
 assert.ok(ev.some(e=>e.t==='hit'));
 for(const [e,f] of ev.map((e,i)=>[e,fev[i]])){if(e.a!=null)assert.equal(f.a,e.a==='p'?'e0':'p');if(e.d!=null)assert.equal(f.d,e.d==='p'?'e0':'p');}
 host.over='win';R.pkApply(guest,R.pkSnap(host));assert.equal(guest.over,'lose');
 host.over='draw';R.pkApply(guest,R.pkSnap(host));assert.equal(guest.over,'draw');
});

test('單子流程：邀請→接受→寫指令→寫結果→刪掉', async()=>{
 const id=await O.sendChallenge(A,{uid:'u1',name:'乙'}); // 自己邀自己，當成對方也是 u1
 assert.ok(id);const got=[];const un=await O.watchChallenges(l=>got.push(l),R.PK_ASK_TTL);
 assert.equal(got.at(-1).length,1);assert.equal(got.at(-1)[0].state,'ask');assert.ok(got.at(-1)[0].hostF.hero);
 assert.equal(await O.answerChallenge(Bp,got.at(-1)[0],true),true);
 const seen=[];const un2=await O.watchPk(id,d=>seen.push(d));
 assert.equal(seen.at(-1).state,'on');assert.ok(R.fighterFrom(seen.at(-1).guestF));
 assert.equal(got.at(-1).length,0,'接受後就不再是待回覆的邀請');
 await O.writePk(id,{gc:{n:1,cmds:[{actor:'p',kind:'attack',target:'e0'}]}});assert.equal(seen.at(-1).gc.n,1);
 await O.writePk(id,{res:{n:1,ev:[],snap:{round:1}}});assert.equal(seen.at(-1).res.n,1);assert.equal(seen.at(-1).gc.n,1,'update 只蓋自己那幾欄');
 await O.deletePk(id);assert.equal(seen.at(-1),null);un();un2();
 assert.equal(O.isOnline({on:Date.now()-60*1000}),true);assert.equal(O.isOnline({on:Date.now()-3*60*1000}),false);assert.equal(O.isOnline({}),false);
});

test('交易所：上架、買、收錢、收回', async()=>{
 const p=hero('丙','sword','zhaoyun');p.gold=1000;P.addItem(p,'potion',3);
 const r=await O.postListing(p,'potion',50,0);assert.equal(r.ok,true,r.msg);assert.equal(P.countItem(p,'potion'),0);
 let list=[];const un=await O.watchMarket(l=>{list=l;});assert.equal(list.length,1);assert.equal(list[0].seller,'u1');
 // 別人買了我的：單子上寫了買家，我這邊收錢、單子刪掉
 await db.doc('market/'+list[0].id).update({buyer:'u9',buyerName:'丁'});
 const got=await O.collectSales(p,list);assert.equal(got.length,1);assert.equal(p.gold,1050);assert.equal(list.length,0);
 // 買別人的
 await db.collection('market').add({seller:'u9',sellerName:'丁',item:'bun',n:2,price:30,t:Date.now(),buyer:null,buyerName:null});
 assert.equal(list.length,1);const r2=await O.buyListing(p,list[0]);assert.equal(r2.ok,true,r2.msg);assert.equal(p.gold,1020);assert.equal(P.countItem(p,'bun'),2);
 assert.equal((await O.buyListing(p,list[0])).ok,false,'同一張不能買兩次');
 // 收回自己的
 P.addItem(p,'potion2',1);await O.postListing(p,'potion2',80,0);const mine=list.find(l=>l.seller==='u1');assert.ok(mine);
 const r3=await O.cancelListing(p,mine);assert.equal(r3.ok,true);assert.equal(P.countItem(p,'potion2'),1);un();
});
