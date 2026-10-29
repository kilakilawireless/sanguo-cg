// 即時 PK（Leo 2026-10-28）：挑戰的人算回合、對方照著播；單子寫在資料庫。這裡用假的資料庫跑一遍。
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRng} from '../www/src/core/rng.mjs';
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

test('交易所：上架、買、收錢、收回、選數量', async()=>{
 const p=hero('丙','sword','zhaoyun');p.gold=1000;P.addItem(p,'potion',3);
 const r=await O.postListing(p,'potion',50,0);assert.equal(r.ok,true,r.msg);assert.equal(P.countItem(p,'potion'),0);
 let list=[],sales=[];const un=await O.watchMarket((l,u,s)=>{list=l;sales=s;});assert.equal(list.length,1);assert.equal(list[0].seller,'u1');assert.equal(list[0].each,50);assert.equal(list[0].n,3);
 // 舊版：別人在單子上寫了買家，我這邊收錢、單子刪掉
 await db.doc('market/'+list[0].id).update({buyer:'u9',buyerName:'丁'});
 const got=await O.collectSales(p,list,sales);assert.equal(got.length,1);assert.equal(p.gold,1150);assert.equal(list.length,0);
 // 買別人的：舊單（只有總價）只能整批
 await db.collection('market').add({seller:'u9',sellerName:'丁',item:'bun',n:2,price:30,t:Date.now(),buyer:null,buyerName:null});
 assert.equal(list.length,1);assert.equal(O.unitOf(list[0]),null);const r2=await O.buyListing(p,list[0],1);assert.equal(r2.ok,true,r2.msg);assert.equal(p.gold,1120);assert.equal(P.countItem(p,'bun'),2);
 assert.equal(list.length,0,'整批買走單子就刪了');assert.equal(sales.length,1);assert.equal(sales[0].seller,'u9');assert.equal(sales[0].gold,30);
 assert.equal((await O.buyListing(p,{...r2,id:'gone',seller:'u9',item:'bun',n:2,price:30})).ok,false,'單子不在了不能買');
 // 新單：選數量買一部分
 await db.collection('market').add({seller:'u9',sellerName:'丁',item:'bun',n:10,each:7,price:70,t:Date.now(),buyer:null,buyerName:null});
 const l=list.find(x=>x.seller==='u9');assert.ok(l);assert.equal((await O.buyListing(p,l,11)).ok,false,'不能買超過');
 const r4=await O.buyListing(p,l,4);assert.equal(r4.ok,true,r4.msg);assert.equal(p.gold,1120-28);assert.equal(P.countItem(p,'bun'),6);
 const l2=list.find(x=>x.seller==='u9');assert.equal(l2.n,6);assert.equal(l2.price,42);assert.equal(l2.claim,null);
 assert.equal(sales.filter(x=>x.seller==='u9').length,2);
 // 有人正在買（claim 還新鮮）就不能買、賣家也不能收回
 await db.doc('market/'+l2.id).update({claim:{uid:'u8',k:1,t:Date.now()}});assert.equal((await O.buyListing(p,l2,1)).ok,false);
 await db.doc('market/'+l2.id).update({claim:{uid:'u8',k:1,t:Date.now()-60000}});assert.equal((await O.buyListing(p,l2,6)).ok,true,'過期的 claim 不算');assert.equal(list.filter(x=>x.seller==='u9').length,0);
 // 上架選數量、單價；收回拿回剩下的
 P.addItem(p,'potion2',5);const r5=await O.postListing(p,'potion2',80,0,2);assert.equal(r5.ok,true,r5.msg);assert.equal(P.countItem(p,'potion2'),3);
 const mine=list.find(x=>x.seller==='u1');assert.ok(mine);assert.equal(mine.n,2);assert.equal(mine.each,80);assert.equal(mine.price,160);
 await db.doc('market/'+mine.id).update({n:1,price:80});
 const r3=await O.cancelListing(p,list.find(x=>x.seller==='u1'));assert.equal(r3.ok,true);assert.equal(P.countItem(p,'potion2'),4,'收回照單子上剩的數量');
 // 賣家收成交的錢
 const me=sales.map(x=>({...x,seller:'u1'}));const g2=await O.collectSales(p,[],me);assert.equal(g2.length,me.length);un();
});

