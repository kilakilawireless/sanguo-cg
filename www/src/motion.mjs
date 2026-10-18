import {MOTION_DATA} from './motion-data.mjs';
import {MOTION_INDEX} from './motion-index.mjs';
// 動作圖分角色載入（Leo 2026-10-09）：一開始只有名冊（motion-index.mjs：誰有動作圖、有哪些方向、每個動作幾格），
// 每一格的位置在 assets/motion-data/<角色>.json，畫到誰才下載誰（loadMotion）。還沒下載好的人 drawMotion 先不畫、回傳 false。
import {WEAPON_ITEMS} from './weapon-items-data.mjs';
import {unpackMotion} from './motion-pack.mjs';
// Sheets may ship smaller than the masters their rects were measured on (群俠江湖 sends half-size WebP): each data module
// carries a `scale`, which maps its files back to master coordinates when a frame is cut out.
// A unit draws its own sheets (artId, else id); while those are not drawn yet it borrows `standIn` (e.g. 影月 before INDEX P09).
// look：換造型（關山月第 1～19 關的年輕樣子），畫好了才用。
// 群俠江湖照兵器挑身體（engine.mjs GRIP、sect.mjs DISCIPLE_BODY）：槍棍用 <art>-pole、拳腳暗器用 <art>-bare，有那張動作圖才換。
const GRIP={qiangke:'pole',qiangqi:'pole',gunfa:'pole',quanzhang:'bare',tuifa:'bare',anqi:'bare'};
export const gripArt=(id,line)=>{const g=GRIP[line];if(!g||!id)return id;const v=id.replace(/-(pole|bare|blade)$/,'')+'-'+g;return characters[v]?v:id;};
export const motionId=u=>{if(typeof u==='string')return u;if(u.look&&characters[u.look])return u.look;const own=gripArt(u.artId||u.id,u.line);return !characters[own]&&u.standIn&&characters[u.standIn]?u.standIn:own;};
// Owner 2026-10-03: characters move 50% faster. Walk and run cycles play faster by the same factor so the feet keep pace with the ground.
export const TILE_SECONDS=.32/1.5,STRIDE_PACE=1.5;
const SETS=[MOTION_DATA,...MOTION_INDEX];
const combined={sourceFiles:SETS.flatMap(d=>d.sourceFiles),assets:Object.assign({},...SETS.map(d=>d.assets)),scale:Object.fromEntries(SETS.flatMap(d=>d.sourceFiles.map(f=>[f,d.scale||1])))};
const characters=Object.fromEntries(SETS.flatMap(d=>d.characters).map(c=>[c.id,structuredClone(c)]));
const filesCache={},loaded=new Set(MOTION_DATA.characters.map(c=>c.id)),loading=new Map(),listeners=new Set();
// 名冊本來就在，留著給舊的呼叫（main.mjs、測試）。
export const motionReady=Promise.resolve();
export const motionLoaded=id=>loaded.has(id);
// 某人的格子資料下載好時通知（畫面可以重畫）。
export const onMotionLoaded=fn=>{listeners.add(fn);return ()=>listeners.delete(fn);};
const fetchJson=async url=>{if(typeof window==='undefined'){const fs=await import('node:fs/promises');return JSON.parse(await fs.readFile(url,'utf8'));}const r=await fetch(url);if(!r.ok)throw new Error('動作資料下載失敗 '+r.status);return r.json();};
// 要畫誰之前先叫這個（戰鬥開場、城鎮、劇情、圖鑑都會自己叫；drawMotion 碰到沒載的人也會叫）。ids 可以混 motionId 算出來的 id。
export function loadMotion(ids){
 return Promise.all([...new Set(ids)].filter(id=>characters[id]&&!loaded.has(id)).map(id=>{
  if(!loading.has(id))loading.set(id,fetchJson(new URL('../assets/motion-data/'+id+'.json',import.meta.url)).then(unpackMotion).then(d=>{
   const c=characters[id];if(d.frames)c.frames=d.frames;else for(const [k,f] of Object.entries(d.facings))c.facings[k]={...c.facings[k],...f};
   delete filesCache[id];loaded.add(id);for(const fn of listeners)fn(id);
  }).catch(e=>{loading.delete(id);throw e;}));
  return loading.get(id);}));
}
// Legacy sheets hold six rows of eight frames; v3 sheets (atlas-prepare + build-motion-v3) add critical, run, hit, dodge and knockback and a 16-frame special.
const actions=['idle','walk','attack','parry','defeat','special','critical','run','hit','dodge','knockback'];
const LOOPS=new Set(['idle','walk','critical','run']);
const rates={idle:6,walk:12.5,attack:12,parry:10,defeat:8,special:10,critical:5,run:14,hit:12,dodge:12,knockback:12};
// Longest weapon per class in sheet pixels (bodies stand about 130 px); a frame draws its own bar length up to this cap.
const WEAPON_LENGTH={sword:58,saber:54,heavy:84,spear:110,staff:100};
// Eight facings by screen angle (isometric: grid +x runs down-right, +y down-left). Three are mirrors of drawn ones.
export const FACINGS=['right','front-right','front','front-left','left','back-left','back','back-right'];
const MIRROR={'front-left':'front-right',left:'right','back-left':'back-right'},LEFTISH=new Set(['front-left','left','back-left']);
export function facingFor(dx,dy){if(!dx&&!dy)return null;const deg=Math.atan2(dx+dy,dx-dy)*180/Math.PI;return FACINGS[((Math.round(deg/45)%8)+8)%8];}
// The drawn facing to use for a wanted one: itself, its mirror, or front-right (mirrored for the left side) as the universal fallback.
export function resolveFacing(id,key){const c=characters[id];if(!c?.v3)return {key:'front-right',flip:LEFTISH.has(key)};const f=c.facings;if(f[key])return {key,flip:false};const m=MIRROR[key];if(m&&f[m])return {key:m,flip:true};const base=f['front-right']?'front-right':Object.keys(f)[0];return {key:base,flip:LEFTISH.has(key)};}
const facingOf=(c,facing)=>c.facings[facing]||c.facings['front-right']||Object.values(c.facings)[0];
const framesOf=(c,facing)=>c.v3?facingOf(c,facing).actionFrames||null:null;
const frameOf=(c,action,i,facing)=>c.v3?framesOf(c,facing)?.[action]?.[i]:c.frames?.[actions.indexOf(action)*8+i];
const countOf=(c,action,facing)=>c.v3?(facingOf(c,facing).n?.[action]||0):(actions.indexOf(action)<c.counts.length?c.counts[actions.indexOf(action)]:0);
export const hasMotion=id=>!!characters[id];
export const hasAction=(id,action)=>!!characters[id]&&countOf(characters[id],action)>0;
// 一個動作有幾格（腳步聲對準走路循環的落地格用）。
export const frameCount=(id,action)=>characters[id]?countOf(characters[id],action):0;
export const hasFacing=(id,key)=>!!characters[id]?.v3&&!!characters[id].facings[key];
export function frameIndex(id,action,seconds=0){
 const c=characters[id];if(!c)return 0;const count=countOf(c,action);if(!count)return 0;const n=Math.max(0,Math.floor(seconds*(c.rates?.[action]||rates[action]||10)));
 return LOOPS.has(action)?n%count:Math.min(count-1,n);
}
export function motionDuration(id,action){const c=characters[id],count=c?countOf(c,action):0;return (count||8)/(c?.rates?.[action]||rates[action]||10);}
let sharedBank;
// 動作圖用到才下載（手機第一次打開不必先抓全部 36 MB）：畫到某個角色時，一次載入他所有的圖。
function filesOf(id){
 if(!loaded.has(id))return [];if(filesCache[id])return filesCache[id];const c=characters[id],out=new Set(c.file?[c.file]:[]);
 const add=list=>{for(const f of list||[])if(f?.file)out.add(f.file);};
 if(c.v3)for(const v of Object.values(c.facings))for(const list of Object.values(v.actionFrames))add(list);else add(c.frames);
 return filesCache[id]=[...out];
}
export function preloadMotion(bank,ids){
 const wait=ids.filter(id=>characters[id]&&!loaded.has(id));if(wait.length)loadMotion(wait).then(()=>preloadMotion(bank,wait),()=>{});
 for(const id of ids){if(!characters[id]||!loaded.has(id))continue;for(const file of filesOf(id))if(!bank.images[file])loadSheet(bank,file);}
}
// 動作圖下載失敗（手機網路斷一下、網站正在換版）時，隔一下再抓，最多五次；不然那個人整場都不會畫出來，只剩腳下的圈和血條（Leo 2026-10-11 回報）。
function loadSheet(bank,file,tries=0){
 const img=new bank.ImageType();bank.images[file]=img;touch(bank,file);
 img.onerror=()=>{if(tries<5)setTimeout(()=>{if(bank.images[file]===img)loadSheet(bank,file,tries+1);},800*(tries+1));};
 img.src=combined.assets[file]+(tries?(combined.assets[file].includes('?')?'&':'?')+'retry='+tries:'');
}
// 開場前等場上的人動作圖下載、解碼好（最多 ms 毫秒），不然手機網路慢時劇情開講了人還沒出現。
export function motionSheetsReady(ids,ms=8000){
 if(typeof globalThis.Image==='undefined')return Promise.resolve();
 const bank=createMotionBank();preloadMotion(bank,ids);
 const imgs=[...new Set(ids)].filter(id=>loaded.has(id)).flatMap(id=>filesOf(id).map(f=>bank.images[f])).filter(Boolean);
 return Promise.race([Promise.all(imgs.map(i=>i.decode?i.decode().catch(()=>{}):null)),new Promise(r=>setTimeout(r,ms))]);
}
export function createMotionBank(ImageType=globalThis.Image){
 if(ImageType===globalThis.Image&&sharedBank)return sharedBank;
 const bank={images:{},ImageType};if(ImageType===globalThis.Image)sharedBank=bank;return bank;
}
// 記憶體上限（試玩回報 2026-10-11：加到主畫面玩一陣子會閃退）：整張動作圖解碼後一張 4～18 MB，切好的每一格也各是一張小畫布，
// 以前全部留到關掉遊戲為止，打過十幾關就上 GB，手機會把整個頁面砍掉（加到主畫面時看起來就是閃退）。
// 現在超過 MOTION_BUDGET 就把最久沒畫到的人（KEEP_MS 內畫過的不動）連大圖、切好的格子、換色圖一起放掉，之後再畫到會重新載入（走快取，很快）。
const MOTION_BUDGET=160e6,KEEP_MS=20000,TRIM_EVERY=3000;
const clock=()=>globalThis.performance?.now?.()??Date.now();
function touch(bank,file){(bank.used||=new Map()).set(file,clock());}
function dropKeys(m,file){let n=0;if(m)for(const [k,c] of m)if(k.startsWith(file)){n+=c?c.width*c.height*4:0;m.delete(k);}return n;}
function sizeOf(bank,file){const img=bank.images[file];let n=img?.naturalWidth?img.naturalWidth*img.naturalHeight*4:0;
 for(const m of [bank.crops,bank.edges,bank.skins])if(m)for(const [k,c] of m)if(c&&k.startsWith(file))n+=c.width*c.height*4;return n;}
