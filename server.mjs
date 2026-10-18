// 本機試玩：node server.mjs [--port=4190] [--lan]，開 http://127.0.0.1:4180
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'www');
const port=+(process.argv.find(a=>a.startsWith('--port='))?.slice(7)||4190),lan=process.argv.includes('--lan');
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://x').pathname),file=path.join(root,rel.endsWith('/')?rel+'index.html':rel);
 if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}).listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
 console.log('三國魔力寶貝：http://127.0.0.1:'+port);
 if(lan)for(const n of Object.values(os.networkInterfaces()).flat())if(n.family==='IPv4'&&!n.internal)console.log('同一個 Wi-Fi 的手機：http://'+n.address+':'+port);
});