// ---- 線上組隊打迷宮王（Leo 2026-10-28）：隊長算、隊員照快照播，uid 換成各自的叫法 ----
import * as D from '../www/src/mud/dungeon.mjs';
test('組隊：三個人各自建的戰鬥，自己都是 p 排第一，敵人一樣；uid 對應來回一致', ()=>{
 const C=hero('丙丙','bow','huangzhong');
 const members=[A,Bp,C].map(p=>({uid:'u'+p.name,name:p.name,f:R.publicOf(p)}));
 const bs=[0,1,2].map(i=>D.startCoop(members,'d1',99,i));
 for(const [i,b] of bs.entries()){const al=R.allies(b);assert.equal(al[0].uid,'p');assert.equal(al[0].name,[A,Bp,C][i].name);assert.equal(al.length,3);
  assert.equal(al.filter(u=>u.ai).length,2);assert.equal(b.canEscape,i===0);
  assert.deepEqual(R.foes(b).map(u=>[u.uid,u.name,u.maxHp]),R.foes(bs[0]).map(u=>[u.uid,u.name,u.maxHp]));}
 assert.equal(R.foes(bs[0]).length,1+D.coopGuardN(3));
 const f=R.coopMap(2);assert.equal(f('p'),'m2');assert.equal(f('m2'),'p');assert.equal(f('m'),'m');assert.equal(f('e0'),'e0');assert.equal(R.coopMap(0)('m'),'m');
 // 對調：第 2 位畫面上隊長（單子上的 p）叫 m2、第 1 位照舊叫 m；第 1 位畫面上隊長叫 m、第 2 位照舊叫 m2
 assert.equal(bs[2].units.find(u=>u.uid==='m2').name,A.name);assert.equal(bs[2].units.find(u=>u.uid==='m').name,Bp.name);
 assert.equal(bs[1].units.find(u=>u.uid==='m').name,A.name);assert.equal(bs[1].units.find(u=>u.uid==='m2').name,C.name);
});

test('組隊：隊員的指令換成單子上的 uid 給隊長算，隊長的快照蓋回來後血量一致', ()=>{
 const C=hero('丙丙','bow','huangzhong');
 const members=[A,Bp,C].map(p=>({uid:'u'+p.name,name:p.name,f:R.publicOf(p)}));
 const host=D.startCoop(members,'d1',5,0),g2=D.startCoop(members,'d1',5,2),f2=R.coopMap(2);
 const sent=R.mapCmds(R.cleanCmds([{actor:'p',kind:'attack',target:'e0'},{actor:'p',kind:'attack',target:'e0'}]),f2);
 assert.deepEqual(sent.map(c=>c.actor),['m2','m2']);
 const gc=R.pkCmds(host,'m2',sent);assert.equal(gc.length,B.actionsOf(host,host.units.find(u=>u.uid==='m2')));
 const ev=B.resolveRound(host,[{actor:'p',kind:'attack',target:'e0'},{actor:'p',kind:'attack',target:'e0'},...gc]); // 第 1 位沒交：電腦代打
 assert.ok(ev.some(e=>e.a==='m'),'沒交指令的隊員由電腦代打');
 const snap=JSON.parse(JSON.stringify(R.pkSnap(host)));R.applySnap(g2,snap,f2);
 const hp=(b,id)=>b.units.find(u=>u.uid===id).hp;
 assert.equal(g2.round,1);assert.equal(hp(g2,'p'),hp(host,'m2'));assert.equal(hp(g2,'m'),hp(host,'p'));assert.equal(hp(g2,'e0'),hp(host,'e0'));assert.equal(g2.over,host.over);
 const fev=R.mapEvents(ev,f2);for(const [e,x] of ev.map((e,i)=>[e,fev[i]])){if(e.a!=null)assert.equal(x.a,f2(e.a));if(e.d!=null)assert.equal(x.d,f2(e.d));}
});

test('組隊結算：經驗照自己、掉落每座每天一份、第一次多一顆寶石', ()=>{
 const p=hero('丁丁','sword','zhaoyun');const members=[{uid:'x',name:p.name,f:R.publicOf(p)}];
 const b=D.startCoop(members,'d1',3,0);for(const u of R.foes(b)){u.alive=false;u.hp=0;}b.over='win';b.rngState=777;
 const exp0=p.exp,r=D.finishCoop(p,b,100);assert.ok(p.exp>exp0);assert.ok(r.lines.some(t=>t.includes('撿到材料')));assert.equal(p.flags.coop.n.d1,1);assert.equal(p.flags.coop.day.d1,100);
 const mats=Object.values(p.mats).reduce((a,n)=>a+n,0);
 const r2=D.finishCoop(p,b,100);assert.ok(r2.lines.some(t=>t.includes('領過了')));assert.equal(Object.values(p.mats).reduce((a,n)=>a+n,0),mats,'當天第二次沒有掉落');
 const r3=D.finishCoop(p,b,101);assert.ok(r3.lines.some(t=>t.includes('撿到材料')),'隔天又有');
 const lost=D.startCoop(members,'d1',3,0);lost.over='lose';assert.ok(D.finishCoop(p,lost,102).lines[0].includes('倒下'));
});

