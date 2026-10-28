// 自己架的伺服器（api/）：帳號、讀寫規則、交易所、即時推送。開一個暫時的伺服器來打
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT=4300+Math.floor(Math.random()*500),B=`http://127.0.0.1:${PORT}`,dir=fs.mkdtempSync(path.join(os.tmpdir(),'mud-'));
const srv=spawn(process.execPath,['server.mjs',`--port=${PORT}`],{env:{...process.env,DATA_DIR:dir},stdio:'ignore'});
await new Promise((ok,bad)=>{const t0=Date.now();const tick=async()=>{try{await fetch(B+'/api/ping');ok();}catch{Date.now()-t0>8000?bad(new Error('server did not start')):setTimeout(tick,100);}};tick();});
const j=async(p,o)=>{const r=await fetch(B+p,o);return [r.status,await r.json()];};
const post=(p,b,t)=>j(p,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:JSON.stringify(b)});
test.after(()=>{srv.kill('SIGTERM');});
test('ping 回版本號（網頁拿來比對、強制更新）', async()=>{const [c,b]=await j('/api/ping');assert.equal(c,200);assert.equal(b.server,'mud');assert.equal(typeof b.build,'string');assert.ok(b.build.length>=3);});

test('帳號：註冊、重複、登入、token', async()=>{
 const [s,a]=await post('/api/register',{name:'甲甲',pass:'1234'});assert.equal(s,200);assert.ok(a.uid&&a.token);
 assert.equal((await post('/api/register',{name:'甲甲',pass:'1234'}))[1].msg,'這個名字有人用了。');
 assert.equal((await post('/api/register',{name:'a',pass:'1234'}))[0],400,'名字太短');
 assert.equal((await post('/api/register',{name:'乙乙',pass:'12'}))[0],400,'密碼太短');
 assert.equal((await post('/api/login',{name:'甲甲',pass:'xxxx'}))[0],400);
 const [,l]=await post('/api/login',{name:'甲甲',pass:'1234'});assert.equal(l.uid,a.uid);
 assert.equal((await j('/api/me',{headers:{Authorization:'Bearer '+l.token}}))[1].name,'甲甲');
 assert.equal((await post('/api/db',{op:'get',path:'market/x'}))[0],401,'沒 token 不能用');
});

test('讀寫規則：自己的存檔別人看不到、名片只有自己能寫、交易所大家能寫', async()=>{
 const [,a]=await post('/api/register',{name:'丙丙',pass:'1234'}),[,b]=await post('/api/register',{name:'丁丁',pass:'1234'});
 assert.equal((await post('/api/db',{op:'set',path:`data/users/${a.uid}/cg`,data:{hero:'{}',t:1}},a.token))[0],200);
 assert.equal((await post('/api/db',{op:'get',path:`data/users/${a.uid}/cg`},a.token))[1].exists,true);
 assert.equal((await post('/api/db',{op:'get',path:`data/users/${a.uid}/cg`},b.token))[1].exists,false);
 assert.equal((await post('/api/db',{op:'set',path:`fighters/${a.uid}`,data:{name:'丙丙'}},a.token))[0],200);
 assert.equal((await post('/api/db',{op:'set',path:`fighters/${a.uid}`,data:{name:'壞'}},b.token))[0],403);
 assert.equal((await post('/api/db',{op:'query',path:'fighters'},b.token))[1].length,1,'別人看得到名片');
 const [,add]=await post('/api/db',{op:'add',path:'market',data:{seller:a.uid,item:'potion',n:1,price:5,t:1}},a.token);assert.ok(add.id);
 const [,q]=await post('/api/db',{op:'query',path:'market',filters:[['seller','==',a.uid]]},b.token);assert.equal(q.length,1);
 assert.equal((await post('/api/db',{op:'update',path:'market/'+add.id,data:{buyer:b.uid}},b.token))[0],200,'買家寫得進去');
 assert.equal((await post('/api/db',{op:'get',path:'market/'+add.id},a.token))[1].data.buyer,b.uid);
 assert.equal((await post('/api/db',{op:'set',path:'_auth/users/x',data:{}},a.token))[0],403);
 assert.equal((await post('/api/db',{op:'query',path:'_auth/users'},a.token))[0],403);
 assert.equal((await post('/api/db',{op:'set',path:'weird/x',data:{}},a.token))[0],403);
 assert.equal((await post('/api/db',{op:'update',path:'pk/nope',data:{}},a.token))[0],404);
});

