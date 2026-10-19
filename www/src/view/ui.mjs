// 畫面小工具：建元素、彈窗、對話框、選單、動作圖小畫布。
import {drawMotion,createMotionBank,hasAction} from '../motion.mjs';
import {injuryOf} from '../core/injury.mjs';
export const bank=()=>createMotionBank();
export function h(tag,attrs={},...kids){
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='class')e.className=v;else if(k==='style'&&typeof v==='object'){for(const [p,x] of Object.entries(v))if(p.startsWith('--'))e.style.setProperty(p,x);else e.style[p]=x;}else if(k==='html')e.innerHTML=v;else e.setAttribute(k,v===true?'':v);}
 for(const c of kids.flat())if(c!=null&&c!==false)e.append(c instanceof Node?c:document.createTextNode(String(c)));
 return e;
}
export function mount(el){const app=document.getElementById('app');app.replaceChildren(el);return el;}
// 提示放在上方狀態列下面（手機上狀態列有兩行，原本固定 70px 會蓋住按鈕）；同時有好幾個就往下排
export function toast(msg,ms=2200){if(!msg)return;const hud=document.querySelector('#app .hud'),top=hud?hud.getBoundingClientRect().bottom+8:70,n=document.querySelectorAll('.toast').length;
 const t=h('div',{class:'toast',style:{top:top+n*44+'px'}},msg);document.body.append(t);setTimeout(()=>t.style.opacity=0,ms);setTimeout(()=>t.remove(),ms+500);}
// 受傷標籤（輕傷白、中傷黃、重傷紫、瀕死紅）
export const injTag=n=>{const t=injuryOf(n||0);return t?h('span',{class:'inj',style:{color:t.color,borderColor:t.color},title:`受傷程度 ${n}`},t.name):null;};
export const bar=(v,max,c)=>h('span',{class:'bar',style:'--c:'+c},h('i',{style:{width:Math.max(0,Math.min(100,v/Math.max(1,max)*100))+'%'}}));

// 鍵盤（第 10 輪）：Esc 關最上層視窗；對話中 Enter、空白鍵、Esc 都是下一句。選單打開時先把焦點放在第一個選項，Enter 直接選、Tab 換選項
const openModals=[];
globalThis.addEventListener?.('keydown',e=>{ // 在 node 測試裡載入時沒有 window
 if(e.isComposing||e.repeat)return;
 const t=document.querySelector('.talk');if(t&&['Enter',' ','Escape'].includes(e.key)){e.preventDefault();t.click();return;}
 if(e.key==='Escape'&&openModals.length){e.preventDefault();openModals[openModals.length-1]();}
});
// 彈窗：content 是元素或函式（每次 refresh 重畫）
export function modal(title,content,{onClose}={}){
 const body=h('div',{class:'body'}),box=h('div',{class:'panel modal'},h('div',{class:'row'},h('h3',{class:'grow'},title),h('button',{onclick:()=>close()},'關閉')),body);
 const ov=h('div',{class:'overlay',onclick:e=>{if(e.target===ov)close();}},box);
 const refresh=()=>body.replaceChildren(typeof content==='function'?content(refresh,close):content);
 function close(){const i=openModals.indexOf(close);if(i<0)return;openModals.splice(i,1);ov.remove();onClose?.();}
 refresh();document.body.append(ov);openModals.push(close);return {close,refresh};
}
// 選單：回傳選到的 value，取消回傳 null
export function choose(title,options,{text}={}){
 return new Promise(res=>{let m,picked=null;
  const list=h('div',{class:'opts'},...(text?[h('div',{},text)]:[]),...options.map(o=>h('button',{disabled:o.disabled,onclick:()=>{picked=o.value;m.close();}},o.label,o.note?h('small',{},o.note):null)));
  m=modal(title,list,{onClose:()=>res(picked)});list.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
 });
}
// 對話：lines = [[說話的人, 動作圖 id 或 null, 文字], ...]，點一下下一句
export function talk(lines){
 return new Promise(res=>{let i=0;const cv=spriteCanvas(null,{w:80,h:100,height:88});
  const who=h('div',{class:'who'}),txt=h('div',{}),wrap=h('div',{class:'talk'},h('div',{class:'panel'},cv,h('div',{class:'grow'},who,txt),h('span',{class:'next'},'▼')));
  const show=()=>{const [n,art,t]=lines[i];who.textContent=n||'';txt.textContent=t;cv.style.visibility=art?'visible':'hidden';cv._art=art;};
  wrap.addEventListener('click',()=>{i++;if(i>=lines.length){wrap.remove();res();}else show();});
  show();document.body.append(wrap);
 });
}
// 動作圖小畫布：在全域動畫迴圈裡一直重畫，元素拿掉就停
const live=new Set();let looping=false;
// 動作圖本身一秒只有 6～12 格，小畫布一秒重畫 15 次就夠，省手機電力（第 1 輪優化）
let lastT=-1e9;
function loop(t){if(t-lastT>=66){lastT=t;for(const c of live){if(!c.isConnected){live.delete(c);continue;}c._draw(t/1000);}}if(live.size)requestAnimationFrame(loop);else looping=false;}
export function spriteCanvas(art,{w=52,h:hh=64,height=56,action='idle',facing='front-right'}={}){
 const dpr=Math.min(2,window.devicePixelRatio||1),cv=h('canvas',{width:w*dpr,height:hh*dpr});cv._art=art;const ctx=cv.getContext('2d');ctx.imageSmoothingQuality='high';
 cv._draw=s=>{ctx.clearRect(0,0,cv.width,cv.height);if(!cv._art)return;ctx.save();ctx.scale(dpr,dpr);drawMotion(ctx,bank(),cv._art,hasAction(cv._art,action)?action:'idle',s,{x:w/2,y:hh-4,height,facing});ctx.restore();};
 live.add(cv);if(!looping){looping=true;requestAnimationFrame(loop);}return cv;
}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// 確認框（不用 window.confirm：網頁嵌在 claude.ai 裡時瀏覽器的確認框會被擋掉）
export const ask=async(text,ok='確定')=>(await choose('確認',[{label:ok,value:true},{label:'取消',value:false}],{text}))===true;