export function trimMotionBank(bank,budget=MOTION_BUDGET,keepMs=KEEP_MS){
 if(!bank?.used)return 0;const t=clock();bank.trimAt=t;
 const files=[...bank.used.keys()],size=new Map(files.map(f=>[f,sizeOf(bank,f)]));let total=0;for(const v of size.values())total+=v;
 let freed=0;
 for(const f of files.sort((a,b)=>bank.used.get(a)-bank.used.get(b))){
  if(total-freed<=budget||t-bank.used.get(f)<keepMs)break;
  delete bank.images[f];bank.used.delete(f);for(const m of [bank.crops,bank.edges,bank.skins])dropKeys(m,f);freed+=size.get(f);
 }
 return freed;
}
export const motionBankBytes=bank=>bank?.used?[...bank.used.keys()].reduce((n,f)=>n+sizeOf(bank,f),0):0;
// `facing` (one of FACINGS) picks a v3 sheet and decides mirroring; legacy sheets only honour `flip`.
// `aura` ({color,level}) is a 神兵's qi after fusions (gear.mjs weaponAura): a tint along the blade at level 1, a full glow at level 2.
// 換色（data/skins.mjs）：面具＝亮而不鮮豔的像素（連腰帶），斗篷衣服＝暗而不鮮豔的像素，保留明暗；皮膚、鞋這些有顏色的不動。
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
// tint 換色（2026-10-11 轉職程式換色試做留下的通用功能，主人同日撤下轉職換色後暫時沒人用）：tint 是一串規則，每個像素照 HSL（色相 0～360、彩度與明度 0～1）逐條比對，
// 第一條符合的把色相、彩度換成 to 的，明度照原本的再乘 lk、加 la（保留衣服的明暗皺褶），mix 是換幾成（預設全換）。
// 皮膚（橙色、中等彩度、偏亮）與頭髮（isHairTone）一律不動，除非規則寫 skin:true／hair:true；h 寫 [330,25] 這種跨 0 的範圍也行。
export function rgbToHsl(r,g,b){
 r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;if(!d)return [0,0,l];
 const s=d/(1-Math.abs(2*l-1));let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;return [h,Math.min(1,s),l];
}
export function hslToRgb(h,s,l){
 const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,i=Math.floor(h/60)%6,t=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][i];
 return t.map(v=>Math.round(Math.min(255,Math.max(0,(v+m)*255))));
}
const inRange=(v,r)=>!r||(v>=r[0]&&v<=r[1]);
const hueIn=(h,r)=>!r||(r[0]<=r[1]?h>=r[0]&&h<=r[1]:h>=r[0]||h<=r[1]);
export const isSkinTone=(h,s,l)=>h>=10&&h<=42&&s>=.33&&l>=.58&&l<=.93;
// 頭髮也不動：深褐的頭髮（連皮靴、皮帶一起留著；紅衣的色相在 12 以下，分得開）、關山月／清虛子／孤虎那種帶紫的白髮與它的灰影。
export const isHairTone=(h,s,l)=>(h>=13&&h<=45&&s>=.2&&s<=.7&&l>=.06&&l<=.3)||(h>=230&&h<=330&&s>=.08&&l>=.3&&l<=.95);
export function recolorPixels(data,{mask=null,cloth=null,tint=null,keepSkin=false}={}){
 const M=mask&&hexRgb(mask),C=cloth&&hexRgb(cloth),amt=.6;
 const T=tint&&tint.map(t=>{const [th,ts]=rgbToHsl(...hexRgb(t.to));return {...t,th,ts:Math.min(1,ts*(t.sk??1))};});
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;const r=data[i],g=data[i+1],b=data[i+2],mx=Math.max(r,g,b),ch=mx-Math.min(r,g,b),l=(.3*r+.59*g+.11*b)/255;
  if(M&&mx>150&&ch<75&&l>.55&&!(keepSkin&&isSkinTone(...rgbToHsl(r,g,b)))){const k=l/.95*1.15;for(let j=0;j<3;j++)data[i+j]=Math.min(255,M[j]*k);}
  else if(C&&ch<60&&mx<150){const k=l*2.4;for(let j=0;j<3;j++)data[i+j]=Math.min(255,(1-amt)*data[i+j]+amt*C[j]*k);}
  if(!T)continue;
  const [h,s,L]=rgbToHsl(data[i],data[i+1],data[i+2]),skin=isSkinTone(h,s,L),hair=isHairTone(h,s,L);
  for(const t of T){
   if((skin&&!t.skin)||(hair&&!t.hair)||!hueIn(h,t.h)||!inRange(s,t.s)||!inRange(L,t.l))continue;
   const out=hslToRgb(t.th,t.ts,Math.min(1,Math.max(0,L*(t.lk??1)+(t.la??0)))),m=t.mix??1;
   for(let j=0;j<3;j++)data[i+j]=Math.round((1-m)*data[i+j]+m*out[j]);break;
  }
 }
 return data;
}
// 換色設定的快取鍵（整張圖每種配色只換一次）；tint 規則用內容算，同一個物件算過就記住。
const keyMemo=new WeakMap();
export const skinKey=s=>{if(!s)return '';let k=keyMemo.get(s);if(k===undefined){k='|'+(s.mask||'')+'|'+(s.cloth||'')+(s.tint?'|'+JSON.stringify(s.tint):'')+(s.keepSkin?'|k':'');keyMemo.set(s,k);}return k;};
const skinApplies=(skin,id)=>skin&&(!skin.base||id===skin.base||id.startsWith(skin.base+'-'));
// 換過色的整張圖每種配色做一次就留著；沒有 canvas（測試）就畫原圖。
function skinned(bank,file,img,skin){
 const key=file+skinKey(skin);bank.skins||=new Map();if(bank.skins.has(key))return bank.skins.get(key);
 if(typeof document==='undefined')return img;
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});if(!g)return img;
 g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height);recolorPixels(d.data,skin);g.putImageData(d,0,0);bank.skins.set(key,c);return c;
}
// 一格動作先切成自己的小圖（ImageBitmap）再畫（試玩回報 2026-10-09：無面樓那幾關在手機上很卡）。
// 每張動作圖是 1536×2880 的大圖，同一關的人一多，瀏覽器解碼後的快取放不下，就會每一格畫面重新解碼整張大圖（一次上百毫秒）；
// 切好的小圖不會被丟掉，之後不再碰整張大圖。每一格只在第一次畫到時切一次。
function cropOf(bank,key,src,r,k){
 if(typeof document==='undefined')return null;
 const id=key+'@'+r.x+','+r.y+','+r.w+','+r.h,m=bank.crops||=new Map();let c=m.get(id);if(c!==undefined)return c;
 const w=Math.max(1,Math.round(r.w*k)),h=Math.max(1,Math.round(r.h*k));c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 if(!g)c=null;else g.drawImage(src,r.x*k,r.y*k,r.w*k,r.h*k,0,0,w,h);m.set(id,c);return c;
}
// 縮放好的格子另外記住（第 1 輪優化，2026-10-18）：高品質縮放很吃效能（手機戰鬥畫面主執行緒忙到九成以上），
// 同一格在同一個大小只用高品質縮放一次，之後每格 1:1 貼上，畫質一樣。只處理沒有旋轉的畫法；每格最多記 4 種大小。
const fitMemo=new WeakMap();
function drawFit(ctx,src,x,y,w,h){
 const m=ctx.getTransform?.();if(!m||m.b||m.c)return ctx.drawImage(src,x,y,w,h);
 const dw=Math.round(Math.abs(w*m.a)),dh=Math.round(Math.abs(h*m.d));
 if(dw<1||dh<1||dw*dh>1e6||(dw===src.width&&dh===src.height))return ctx.drawImage(src,x,y,w,h);
 let mm=fitMemo.get(src);if(!mm)fitMemo.set(src,mm=new Map());
 // 怪物染色（ctx.filter，例如火焰狼、咆哮的神獸）也一起烤進去，不然每格都要跑一次濾鏡（第 3 輪：染色怪的戰鬥主執行緒滿載）
 const fl=ctx.filter&&ctx.filter!=='none'?ctx.filter:'',key=dw+'x'+dh+fl;let c=mm.get(key);
 if(!c){if(mm.size>=4)mm.delete(mm.keys().next().value);c=document.createElement('canvas');c.width=dw;c.height=dh;const g=c.getContext('2d');if(!g)return ctx.drawImage(src,x,y,w,h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';if(fl)g.filter=fl;g.drawImage(src,0,0,dw,dh);mm.set(key,c);}
 const q=ctx.imageSmoothingQuality;ctx.imageSmoothingQuality='low';if(fl)ctx.filter='none';ctx.drawImage(c,x,y,w,h);ctx.imageSmoothingQuality=q;if(fl)ctx.filter=fl;
}
// 三轉金邊（docs/classes/promotion-look.md §1，2026-10-11）：切好的那一格外圍描一圈 1 格寬、七成透明的 edge 色
// （剪影往八個方向各疊一次再挖掉本體，跟 battle-view outline 同一招），每格第一次畫到時做一次存著，之後直接貼。
const EDGE_M=1,EDGE_ALPHA=.72;
function edgedOf(bank,key,cut,r,edge){
 const id=key+'@'+r.x+','+r.y+','+r.w+','+r.h,m=bank.edges||=new Map();let c=m.get(id);if(c!==undefined)return c;
 try{const w=cut.width+2*EDGE_M,h=cut.height+2*EDGE_M,sil=document.createElement('canvas');sil.width=w;sil.height=h;const g=sil.getContext('2d');
  g.drawImage(cut,EDGE_M,EDGE_M);g.globalCompositeOperation='source-in';g.fillStyle=edge;g.fillRect(0,0,w,h);
  const ring=document.createElement('canvas');ring.width=w;ring.height=h;const o=ring.getContext('2d');
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]])o.drawImage(sil,dx*EDGE_M,dy*EDGE_M);
  o.globalCompositeOperation='destination-out';o.drawImage(cut,EDGE_M,EDGE_M);
  c=document.createElement('canvas');c.width=w;c.height=h;const q=c.getContext('2d');q.globalAlpha=EDGE_ALPHA;q.drawImage(ring,0,0);q.globalAlpha=1;q.drawImage(cut,EDGE_M,EDGE_M);}
 catch{c=null;}
 m.set(id,c);return c;
}
// `icon`：身上那把兵器的道具圖示編號（兵器上手，weapon-items-data.mjs 有那一格就照它畫，沒有照職業的 A28）。
// `skin` ({base,mask,cloth,tint}, data/skins.mjs) recolours the sheet when it is the skin's base art.
// `edge`：外圍描一圈這個顏色；沒寫就不描（三轉金邊 2026-10-11 撤下，現在沒人傳）。
export function drawMotion(ctx,bank,id,action,seconds,{x=0,y=0,height=90,flip=false,facing=null,weapon=null,aura=null,icon=null,skin=null,tier=1,edge=null}={}){
 const c=characters[id];if(!c)return false;if(!loaded.has(id)){loadMotion([id]).catch(()=>{});return false;}let key=null;if(c.v3&&facing){const r=resolveFacing(id,facing);key=r.key;flip=r.flip;}
 let f=frameOf(c,action,frameIndex(id,action,seconds),key);if(!f)return false;let file=f.file||c.file,img=bank.images[file];if(!img)loadSheet(bank,file);else touch(bank,file);
 if(clock()-(bank.trimAt||0)>TRIM_EVERY)trimMotionBank(bank);
 // 只下載畫到的那張圖（待機格另外切成小圖，城鎮只要小圖，scripts/split-idle.mjs）；大圖還沒到時先用同方向的待機格頂著
 if((!img?.complete||!img.naturalWidth)&&action!=='idle'){const g=frameOf(c,'idle',frameIndex(id,'idle',seconds),key),gf=g&&(g.file||c.file),gi=gf&&bank.images[gf];if(gi?.complete&&gi.naturalWidth){f=g;file=gf;img=gi;touch(bank,gf);}else if(gf&&!gi)loadSheet(bank,gf);}
 if(!img?.complete||!img.naturalWidth)return false;const src=skinApplies(skin,id)?skinned(bank,file,img,skin):img,k=combined.scale[file]||1,s=height/(f.standingHeight||c.standingHeight),r=f.rect,a=f.anchor;
 ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 if(f.clipRects?.length){ctx.beginPath();for(const q of f.clipRects)ctx.rect((q.x-a.x)*s,(q.y-a.y)*s,q.w*s,q.h*s);ctx.clip();}
 // Seen from behind (the 'back' sheet) the hands work in front of the body, so the weapon goes under the figure.
 const bare=weapon==='none'; // 空手（格鬥士）：不畫兵器
 const behind=!bare&&f.weapon&&c.v3&&(key==='back'||bladeBehind(c,key,action,weapon));
 if(f.weapon&&!bare)drawWeapon(ctx,c,f,s,weapon,behind?aura:null,behind?'all':'back',action,icon,tier);
 const ck=file+skinKey(skinApplies(skin,id)?skin:null),cut=cropOf(bank,ck,src,r,k),body=cut&&edge?edgedOf(bank,ck+'#'+edge,cut,r,edge):null;
 if(body){const e=EDGE_M/k*s;drawFit(ctx,body,-a.x*s-e,-a.y*s-e,r.w*s+2*e,r.h*s+2*e);}
 else if(cut)drawFit(ctx,cut,-a.x*s,-a.y*s,r.w*s,r.h*s);else ctx.drawImage(src,r.x*k,r.y*k,r.w*k,r.h*k,-a.x*s,-a.y*s,r.w*s,r.h*s);
 if(f.weapon&&!bare&&!behind)drawWeapon(ctx,c,f,s,weapon,aura,'front',action,icon,tier);
 // 握住兵器：兵器畫在身體前面時，把貼著握把的手（膚色）再疊回兵器上面，看起來是握著的（Leo 2026-10-08：顧槍客的槍沒拿著）。
 if(f.weapon&&!bare&&!behind){const h=handMask(img,f,k);if(h)drawFit(ctx,h,-a.x*s,-a.y*s,r.w*s,r.h*s);}
 ctx.restore();return true;
}
// Placeholder weapon along the measured bar until paper-doll weapon art exists: a straight blade, shortened when the bar was foreshortened.
// `weapon` is the unit's own weapon (shared disciple bodies carry several); the sheet's default weapon otherwise.
// A frame from a sheet drawn at another scale carries its own standingHeight and barExpected; the blade keeps the character's length.
// Length: the class cap scaled by how much of a full blade this frame's bar shows (bars drawn shorter than the cap stay short;
// foreshortened frames shrink, down to 40%). `part` 'back' draws only the hilt (under the figure), 'front' the blade and aura.
function weaponLength(c,f,weapon,floor=.4){const len=WEAPON_LENGTH[weapon]||WEAPON_LENGTH[c.weapon]||60,expected=f.barExpected||c.barExpected||len;return len*Math.max(floor,Math.min(1,f.weapon.length/Math.max(expected,len)))*(f.standingHeight?f.standingHeight/c.standingHeight:1);}
// Calm actions (not strikes) whose blade crosses the head in at least a third of the frames draw the whole weapon behind the figure:
// the head is taken as a circle at the top of the frame's box (13% down, radius 9% of its height). Memoised per sheet and action.
const CALM=new Set(['idle','walk','run','hit','dodge','knockback','defeat','critical']),behindMemo=new Map();
// 秦朔風（Leo 2026-10-08：拿武器的手很怪）：這幾個動作量到的刀身從舉在肩上的拳頭橫過臉，改成刀尖朝外（反過來畫，握把仍在拳頭）。
const GRIP_FLIP={shuofeng:new Set(['idle','walk','critical','hit'])};
// 扛在肩上（Leo 2026-10-11）：梁子翁正面站著時刀從拳頭往上斜過頭後面，量到的線沒碰到頭的圓，照算會畫在臉上；直接畫在身後。
const SHOULDER={liangZiweng:new Set(['front','front-right'])};
const barAngle=(c,f,action)=>f.weapon.angle+(GRIP_FLIP[c.id]?.has(action)?180:0);
function bladeBehind(c,facing,action,weapon){if(CALM.has(action)&&SHOULDER[c.id]?.has(facing))return true;const id=c.id+'|'+facing+'|'+action+'|'+weapon;if(behindMemo.has(id))return behindMemo.get(id);let n=0;const frames=CALM.has(action)?framesOf(c,facing)?.[action]||[]:[];
 for(const f of frames){if(!f.weapon||!f.box)continue;const w=f.weapon,b=f.box,L=weaponLength(c,f,weapon),h=hiltShare(weapon||c.weapon,c.id),an=barAngle(c,f,action)*Math.PI/180,cx=Math.cos(an),cy=Math.sin(an),x0=w.x+cx*L*h,y0=w.y+cy*L*h,dx=cx*L*(1-h),dy=cy*L*(1-h),hx=b.x+b.w/2,hy=b.y+b.h*.13,u=Math.max(0,Math.min(1,((hx-x0)*dx+(hy-y0)*dy)/(dx*dx+dy*dy)));if(Math.hypot(x0+u*dx-hx,y0+u*dy-hy)<b.h*.09)n++;}
 const r=frames.length>0&&n*3>=frames.length;behindMemo.set(id,r);return r;}