test('組隊單子：開隊→邀請→加入→出發→指令→結果', async()=>{
 const id=await O.createParty(A,'d1');assert.ok(id);
 const seen=[];const un=await O.watchParty(id,d=>seen.push(d));assert.equal(seen.at(-1).state,'ask');assert.equal(seen.at(-1).members[0].uid,'u1');
 const pid=await O.inviteParty(A,id,'d1',{uid:'u1',name:'乙'});assert.ok(pid);
 const inv=[];const un2=await O.watchInvites(l=>inv.push(l));assert.equal(inv.at(-1).length,1);assert.equal(inv.at(-1)[0].kind,'coop');assert.equal(inv.at(-1)[0].party,id);
 const asks=[];const un3=await O.watchChallenges(l=>asks.push(l),R.PK_ASK_TTL);assert.equal(asks.at(-1)[0].kind,'coop');
 assert.equal(await O.answerChallenge(Bp,asks.at(-1)[0],true),true);assert.equal(inv.at(-1)[0].state,'on');assert.ok(R.fighterFrom(inv.at(-1)[0].guestF));
 await O.writeParty(id,{state:'on',members:[...seen.at(-1).members,{uid:'u1',name:'乙',f:inv.at(-1)[0].guestF}],seed:5});assert.equal(seen.at(-1).state,'on');assert.equal(seen.at(-1).members.length,2);
 await O.writeParty(id,{gc_u1:{n:1,cmds:[]}});await O.writeParty(id,{res:{n:1,ev:[],snap:{round:1}}});assert.equal(seen.at(-1).gc_u1.n,1);assert.equal(seen.at(-1).res.n,1);
 await O.deleteParty(id);assert.equal(seen.at(-1),null);un();un2();un3();await O.deletePk(pid);
});

test('布告：貼、五秒內不能連貼、太長不行、只留最近 50 則、只能刪自己的', async()=>{
 const p=hero('己己','sword','zhaoyun');let list=[];const un=await O.watchBoard(l=>{list=l;});
 assert.equal((await O.postBoard(p,'   ',list)).ok,false);assert.equal((await O.postBoard(p,'x'.repeat(O.BOARD_LEN+1),list)).ok,false);
 assert.equal((await O.postBoard(p,'晚上八點打君子，缺補師',list)).ok,true);assert.equal(list.length,1);assert.equal(list[0].name,'己己');assert.equal(list[0].uid,'u1');
 assert.equal((await O.postBoard(p,'又一則',list)).ok,false,'五秒內不能連貼');
 for(let i=0;i<70;i++)await db.collection('chat').add({uid:'u9',name:'別人',text:'第 '+i,t:1000+i});
 assert.equal(list.length,O.BOARD_MAX);assert.equal(list[0].uid,'u1','最新的排前面');
 assert.equal(await O.deleteBoard(list[1]),false,'別人的不能刪');assert.equal(await O.deleteBoard(list[0]),true);assert.equal(list.some(m=>m.uid==='u1'),false);
 // 貼的人會順手把太舊的清掉（留 BOARD_MAX+10）
 await db.doc('chat/'+list[list.length-1].id).update({t:1});const p2=hero('庚庚','sword','zhaoyun');assert.equal((await O.postBoard(p2,'清一下',[])).ok,true);
 await new Promise(r=>setTimeout(r,50));const all=(await db.collection('chat').get()).docs.length;assert.equal(all,O.BOARD_MAX+10);un();
});