test('即時推送：改了資料，訂閱的人馬上收到路徑；存檔落地', async()=>{
 const [,a]=await post('/api/register',{name:'戊戊',pass:'1234'});
 const r=await fetch(B+'/api/events?token='+a.token);const rd=r.body.getReader();
 setTimeout(()=>post('/api/db',{op:'set',path:'pk/t1',data:{host:a.uid}},a.token),100);
 let buf='';const t0=Date.now();while(!buf.includes('pk/t1')&&Date.now()-t0<3000){const {value}=await rd.read();buf+=new TextDecoder().decode(value);}
 assert.ok(buf.includes('"path":"pk/t1"'));rd.cancel();
 await new Promise(r=>setTimeout(r,500));const saved=JSON.parse(fs.readFileSync(path.join(dir,'db.json'),'utf8'));assert.ok(saved['pk/t1']);assert.ok(Object.keys(saved).some(k=>k.startsWith('_auth/users/')));
});

test('備份／還原：有 ADMIN_KEY 才開，整份倒出、整份蓋回', async()=>{
 const P2=4300+Math.floor(Math.random()*500),B2=`http://127.0.0.1:${P2}`,d2=fs.mkdtempSync(path.join(os.tmpdir(),'mud-'));
 const s2=spawn(process.execPath,['server.mjs',`--port=${P2}`],{env:{...process.env,DATA_DIR:d2,ADMIN_KEY:'secret-key-1'},stdio:'ignore'});
 try{
  await new Promise((ok,bad)=>{const t0=Date.now();const tick=async()=>{try{await fetch(B2+'/api/ping');ok();}catch{Date.now()-t0>8000?bad(new Error('server did not start')):setTimeout(tick,100);}};tick();});
  const jj=async(p,o)=>{const r=await fetch(B2+p,o);return [r.status,await r.json()];};
  assert.equal((await fetch(B+'/api/admin/dump?key=anything')).status,404,'沒設 ADMIN_KEY 的伺服器沒有這條路');
  assert.equal((await fetch(B2+'/api/admin/dump?key=wrong')).status,404);
  const [,a]=await jj('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'戊戊',pass:'1234'})});
  await jj('/api/db',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token},body:JSON.stringify({op:'set',path:'market/m1',data:{item:'bun'}})});
  const [s,dump]=await jj('/api/admin/dump',{headers:{'x-admin-key':'secret-key-1'}});assert.equal(s,200);assert.ok(dump.docs['market/m1']);assert.ok(Object.keys(dump.docs).some(k=>k.startsWith('_auth/users/')),'帳號也在備份裡');
  await jj('/api/db',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token},body:JSON.stringify({op:'delete',path:'market/m1'})});
  await jj('/api/db',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token},body:JSON.stringify({op:'set',path:'market/m2',data:{item:'x'}})});
  const [s2s,r]=await jj('/api/admin/restore',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':'secret-key-1'},body:JSON.stringify({docs:dump.docs,wipe:true})});assert.equal(s2s,200);assert.ok(r.n>0);
  const [,q]=await jj('/api/db',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.token},body:JSON.stringify({op:'query',path:'market',filters:[]})});
  assert.deepEqual(q.map(x=>x.id),['m1'],'還原後 m1 回來、m2 不見');
 }finally{s2.kill('SIGTERM');}
});
