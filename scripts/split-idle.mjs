// 待機動作另外切成小圖（第 2 輪優化，2026-10-18）：一張動作圖 1 MB 左右，但城鎮 NPC、創角、對話只用到待機那幾格。
// 把每個角色的待機格搬到 assets/motions/<角色>-idle.webp（約一成大小），城鎮只要下載小圖；戰鬥、野外才下載整張。
// node scripts/split-idle.mjs [角色id ...]（不給就全部）。已經切過的會跳過，但一定會把小圖登記回 motion-index.mjs（sync-art 會重寫它）。
// 用 playwright 的 chromium 畫布裁切、輸出 webp（跟 check-ui 一樣，不另外裝套件）。
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=new URL('../www/',import.meta.url).pathname,indexFile=root+'src/motion-index.mjs';
const MIN_BYTES=400e3; // 小於這個的整張圖本來就不大，不切
const PAD=2,ATLAS_W=640; // 小圖裡每格留 2 格空白，避免縮放時沾到隔壁
const src=fs.readFileSync(indexFile,'utf8'),head=src.slice(0,src.indexOf('export const MOTION_INDEX=')),INDEX=JSON.parse(src.slice(src.indexOf('[')).replace(/;\s*$/,''));
const setOf=id=>INDEX.find(s=>s.characters.some(c=>c.id===id));
const want=process.argv.slice(2);
const ids=(want.length?want:fs.readdirSync(root+'assets/motion-data').map(f=>f.replace('.json',''))).filter(id=>setOf(id));
let pw,browser,page;
async function canvasPage(){
 if(page)return page;
 try{pw=require('playwright');}catch{pw=require(require('node:child_process').execSync('npm root -g').toString().trim()+'/playwright');}
 browser=await pw.chromium.launch();page=await browser.newPage();return page;
}
for(const id of ids){
 const set=setOf(id),file=root+'assets/motion-data/'+id+'.json',d=JSON.parse(fs.readFileSync(file,'utf8')),idleName=id+'-idle.png',idleAsset='./assets/motions/'+id+'-idle.webp';
 if(!d.files.includes(idleName)){
  if(d.v!==2||d.files.length!==1){console.log('略過（格式不同）',id);continue;}
  const big=set.assets[d.files[0]],bigPath=root+big.replace('./','');
  if(fs.statSync(bigPath).size<MIN_BYTES){console.log('略過（本來就小）',id);continue;}
  const k=set.scale||1,rows=Object.values(d.facings).flatMap(f=>f.actionFrames.idle||[]);
  // 每格在大圖上的像素範圍（大圖是縮小過的，座標乘 k；邊緣取整往外多抓一格）
  const cells=rows.map(r=>{const x0=Math.floor(r[1]*k),y0=Math.floor(r[2]*k),x1=Math.ceil((r[1]+r[3])*k),y1=Math.ceil((r[2]+r[4])*k);return {r,x0,y0,w:x1-x0,h:y1-y0};});
  // 架子排法：照高度排，一列放滿 ATLAS_W 就換列
  let x=PAD,y=PAD,rowH=0;for(const c of [...cells].sort((a,b)=>b.h-a.h)){if(x+c.w+PAD>ATLAS_W){x=PAD;y+=rowH+PAD;rowH=0;}c.ax=x;c.ay=y;x+=c.w+PAD;rowH=Math.max(rowH,c.h);}
  const H=y+rowH+PAD,pg=await canvasPage();
  const b64=await pg.evaluate(async({data,cells,W,H})=>{
   const img=await createImageBitmap(await (await fetch('data:image/webp;base64,'+data)).blob()),cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
   for(const c of cells)g.drawImage(img,c.x0,c.y0,c.w,c.h,c.ax,c.ay,c.w,c.h);
   return cv.toDataURL('image/webp',.92).split(',')[1];
  },{data:fs.readFileSync(bigPath).toString('base64'),cells,W:ATLAS_W,H});
  fs.writeFileSync(root+idleAsset.replace('./',''),Buffer.from(b64,'base64'));
  // 改寫待機格：換成小圖、rect 移到小圖上的位置（保留原本不到一格的小數位移）
  const fi=d.files.push(idleName)-1;
  for(const c of cells){const r=c.r;r[0]=fi;r[1]=(c.ax+(r[1]*k-c.x0))/k;r[2]=(c.ay+(r[2]*k-c.y0))/k;}
  fs.writeFileSync(file,JSON.stringify(d));
  console.log('切好',id,`${(fs.statSync(bigPath).size/1e3)|0}K → 待機小圖 ${(Buffer.from(b64,'base64').length/1e3)|0}K`);
 }
 if(!set.sourceFiles.includes(idleName)){set.sourceFiles.push(idleName);set.assets[idleName]=idleAsset;}
}
fs.writeFileSync(indexFile,head+'export const MOTION_INDEX='+JSON.stringify(INDEX)+';\n');
await browser?.close();