test('讀檔：本機、雲端不是同一個角色時拿等級高的，另一份留著讓玩家選；同一個角色拿新的', ()=>{
 const mk=(name,lv,t,cid)=>({name,lv,t,cid});
 let r=O.pickHero(mk('新',1,200,'a'),mk('舊',30,100,'b'),100);assert.equal(r.p.name,'舊');assert.equal(r.other.name,'新');
 r=O.pickHero(mk('同',31,200,'a'),mk('同',30,100,'a'),100);assert.equal(r.p.lv,31);assert.equal(r.other,null);
 r=O.pickHero(mk('同',30,100,'a'),mk('同',31,200,'a'),200);assert.equal(r.p.lv,31);assert.equal(r.other,null);
 r=O.pickHero(mk('同',1,200),mk('同',30,100),100);assert.equal(r.p.lv,30,'沒 cid 但新的那份低太多，當成另一個角色');assert.equal(r.other.lv,1);
 r=O.pickHero(null,mk('舊',30,100,'b'),100);assert.equal(r.p.name,'舊');r=O.pickHero(mk('新',1,200,'a'),null);assert.equal(r.p.name,'新');
});

test('團 PK：整隊描述、兩邊 uid 對應、host 算完 guest 蓋上數字一樣、30 回合比整隊生命', ()=>{
 const H=hero('甲隊','sword','zhaoyun'),G=hero('乙隊','axe','xuchu');
 assert.equal(R.addMate(H,{name:'副',look:'guanyu',bp:{vit:10,str:15,qui:5},elem:{fire:10},seed:5}).ok,true);
 const x=R.addAdv(H,{look:'zhangfei',name:'張飛',lv:12,elem:{fire:10}},makeRng(3));assert.ok(x);H.petOut=x.uid;
 const TH=R.teamOf(H),TG=R.teamOf(G);
 assert.deepEqual(R.teamUids(TH),['p','pet','m'],'收服者排在主人後面');assert.deepEqual(R.teamUids(TG),['p']);assert.equal(TH.units[1].owner,'p');
 const host=R.startTeam(TH,TG,99),guest=R.startTeam(TG,TH,99);
 assert.deepEqual(R.allies(host).map(u=>u.uid),['p','pet','m']);assert.deepEqual(R.foes(host).map(u=>u.uid),['e0']);
 assert.deepEqual(R.allies(guest).map(u=>u.uid),['p']);assert.deepEqual(R.foes(guest).map(u=>u.uid),['e0','e1','e2']);
 assert.equal(R.foes(guest)[1].owner,'e0','收服者的主人也換成對方畫面的叫法');assert.equal(B.actionsOf(host,R.allies(host)[0]),1,'帶收服者的人一回合一動');assert.equal(B.actionsOf(guest,R.foes(guest)[0]),1);
 assert.equal(R.allies(host)[0].hp,R.allies(host)[0].maxHp,'補滿打');assert.equal(R.foes(guest)[0].maxHp,R.allies(host)[0].maxHp,'兩邊看到的數字一樣');
 const h2g=R.teamMap(R.teamUids(TH),R.teamUids(TG)),g2h=R.teamMap(R.teamUids(TG),R.teamUids(TH));
 assert.equal(h2g('m'),'e2');assert.equal(h2g('e0'),'p');assert.equal(g2h('p'),'e0');assert.equal(g2h('e2'),'m');assert.equal(g2h(h2g('pet')),'pet');
 const guestCmds=[{actor:'p',kind:'attack',target:'e2'},{actor:'p',kind:'attack',target:'e0'}];
 const gc=R.foeCmds(host,R.mapCmds(guestCmds,g2h));assert.deepEqual(gc.map(c=>c.actor),['e0','e0']);assert.deepEqual(gc.map(c=>c.target),['m','p']);
 const ev=B.resolveRound(host,[{actor:'p',kind:'attack',target:'e0'},{actor:'m',kind:'attack',target:'e0'},{actor:'m',kind:'attack',target:'e0'},...gc]);
 R.applySnap(guest,JSON.parse(JSON.stringify(R.pkSnap(host))),h2g,true);
 const hp=(b,id)=>b.units.find(u=>u.uid===id).hp;
 assert.equal(hp(guest,'p'),hp(host,'e0'));assert.equal(hp(guest,'e2'),hp(host,'m'));assert.equal(hp(guest,'e1'),hp(host,'pet'));assert.equal(guest.rngState,host.rngState);assert.equal(guest.round,1);
 const fev=R.mapEvents(ev,h2g);for(const [e,f] of ev.map((e,i)=>[e,fev[i]])){if(e.a!=null)assert.equal(f.a,h2g(e.a));if(e.d!=null)assert.equal(f.d,h2g(e.d));}
 assert.ok(ev.some(e=>e.t==='act'&&e.a==='pet'),'收服者由電腦自己打');
 host.over='win';R.applySnap(guest,R.pkSnap(host),h2g,true);assert.equal(guest.over,'lose');
 for(const u of host.units){u.hp=u.maxHp;u.alive=true;}host.round=R.BOUT_ROUNDS;host.over=null;R.foes(host)[0].hp=1;assert.equal(R.boutTimeout(host),'win');
 host.over=null;R.foes(host)[0].hp=R.foes(host)[0].maxHp;R.allies(host)[2].hp=0;assert.equal(R.boutTimeout(host),'lose','整隊的生命比例');
 // 壞資料不會炸
 assert.deepEqual(R.teamUnits({units:[{t:'h',uid:'p',hero:{}},{t:'pet',uid:'pet',owner:'zz',x:{}}]},'enemy',(d,i)=>'e'+i),[]);
});
test('團 PK 單子：邀請帶 hostT、接受寫 guestT', async()=>{
 const H=hero('丙','sword','zhaoyun'),G=hero('丁','axe','xuchu');
 const id=await O.sendChallenge(H,{uid:'u1',name:'丁'},{kind:'team',hostT:R.teamOf(H)});assert.ok(id);
 const seen=[];const un=await O.watchPk(id,d=>seen.push(d));assert.equal(seen.at(-1).kind,'team');assert.equal(seen.at(-1).hostT.units.length,1);
 assert.equal(await O.answerChallenge(G,seen.at(-1),true,R.teamOf(G)),true);assert.equal(seen.at(-1).state,'on');assert.deepEqual(R.teamUids(seen.at(-1).guestT),['p']);
 await O.deletePk(id);un();
});
test('單人 PK、擂台代打帶出戰的收服者：公開資料有 solo、soloFrom 讀回、兩邊都帶、舊資料只有英雄', ()=>{
 const A=hero('甲','sword','zhaoyun'),Bp=hero('乙','axe','xuchu');
 const x=R.addAdv(A,{look:'zhangfei',name:'張飛',lv:12,elem:{fire:10}},makeRng(3));assert.ok(x);A.petOut=x.uid;
 assert.deepEqual(R.teamUids(R.soloOf(A)),['p','pet']);assert.deepEqual(R.teamUids(R.soloOf(Bp)),['p']);
 const docA=R.publicOf(A),docB=R.publicOf(Bp);assert.deepEqual(R.teamUids(R.soloFrom(docA)),['p','pet']);assert.deepEqual(R.teamUids(R.soloFrom(docB)),['p']);
 const {solo,...old}=docA;assert.deepEqual(R.teamUids(R.soloFrom(old)),['p'],'舊版沒有 solo 就只用英雄');assert.equal(R.soloFrom({v:1}),null);
 const b=R.startSolo(Bp,R.soloFrom(docA),5);assert.deepEqual(R.allies(b).map(u=>u.uid),['p']);assert.deepEqual(R.foes(b).map(u=>u.uid),['e0','e1']);assert.equal(R.foes(b)[1].kind,'pet');assert.equal(R.foes(b)[1].owner,'e0');
 const b2=R.startSolo(A,R.soloTeamOf(fighterOf(Bp)),5);assert.deepEqual(R.allies(b2).map(u=>u.uid),['p','pet']);assert.equal(B.actionsOf(b2,R.allies(b2)[0]),1,'帶收服者一回合一動');
 const ev=B.resolveRound(b2,[{actor:'p',kind:'attack',target:'e0'}]);assert.ok(ev.some(e=>e.t==='act'&&e.a==='pet'),'收服者自己打');
});

