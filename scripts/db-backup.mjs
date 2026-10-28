// 伺服器資料的備份／還原（要環境變數 ADMIN_KEY，跟伺服器設的同一串）：
//   ADMIN_KEY=xxx node scripts/db-backup.mjs dump [網址] [存成檔名]        （預設 http://127.0.0.1:4190、db-日期.json）
//   ADMIN_KEY=xxx node scripts/db-backup.mjs restore 檔名 [網址] [--wipe]   （--wipe＝備份裡沒有的也刪掉）
import fs from 'node:fs';
const [cmd,...rest]=process.argv.slice(2),key=process.env.ADMIN_KEY||'';
if(!key){console.error('要設環境變數 ADMIN_KEY');process.exit(1);}
const isUrl=s=>/^https?:\/\//.test(s||'');
if(cmd==='dump'){
 const base=rest.find(isUrl)||'http://127.0.0.1:4190',file=rest.find(x=>!isUrl(x))||`db-${new Date().toISOString().slice(0,10)}.json`;
 const r=await fetch(base+'/api/admin/dump',{headers:{'x-admin-key':key}});if(!r.ok){console.error('抓不到：',r.status);process.exit(1);}
 const j=await r.json();fs.writeFileSync(file,JSON.stringify(j));console.log(`存到 ${file}，${Object.keys(j.docs).length} 筆`);
}else if(cmd==='restore'){
 const file=rest.find(x=>!isUrl(x)&&!x.startsWith('--')),base=rest.find(isUrl)||'http://127.0.0.1:4190',wipe=rest.includes('--wipe');
 const j=JSON.parse(fs.readFileSync(file,'utf8'));if(!j.docs)throw new Error('不是備份檔');
 const r=await fetch(base+'/api/admin/restore',{method:'POST',headers:{'x-admin-key':key,'content-type':'application/json'},body:JSON.stringify({docs:j.docs,wipe})});
 console.log(r.status,await r.text());
}else console.log('用法：dump [網址] [檔名] ／ restore 檔名 [網址] [--wipe]');