// 手的遮罩：這一格裡、離握把那條線 7 格以內的膚色像素（每格算一次記住）。線從握點往後 12 格、往前到量到的兵器長度的六成。
const handMemo=new WeakMap();
function handMask(img,f,k){
 if(typeof document==='undefined')return null;let m=handMemo.get(f);if(m!==undefined)return m;m=null;
 try{const r=f.rect,w=f.weapon,cv=document.createElement('canvas');cv.width=r.w;cv.height=r.h;const g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(img,r.x*k,r.y*k,r.w*k,r.h*k,0,0,r.w,r.h);
  const d=g.getImageData(0,0,r.w,r.h),p=d.data,an=w.angle*Math.PI/180,cx=Math.cos(an),cy=Math.sin(an),t0=-12,t1=Math.max(30,w.length*.6);let n=0;
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const i=(y*r.w+x)*4,R=p[i],G=p[i+1],B=p[i+2],A=p[i+3],dx=x-w.x,dy=y-w.y,t=dx*cx+dy*cy,off=Math.abs(-dx*cy+dy*cx);
   const skin=A>200&&R>140&&R>G&&G>B&&R-B>45&&G>70;if(skin&&t>=t0&&t<=t1&&off<=7)n++;else p[i+3]=0;}
  if(n>=4){g.putImageData(d,0,0);m=cv;}}catch{m=null;}
 handMemo.set(f,m);return m;
}
// `part` 'all' draws the whole weapon (used behind the figure).
function drawWeapon(ctx,c,f,s,weapon,aura=null,part='front',action=null,icon=null,tier=1){
 const ia=WEAPON_ITEMS.icons[icon],w=f.weapon,a=f.anchor,L=weaponLength(c,f,weapon,ia?.75:.4);
 // 刀口朝下（Leo 2026-10-08：刀拿反了）：兵器指向左半邊時上下翻，刀口、鉞刃、穗子都留在下面。
 const ang=barAngle(c,f,action)*Math.PI/180;
 ctx.save();ctx.translate((w.x-a.x)*s,(w.y-a.y)*s);ctx.rotate(ang);ctx.scale(s,Math.cos(ang)<0?-s:s);
 const cls=weapon||c.weapon;
 if(typeof icon==='string'&&drawHandArt(ctx,icon,cls,L,part)){}
 else if(ia&&drawItemArt(ctx,ia,L,part)){}
 else if(drawWeaponArt(ctx,cls,c.id.replace(/-(pole|bare)$/,''),L,part,tier)){}
 else if(part==='back'){}
 else if(cls==='heavy')drawBroadBlade(ctx,L,HEAVY_STYLE[c.id]||'steel');
 else{ctx.fillStyle='#3a2a1a';ctx.fillRect(-10,-2.5,10,5);ctx.fillStyle='#c9a24a';ctx.fillRect(-1,-5,3,10);
  ctx.fillStyle='#d8dde3';ctx.beginPath();ctx.moveTo(2,-3);ctx.lineTo(L-8,-3);ctx.lineTo(L,0);ctx.lineTo(L-8,3);ctx.lineTo(2,3);ctx.closePath();ctx.fill();ctx.fillStyle='#8b949c';ctx.fillRect(2,0,L-8,1.5);}
 if(aura&&part!=='back'){ctx.strokeStyle=aura.color;ctx.shadowColor=aura.color;ctx.shadowBlur=aura.level>=2?16:6;ctx.globalAlpha=aura.level>=2?.95:.5;ctx.lineWidth=aura.level>=2?3.5:1.5;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(L,0);ctx.stroke();if(aura.level>=2){ctx.globalAlpha=.35;ctx.lineWidth=8;ctx.stroke();}}
 ctx.restore();
}
// 重兵 (owner 2026-10-06): a broad, thick greatsword in sheet pixels along +x from the grip: a long wrapped hilt, an iron guard, a
// slab blade about 20 px wide with a dark spine, a bright edge and a chamfered tip, outlined so it reads at battle size. 關山月
// (art guanshanyue) carries his 鏽鐵巨劍, so his blade is rust-brown and pitted.
const HEAVY_STYLE={guanshanyue:'rust','guanshanyue-t2a':'rust','guanshanyue-t2b':'rust'};
// A28 weapon sheet (owner 2026-10-07): eight weapons, one per 512 x 128 master cell (shipped at half size), drawn pointing right with
// the grip at (48, 64); `len` is grip-to-tip in master pixels. Class picks the cell; some characters carry their own blade.
// `cells` = [sheet cell, grip-to-tip length, x where the hilt ends]; the hilt part is drawn behind the figure, the rest in front.
const WEAPON_ART={src:'./assets/ui/icons-weapons.webp',scale:.5,cw:512,ch:128,gx:48,gy:64,cells:[[0,300,88],[1,280,82],[2,330,108],[3,340,98],[4,420,62],[5,400,62],[6,320,90],[7,360,108]],byClass:{sword:0,saber:1,heavy:2,spear:4,staff:5},byArt:{guanshanyue:{heavy:3},'guanshanyue-t2a':{heavy:3},'guanshanyue-t2b':{heavy:3},shanyue:{heavy:7},'kagezuki-tonna':{saber:6}}};
// 這個角色在 A28 上有自己的兵器（關山月的鏽鐵巨劍、影月的刀）。
export const ownBlade=id=>!!WEAPON_ART.byArt[String(id||'').replace(/-(pole|bare)$/,'')];
function hiltShare(cls,id){const i=WEAPON_ART.byArt[id.replace(/-(pole|bare)$/,'')]?.[cls]??WEAPON_ART.byClass[cls],c=WEAPON_ART.cells[i];return c?(c[2]-WEAPON_ART.gx)/c[1]:.1;}
// 轉職兵器（群俠江湖 A32）：同樣八種、同格子大小與握點，二轉在格 0～7、三轉在格 8～15（格號＝(轉數−2)×8＋A28 格號）。還沒載好就先畫一轉的。
const PROMOTED_SRC='./assets/ui/icons-weapons-promoted.webp',sheets={};
function weaponSheet(src=WEAPON_ART.src){let im=sheets[src];if(!im&&typeof globalThis.Image==='function'){im=sheets[src]=new globalThis.Image();im.src=src;}return im?.complete&&im.naturalWidth&&(String(im.src).includes('icons-weapons')||String(im.src).includes('weapons-hand'))?im:null;}
// Draws the sheet weapon with its grip at the origin, pointing along +x, grip-to-tip length L; false when the sheet is not ready.
function drawWeaponArt(ctx,cls,artId,L,part,tier=1){const i=WEAPON_ART.byArt[artId]?.[cls]??WEAPON_ART.byClass[cls];if(i==null)return false;const up=tier>=2&&weaponSheet(PROMOTED_SRC),img=up||weaponSheet();if(!img)return false;const [base,len,hilt]=WEAPON_ART.cells[i],cell=up?(Math.min(tier,3)-2)*8+base:base,A=WEAPON_ART,q=L/len,k=A.scale,col=cell%3,row=Math.floor(cell/3);
 const x0=part==='front'?hilt:0,x1=part==='back'?hilt:A.cw;ctx.drawImage(img,(col*A.cw+x0)*k,row*A.ch*k,(x1-x0)*k,A.ch*k,(x0-A.gx)*q,-A.gy*q,(x1-x0)*q,A.ch*q);return true;}