test('交易所：賣寵物（Leo 2026-10-28）', async()=>{
 const p=hero('戊','sword','zhaoyun');p.gold=1000;p.pets=[];
 const x=R.addAdv(p,{look:'guanyu',name:'關羽',lv:12,elem:{}},makeRng(9));p.petOut=x.uid;
 let list=[],sales=[];const un=await O.watchMarket((l,u,s)=>{list=l;sales=s;});
 assert.equal((await O.postPet(p,x.uid,500,0)).ok,false,'出戰中不能賣');p.petOut=null;
 const r=await O.postPet(p,x.uid,500,0);assert.equal(r.ok,true,r.msg);assert.equal(p.pets.length,0);
 const l=list.find(q=>q.item==='pet');assert.ok(l);assert.equal(l.pet.name,'關羽');assert.equal(l.price,500);assert.ok(O.listingName(l).includes('關羽'));
 // 自己收回
 assert.equal((await O.cancelListing(p,l)).ok,true);assert.equal(p.pets.length,1);assert.notEqual(p.pets[0].uid,undefined);
 // 別人賣的、我買
 await db.collection('market').add({seller:'u9',sellerName:'丁',item:'pet',pet:{look:'zhangfei',name:'張飛',lv:20,exp:0,grade:[20,40,20,20,20],gv:2,arch:'blade',shiny:true,elem:{},learned:[{id:'combo',lv:4}]},n:1,each:300,price:300,t:Date.now(),buyer:null,buyerName:null});
 const l2=list.find(q=>q.seller==='u9');assert.ok(l2);const r2=await O.buyListing(p,l2,5);assert.equal(r2.ok,true,r2.msg);assert.equal(p.gold,700);
 assert.equal(p.pets.length,2);const z=p.pets.find(q=>q.name==='張飛');assert.ok(z.shiny&&z.uid&&z.learned.length===1);assert.equal(sales.find(s=>s.item==='pet').petName,'張飛');
 // 滿 10 位不能買
 while(p.pets.length<R.PET_MAX)p.pets.push({...z,uid:'pet'+(++p.petSeq)});
 await db.collection('market').add({seller:'u9',sellerName:'丁',item:'pet',pet:{look:'zhangfei',name:'張飛',lv:1,exp:0,grade:[1,1,1,1,1],elem:{},learned:[]},n:1,each:1,price:1,t:Date.now(),buyer:null,buyerName:null});
 assert.equal((await O.buyListing(p,list.find(q=>q.seller==='u9'),1)).ok,false);un();
});

