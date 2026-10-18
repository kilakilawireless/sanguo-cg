// 標題、創角（照原作：選造型、取名、分 30 點、屬性 10 點）、開場（三國版「召喚之間」：洛陽觀星臺）。
import {h,mount,spriteCanvas,talk,toast,ask} from './ui.mjs';
import {G,go,save,load,wipe} from '../game.mjs';
import {createPlayer,addItem} from '../core/player.mjs';
import {BP_KEYS,BP_NAMES,STAT_NAMES,CREATE_BP,ELEMS,ELEM_NAMES,derive,validElement,singleCapAt} from '../core/stats.mjs';
import {LOOKS} from '../data/looks.mjs';

export function showTitle(){
 const saved=load();
 mount(h('div',{class:'screen bg title',style:{'--bg':'url(./assets/scenes/temple.webp)'}},
  h('h1',{},'三國魔力寶貝'),h('p',{class:'sub'},'天門異獸錄'),
  saved?h('button',{class:'primary',onclick:()=>{G.p=saved;try{go.town();}catch(e){toast('存檔有地方讀不懂：'+e.message,5000);}}},`繼續（${saved.name} Lv${saved.lv}）`):null,
  h('button',{class:saved?'':'primary',onclick:async()=>{if(saved&&!await ask('會覆蓋現在的存檔，確定重新開始？','重新開始'))return;showCreate();}},'新的旅程'),
  G.broken?h('p',{class:'small red'},'舊存檔讀不到，已另外備份起來（sanguo-cg-v1-broken），開新遊戲不會蓋掉它。'):null,
  h('p',{class:'small muted'},'試玩版：洛陽、就職、轉職、晉級正職。')));
}

export function showCreate(){
 const st={name:'',look:LOOKS[0].id,bp:{vit:0,str:0,tgh:0,qui:0,mgc:0},elem:{earth:0,water:0,fire:0,wind:0}};
 const cap=singleCapAt(1);
 const root=h('div',{class:'screen bg create',style:{'--bg':'url(./assets/scenes/temple.webp)'}});
 const draw=()=>{
  const used=BP_KEYS.reduce((n,k)=>n+st.bp[k],0),eSum=ELEMS.reduce((n,k)=>n+st.elem[k],0),d=derive(Object.fromEntries(BP_KEYS.map(k=>[k,st.bp[k]*100])));
  const okE=validElement(st.elem);
  root.replaceChildren(
   h('h2',{class:'gold'},'創造角色'),
   h('div',{class:'panel col'},h('b',{},'造型'),h('div',{class:'looks'},...LOOKS.map(l=>h('button',{class:st.look===l.id?'on':'',onclick:()=>{st.look=l.id;draw();}},spriteCanvas(l.id,{w:64,h:80,height:70}),h('div',{class:'small'},`${l.name}（${l.sex}）`)))),
    h('div',{class:'row'},'名字',h('input',{maxlength:8,value:st.name,placeholder:'最多 8 個字',oninput:e=>st.name=e.target.value}))),
   h('div',{class:'panel col'},h('div',{class:'row'},h('b',{class:'grow'},'基本點數'),h('span',{class:used===CREATE_BP?'green':'gold'},`剩 ${CREATE_BP-used} 點`),h('span',{class:'small muted'},`單項最多 ${cap}`)),
    ...BP_KEYS.map(k=>h('div',{class:'bp-row'},h('span',{},BP_NAMES[k]),h('b',{},st.bp[k]),h('span',{class:'small muted'},{vit:'生命、回復',str:'攻擊',tgh:'防禦',qui:'敏捷（出手順序、閃躲）',mgc:'魔力、精神'}[k]),
     h('button',{disabled:!st.bp[k],onclick:()=>{st.bp[k]--;draw();}},'−'),h('button',{disabled:used>=CREATE_BP||st.bp[k]>=cap,onclick:()=>{st.bp[k]++;draw();}},'+'))),
    h('div',{class:'small'},...['hp','mp','atk','def','agi','spr','rec'].map(s=>h('span',{style:{marginRight:'10px'}},`${STAT_NAMES[s]} ${d[s]}`)))),
   h('div',{class:'panel col'},h('div',{class:'row'},h('b',{class:'grow'},'屬性'),h('span',{class:okE?'green':'gold'},okE?'可以':`合計 ${eSum}/10`)),
    h('div',{class:'small muted'},'地水火風共 10 點，最多兩種，要相鄰：地水、水火、火風、風地。地剋水、水剋火、火剋風、風剋地。'),
    ...ELEMS.map(k=>h('div',{class:'bp-row'},h('span',{},ELEM_NAMES[k]),h('b',{},st.elem[k]),h('span',{}),
     h('button',{disabled:!st.elem[k],onclick:()=>{st.elem[k]--;draw();}},'−'),h('button',{disabled:eSum>=10,onclick:()=>{st.elem[k]++;draw();}},'+')))),
   h('div',{class:'row'},h('button',{onclick:showTitle},'返回'),h('span',{class:'grow'}),h('button',{class:'primary',onclick:()=>{
    const r=createPlayer({name:st.name,look:st.look,bp:st.bp,elem:st.elem});if(!r.ok){toast(r.msg,3000);return;}
    wipe();G.p=r.player;save();opening();}},'決定')));
 };
 draw();mount(root);
}

const SAGE='yunzhonghe';
async function opening(){
 mount(h('div',{class:'screen bg',style:{'--bg':'url(./assets/scenes/temple.webp)'}},h('div',{class:'place-title'},h('h2',{},'洛陽・觀星臺'))));
 const n=G.p.name;
 await talk([
  ['南華老仙',SAGE,`……醒了嗎，${n}。從另一個世界來的旅人。`],
  ['南華老仙',SAGE,'這裡是洛陽城的觀星臺。張角用《太平要術》打開了天門，山海經裡的異獸一隻隻跑進了人間。'],
  ['南華老仙',SAGE,'是我把你召來的。要封住天門，得靠你們這些異世之人。'],
  ['南華老仙',SAGE,'不過你現在只是個遊民，什麼本事都沒有。先去城裡的職業公會問問，怎麼才能就職。'],
  ['南華老仙',SAGE,'一個人走不遠。城裡酒館有個叫典韋的壯漢，正想找人同行，去找他吧。'],
  ['南華老仙',SAGE,'這幾帖金創藥你帶著。走吧，洛陽城就在臺下。'],
 ]);
 addItem(G.p,'potion',3);save();toast('得到金創藥 ×3');go.town();
}