// 關山月傳自己的二十九把上手兵器（群俠江湖 A37，Claude 照 A28 規格重排：每格 512 × 128、握點 (48, 64)、刀口朝下；出貨縮一半）。
// items：道具 id → [格號, 握點到刀尖長, 護手結束的 x]。有這張圖的兵器優先畫它，沒有的才用道具圖示轉正的那張。
const HAND_ART={src:'./assets/ui/weapons-hand.webp',scale:.5,cw:512,ch:128,gx:48,gy:64,items:{wandererBlade:[0,300,88],lingSword:[1,300,88],huxiaoJian:[2,310,88],yinyangSwords:[3,290,88],qiushuiSword:[4,310,88],huSaber:[5,280,88],liaoyuanDao:[6,290,88],ghostSaber:[7,280,88],chiqiaoDao:[8,210,88],yingyueDao:[9,300,88],redForgeBlade:[10,330,108],kaishanYue:[11,330,108],jincuodao:[12,289,88],chipoDao:[13,300,88],qixingJian:[14,300,88],xiaodao:[15,280,88],ziwudao:[16,280,88],fuyiren:[17,240,88],qiansiren:[18,279,88],hanpojian:[19,300,88],liangyijian:[20,310,88],fenshuici:[21,180,88],fumochu:[22,300,62],tiaoshan:[23,400,62],fulonggun:[24,400,62],xuantieMashuo:[25,420,62],kusarigama:[26,185,62],gouhunLian:[27,300,62],jiechi:[28,200,62]}};
export const hasHandArt=id=>!!HAND_ART.items[id];
// L 是這個職業的兵器長；照 A28 同類兵器的原圖長度換算，短刀、分水刺畫起來就比長劍短。
function drawHandArt(ctx,id,cls,L,part){const e=HAND_ART.items[id],img=e&&weaponSheet(HAND_ART.src);if(!img)return false;const [cell,len,hilt]=e,A=HAND_ART,ref=WEAPON_ART.cells[WEAPON_ART.byClass[cls]]?.[1]||len,q=L/ref,k=A.scale,col=cell%3,row=Math.floor(cell/3);
 const x0=part==='front'?hilt:0,x1=part==='back'?hilt:A.cw;ctx.drawImage(img,(col*A.cw+x0)*k,row*A.ch*k,(x1-x0)*k,A.ch*k,(x0-A.gx)*q,-A.gy*q,(x1-x0)*q,A.ch*q);return true;}