// ---- 六曜之塔只能線上組隊打（Leo 2026-10-29）：王的生命照人數、掉落三倍 ----
test('組隊上六曜之塔：特殊王照人數縮生命、結算掉落三倍、每天一次', ()=>{
 const p=hero('戊戊','spear','zhaoyun'),C=hero('己己','bow','huangzhong');p.lv=C.lv=80;
 const m2=[p,C].map(x=>({uid:'u'+x.name,name:x.name,f:R.publicOf(x)})),m5=[...m2,...[1,2,3].map(i=>({uid:'z'+i,name:'z'+i,f:R.publicOf(C)}))];
 const b2=D.startCoop(m2,'s5',9,0),b5=D.startCoop(m5,'s5',9,0),solo=D.startSky(p,'s5',9);
 assert.equal(b2.coop,'s5');assert.equal(b2.sky,'s5');assert.equal(R.foes(b2).length,4,'李貝留斯照舊帶三個護衛，不隨人數');
 const boss=b=>R.foes(b).find(u=>u.boss);
 assert.equal(boss(b5).maxHp,boss(solo).maxHp,'五人＝原本的數字');assert.equal(boss(b2).maxHp,Math.round(boss(solo).maxHp*D.SKY_COOP_HP(2)));
 assert.equal(D.SKY_COOP_HP(2),0.4);
 for(const u of R.foes(b2)){u.alive=false;u.hp=0;}b2.over='win';b2.rngState=321;
 const exp0=p.exp,r=D.finishCoop(p,b2,100);assert.ok(p.exp>exp0);assert.ok(r.lines.some(t=>t.includes('李貝留斯')));
 assert.equal(p.mats.skyCore,D.SKY_COOP_MULT);assert.ok((p.mats[R.SHARD]||0)>=D.SKY_COOP_MULT);assert.equal(p.flags.sky.day.s5,100);
 const r2=D.finishCoop(p,b2,100);assert.ok(r2.lines.some(t=>t.includes('拿過')));assert.equal(p.mats.skyCore,D.SKY_COOP_MULT,'當天第二次沒有掉落');
 const b1=D.startCoop(m2,'s1',9,0);for(const u of R.foes(b1)){u.alive=false;u.hp=0;}b1.over='win';b1.rngState=5;D.finishCoop(p,b1,100);
 assert.ok(p.mats.skyFeather>=6&&p.mats.skyFeather<=9,'一般特殊王 2～3 個 ×3');
 assert.ok(D.skyLootInfo(D.SKY_BY_ID.s1).includes('6～9'));assert.equal(D.coopTarget('s1'),D.SKY_BY_ID.s1);assert.equal(D.coopTarget('d1'),D.DUNGEON_BY_ID.d1);
});
