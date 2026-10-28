// 伺服器資料庫的權限（api/store.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import {canRead,canWrite,canQuery,Store} from '../api/store.mjs';
test('權限：自己的存檔只有自己、名片只能寫自己那筆、交易所／PK／組隊單大家能寫、_auth 碰不到', ()=>{
 assert.equal(canWrite('u1','data/users/u1/cg'),true);assert.equal(canWrite('u1','data/users/u2/cg'),false);assert.equal(canRead('u1','data/users/u2/cg'),false);
 assert.equal(canWrite('u1','fighters/u1'),true);assert.equal(canWrite('u1','fighters/u2'),false);assert.equal(canRead('u1','fighters/u2'),true);
 for(const c of ['market','pk','party']){assert.equal(canWrite('u1',c+'/abc'),true,c);assert.equal(canQuery('u1',c),true);}
 assert.equal(canWrite('u1','_auth/users/x'),false);assert.equal(canRead('u1','_auth/users/x'),false);assert.equal(canQuery('u1','data/users'),false);
 assert.equal(canWrite('','market/abc'),false);
});
test('Store：update 只蓋給的欄位、只有 on 的更新不落地', ()=>{
 const puts=[];const s=new Store({put:(p,d)=>puts.push(p),del:()=>{}});
 s.set('party/a',{host:'u1',members:[1]});s.update('party/a',{gc_u2:{n:1}});assert.deepEqual(s.get('party/a').data,{host:'u1',members:[1],gc_u2:{n:1}});
 assert.equal(puts.length,2);s.update('party/a',{on:5});assert.equal(puts.length,2);
 assert.equal(s.query('party',[['host','==','u1']]).length,1);
});