// 兵器上手（Leo 2026-10-08）：道具圖示轉正的兵器圖（scripts/build-weapon-items.py），握點在原點、刀尖朝 +x、握點到刀尖長 L。
let itemImg=null;
function itemSheet(){if(!itemImg&&typeof globalThis.Image==='function'){itemImg=new globalThis.Image();itemImg.src=WEAPON_ITEMS.src;}return itemImg?.complete&&itemImg.naturalWidth?itemImg:null;}
// 劍、刀的圖示刀身比例短，照職業長度畫看起來太短（Leo 2026-10-08），再拉長一些。
const ITEM_STRETCH={sword:1.45,saber:1.65};
function drawItemArt(ctx,ia,L,part){const img=itemSheet();if(!img)return false;const W=WEAPON_ITEMS,q=L*(ITEM_STRETCH[ia.cls]||1)/ia.len,col=ia.cell%W.cols,row=Math.floor(ia.cell/W.cols);
 const x0=part==='front'?ia.hilt:0,x1=part==='back'?ia.hilt:W.cw;if(x1<=x0)return true;ctx.drawImage(img,col*W.cw+x0,row*W.ch,x1-x0,W.ch,(x0-ia.gx)*q,-ia.gy*q,(x1-x0)*q,W.ch*q);return true;}
