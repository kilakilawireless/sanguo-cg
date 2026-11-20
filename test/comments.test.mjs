// 行尾註解後面又接了程式（註解把後面的程式吃掉，那段永遠不會跑）：第 195 輪升級訊息、即時 PK 送不出去的提示都這樣壞過（第 196 輪）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

const files=dir=>readdirSync(dir).flatMap(n=>{const f=join(dir,n);return statSync(f).isDirectory()?files(f):f.endsWith('.mjs')?[f]:[];});

test('行尾註解後面沒有被吃掉的程式',()=>{
 const bad=[];
 for(const f of [...files('www/src'),...files('api'),'server.mjs'])readFileSync(f,'utf8').split('\n').forEach((l,i)=>{
  const m=l.match(/[;)\]}] *\/\/ ?(.*)$/);if(!m)return;
  if(/if\(|\w\.\w+\(.*\);|=>|const |return /.test(m[1]))bad.push(`${f}:${i+1} ${m[1].slice(0,80)}`);
 });
 assert.deepEqual(bad,[]);
});
