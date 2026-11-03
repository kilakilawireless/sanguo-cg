// 聊天室（Leo 2026-11-03）：右下角一顆泡泡，每一頁、戰鬥中都叫得出來；世界頻道大家都看得到，組隊或 PK 時多一個隊伍／對手頻道
// 畫在 app 外面自己的 div（#chat），遊戲重畫不會洗掉正在打的字；訊息存在 db 的 talk/（online.mjs watchTalk／postTalk）
import {h} from '../view/ui.mjs';
import {watchTalk,postTalk,deleteTalk,talkOf,talkUnread,TALK_LEN} from './online.mjs';

const SEEN_KEY='sanguo-cg-mud-chat-seen';
const QUICK=['找人組隊打迷宮王','有人要 PK 嗎？','收材料，私我','謝謝！','gg'];
const C={list:[],uid:null,open:false,ch:'w',seen:{},text:'',msg:'',busy:false,root:null,getP:null,getRoom:null,unsub:null};
const load=()=>{try{C.seen=JSON.parse(localStorage.getItem(SEEN_KEY)||'{}')||{};}catch{C.seen={};}};
const keep=()=>{try{localStorage.setItem(SEEN_KEY,JSON.stringify(C.seen));}catch{}};
const hhmm=t=>{const d=new Date(+t||0);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

// 現在有哪些頻道：世界一定有；在隊伍（開隊、等出發、組隊打）或即時 PK 中多一個
function channels(){const r=C.getRoom?.();return [['w','世界'],...(r?[[r.id,r.label]]:[])];}
function markSeen(){if(!C.open)return;const last=talkOf(C.list,C.ch).at(-1);if(last&&(+last.t||0)>(+C.seen[C.ch]||0)){C.seen[C.ch]=+last.t;keep();}}
const unreadAll=()=>channels().reduce((n,[id])=>n+talkUnread(C.list,C.seen[id],C.uid,id),0);

export function initChat({getP,getRoom}){
 if(C.root||typeof document==='undefined')return;
 C.getP=getP;C.getRoom=getRoom;load();
 C.root=h('div',{id:'chat'});document.body.appendChild(C.root);
 watchTalk((list,uid)=>{C.list=list;C.uid=uid;markSeen();draw();}).then(u=>{C.unsub=u;});
 draw();
}
// 遊戲換頁、進出隊伍時叫一下（頻道可能多了或少了）
let lastKey='';
export function chatSync(){if(!C.root)return;const t=channels(),k=t.map(x=>x[0]).join();if(k===lastKey)return;lastKey=k;if(!t.some(([id])=>id===C.ch))C.ch='w';draw();}

function send(){
 const p=C.getP?.();if(!p||C.busy)return;const text=C.text;
 C.busy=true;C.msg='';draw();
 postTalk(p,text,C.list,C.ch).then(r=>{C.busy=false;if(r.ok)C.text='';C.msg=r.msg||'';draw();if(r.ok)C.root.querySelector('input')?.focus();});
}

function draw(){
 const R0=C.root;if(!R0)return;
 const n=unreadAll();
 if(!C.open){R0.replaceChildren(h('button',{class:'chat-fab',title:'聊天室',onclick:()=>{C.open=true;markSeen();draw();setTimeout(()=>C.root.querySelector('input')?.focus({preventScroll:true}),0);}},'聊',n?h('i',{class:'badge'},n>99?'99+':String(n)):null));return;}
 // 打開時只換頻道列和訊息清單，輸入框那塊留著（換掉的話打到一半的字、焦點會不見）
 let panel=R0.querySelector('.chat-panel');
 if(!panel){
  const inp=h('input',{type:'text',maxlength:TALK_LEN,value:C.text,enterkeyhint:'send',
   oninput:e=>{C.text=e.target.value;},onkeydown:e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();send();}}});
  panel=h('div',{class:'chat-panel'},h('div',{class:'chat-head'}),h('div',{class:'chat-list'}),
   h('div',{class:'chat-foot'},
    h('div',{class:'chat-quick'},...QUICK.map(q=>h('button',{class:'chip',onclick:()=>{C.text=q;inp.value=q;send();}},q))),
    h('div',{class:'chat-in'},inp,h('button',{class:'hot send',onclick:send},'送出')),
    h('p',{class:'small warn chat-note'})));
  R0.replaceChildren(panel);
 }
 const old=panel.querySelector('.chat-list'),fresh=old.childElementCount===0,atBottom=fresh||old.scrollHeight-old.scrollTop-old.clientHeight<40,top=old.scrollTop;
 const tabs=channels();
 panel.querySelector('.chat-head').replaceChildren(...tabs.map(([id,name])=>{const u=id===C.ch?0:talkUnread(C.list,C.seen[id],C.uid,id);return h('button',{class:'chip'+(id===C.ch?' on':''),onclick:()=>{C.ch=id;markSeen();draw();panel.querySelector('.chat-list').scrollTop=1e9;}},name,u?h('i',{class:'badge'},String(u)):null);}),
  h('span',{class:'grow'}),h('button',{class:'chip',title:'關掉',onclick:()=>{C.open=false;draw();}},'✕'));
 const msgs=talkOf(C.list,C.ch).slice(-100);
 old.replaceChildren(msgs.length?'':h('p',{class:'dim small'},C.ch==='w'?'還沒有人說話，打聲招呼吧。':'這個頻道只有這一隊看得到。'),
  ...msgs.map(m=>{const mine=m.uid===C.uid;return h('div',{class:'chat-msg'+(mine?' mine':'')},
   h('div',{class:'small dim'},h('b',{class:'who',onclick:mine?null:()=>{const i=panel.querySelector('input');C.text=`@${m.name} `+C.text;i.value=C.text;i.focus();}},m.name||'？'),m.acct?`（${m.acct}）`:'',` ${hhmm(m.t)}`,
    mine?h('button',{class:'link',onclick:()=>deleteTalk(m)},'刪'):null),
   h('div',{class:'txt'},m.text));}));
 old.scrollTop=atBottom?old.scrollHeight:top;
 const inp=panel.querySelector('input');inp.placeholder=C.ch==='w'?'對大家說…':'對隊伍說…';if(inp.value!==C.text)inp.value=C.text;
 panel.querySelector('.send').disabled=C.busy;panel.querySelector('.chat-note').textContent=C.msg;
}
export const _chatState=C; // 測試、除錯用