const BLADE_COLORS={steel:{body:'#c4cbd2',spine:'#7f8890',edge:'#f1f4f7',spot:null},rust:{body:'#7a6253',spine:'#4c3b33',edge:'#c2b8ab',spot:'#9a4c27',pit:'#3a2920'}};
function drawBroadBlade(ctx,L,style){
 const col=BLADE_COLORS[style]||BLADE_COLORS.steel,W=10,tip=Math.max(14,L*.16);
 ctx.fillStyle='#2b1d14';ctx.fillRect(-16,-3,16,6);ctx.fillStyle='#4a3424';for(let x=-15;x<0;x+=4)ctx.fillRect(x,-3,2,6);
 ctx.fillStyle='#3b3f44';ctx.fillRect(-2,-W-3,6,2*W+6);ctx.fillStyle='#6e757c';ctx.fillRect(-1,-W-2,2,2*W+4);
 ctx.beginPath();ctx.moveTo(4,-W);ctx.lineTo(L-tip,-W);ctx.lineTo(L,-W*.15);ctx.lineTo(L,W*.35);ctx.lineTo(L-tip*.4,W);ctx.lineTo(4,W);ctx.closePath();
 ctx.fillStyle=col.body;ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='#1d1814';ctx.stroke();
 ctx.fillStyle=col.spine;ctx.fillRect(4,-W,L-tip-2,4);ctx.fillStyle=col.edge;ctx.fillRect(6,W-3,L-tip*.4-8,2);
 ctx.fillStyle=col.spine;ctx.fillRect(10,-1,L-tip-14,2);
 if(col.spot)for(let i=0;i<16;i++){const x=8+i*(L-tip-10)/16,y=((i*7)%15)-8;ctx.fillStyle=i%4===3?col.pit:col.spot;ctx.fillRect(x,y,3+(i%3)*2,2+(i%2)*2);if(i%5===0){ctx.fillStyle=col.pit;ctx.fillRect(x+2,y+3,2,2);}}
}
