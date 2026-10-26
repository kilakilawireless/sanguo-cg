// 文字版擂台的畫面：上面是名帖（狀態），選單跟在名帖下面（不固定在螢幕底部，Leo 2026-10-26），再下面是各頁內容。
// 角色是三國武將的立繪（generals.mjs），魔物用本作的動作圖。戰鬥：場景圖上畫雙方，指令在圖的正下方，戰況一行一行往下長。
// 規則全在 core/ 與 mud/rules.mjs；交易所、存檔在 mud/online.mjs。
import {h} from '../view/ui.mjs';
import {drawMotion,createMotionBank} from '../motion.mjs';
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import {derive,BP_KEYS,BP_NAMES,CREATE_BP,singleCapAt,expFor,ELEM_NAMES} from '../core/stats.mjs';
import {injuryOf} from '../core/injury.mjs';
import {autoCommand} from '../core/ai.mjs';
import {JOBS,rankName,titleOf} from '../data/jobs.mjs';
import {SKILLS,STATUS_NAMES} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOT_NAMES,WEAPON_TYPE_NAMES,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {GENERALS,GENERAL_BY_ID,FACTIONS} from './generals.mjs';
import {GUIDE,BP_TABLE,jobFacts,TIPS} from './guide.mjs';
import {loadHero,saveHero,clearLocal,watchRivals,recordBout,boutsAgainstMe,net,watchMarket,postListing,cancelListing,buyListing,collectSales,LIST_MAX} from './online.mjs';

const app=document.getElementById('app');
const S={p:null,tab:'town',shop:'weapon',guide:'sword',log:[],rivals:[],npcs:R.npcRivals(),against:null,battle:null,confirmWipe:false,market:[],uid:null,mkMsg:'',mkBusy:false,pickLook:false};
const bank=createMotionBank();
const say=(t,c='sys')=>{S.log.push({t,c});if(S.log.length>80)S.log.splice(0,S.log.length-80);};
const save=()=>saveHero(S.p);
const ARMOR_NAMES={heavy:'鎧',light:'衣',robe:'袍'};
const ELEM_PRESETS=[{earth:10},{water:10},{fire:10},{wind:10},{earth:5,water:5},{water:5,fire:5},{fire:5,wind:5},{wind:5,earth:5}];
const elemText=e=>Object.entries(e||{}).filter(([,v])=>v>0).map(([k,v])=>ELEM_NAMES[k]+v).join(' ')||'無';
const elemTags=e=>Object.entries(e||{}).filter(([,v])=>v>0).map(([k,v])=>h('span',{class:'el el-'+k},ELEM_NAMES[k]+v));
const jobOf=p=>rankName(p.job,p.rank);
const KIND_CLASS={weapon:'k-weapon',armor:'k-armor',use:'k-use',crystal:'k-crystal',material:'k-mat',key:'k-key'};
const loop=new Set();
(function tick(now){for(const f of [...loop])f(now);requestAnimationFrame(tick);})(performance.now());
const art=id=>`./assets/mud/${id}.png`;

// ---------- 小元件 ----------
function meter(cls,v,max,label){return h('div',{class:'meter '+cls},h('i',{style:{width:Math.max(0,Math.min(100,v/Math.max(1,max)*100))+'%'}}),h('span',{},label));}
// 武將頭像：從立繪裁出來的臉（assets/mud/face/，照膚色找臉的位置裁的）
function face(id,size=56,cls=''){return h('span',{class:'face '+cls,style:{width:size+'px',height:size+'px'}},h('img',{src:`./assets/mud/face/${id}.png`,alt:GENERAL_BY_ID[id]?.name||'',loading:'lazy'}));}
const head=(title,sub)=>h('div',{class:'head'},h('h2',{},title),sub?h('span',{class:'small dim'},sub):null);
const act=(fn,ok='heal')=>()=>{const r=fn();if(r.msg)say(r.msg,r.ok?ok:'sys');if(r.ok)save();render();};

// ---------- 創角 ----------
function createView(mate=false){
 const st={name:'',named:false,look:mate?(S.p.look==='zhaoyun'?'guanyu':'zhaoyun'):'zhaoyun',faction:'蜀',bp:{vit:10,str:15,tgh:0,qui:5,mgc:0},elem:{fire:10},msg:''};
 const draw=()=>{
  const used=BP_KEYS.reduce((n,k)=>n+st.bp[k],0),d=derive(Object.fromEntries(BP_KEYS.map(k=>[k,st.bp[k]*100]))),cap=singleCapAt(1),g=GENERAL_BY_ID[st.look];
  if(!st.named)st.name=g.name;
  app.replaceChildren(h('div',{class:'page'},
   h('header',{class:'hero-banner'},h('span',{class:'seal'},'擂'),h('div',{},h('h1',{class:'title'},'魔力擂台'),h('p',{class:'sub'},'三國群雄，照魔力寶貝的規矩一決高下'))),
   mate?h('section',{class:'card'},head('找一位隨行夥伴','練功時跟你並肩作戰'),h('p',{class:'small dim'},'夥伴有自己的等級、配點、職業、技能和裝備，錢和道具欄跟你共用。練功時由電腦代打；在「狀態」可以換他帶頭，換過來就能自己操作。擂台只派帶頭的那位。'),
    h('button',{class:'ghost',onclick:()=>{S.tab='status';render();}},'先不找')):null,
   h('section',{class:'card'},head('選一位武將',`${GENERALS.length} 位`),
    h('div',{class:'tabs'},...FACTIONS.map(f=>h('button',{class:'f-'+f+(st.faction===f?' on':''),onclick:()=>{st.faction=f;draw();}},f))),
    h('div',{class:'gen-grid'},...GENERALS.filter(x=>x.faction===st.faction).map(x=>h('button',{class:'gen'+(st.look===x.id?' on':''),onclick:()=>{st.look=x.id;draw();}},face(x.id,52),h('span',{},x.name)))),
    h('div',{class:'gen-pick'},h('img',{class:'stand',src:art(g.id),alt:g.name}),h('div',{class:'grow'},h('b',{class:'big-name'},g.name),h('span',{class:'small dim'},`　字${g.courtesy}・${g.faction}`),h('p',{class:'small'},g.bio),
     h('label',{class:'field'},h('span',{class:'small dim'},'名號（預設是武將名，可以改，1～8 個字）'),h('input',{value:st.name,maxlength:8,oninput:e=>{st.name=e.target.value;st.named=true;}}))))),
   h('section',{class:'card'},head(`BP 配點 ${used}/${CREATE_BP}`,`單項最多 ${cap}`),
    h('div',{class:'row wrap'},...[['物理型',{vit:10,str:15,tgh:0,qui:5,mgc:0}],['魔法型',{vit:10,str:0,tgh:0,qui:5,mgc:15}],['耐打型',{vit:15,str:10,tgh:5,qui:0,mgc:0}]].map(([n,b])=>h('button',{class:'chip',onclick:()=>{st.bp={...b};draw();}},n))),
    ...BP_KEYS.map(k=>h('div',{class:'row bp'},h('span',{class:'grow'},BP_NAMES[k]),
     h('button',{class:'step',disabled:st.bp[k]<=0,onclick:()=>{st.bp[k]--;draw();}},'−'),h('b',{class:'num'},st.bp[k]),
     h('button',{class:'step',disabled:st.bp[k]>=cap||used>=CREATE_BP,onclick:()=>{st.bp[k]++;draw();}},'＋'))),
    h('div',{class:'statline'},...[['生命',d.hp],['魔力',d.mp],['攻擊',d.atk],['防禦',d.def],['敏捷',d.agi],['精神',d.spr],['回復',d.rec]].map(([k,v])=>h('span',{},h('small',{},k),h('b',{},v))))),
   h('section',{class:'card'},head('屬性','地水火風合計 10，相鄰兩種'),h('div',{class:'row wrap'},...ELEM_PRESETS.map(e=>h('button',{class:'chip'+(JSON.stringify(e)===JSON.stringify(st.elem)?' on':''),onclick:()=>{st.elem=e;draw();}},...elemTags(e))))),
   st.msg?h('p',{class:'warn'},st.msg):null,
   h('button',{class:'main',onclick:()=>{
    const opts={name:st.name,look:st.look,bp:st.bp,elem:st.elem,seed:(Math.random()*2**31)>>>0};
    if(mate){const r=R.addMate(S.p,opts);if(!r.ok){st.msg=r.msg;draw();return;}say(r.msg,'win');save();S.tab='status';render();return;}
    const r=R.newHero(opts);
    if(!r.ok){st.msg=r.msg;draw();return;}
    S.p=r.player;S.log=[];say(`${S.p.name}來到了法蘭城。`,'win');say('先到「公會」就職、到「商店」買裝備，再去「練功」。打倒魔物掉的魔石拿去商店賣錢。不知道選什麼職業就看「攻略」。');
    save();S.tab='town';render();}},mate?'就是他了':'踏入法蘭城')));
 };
 draw();
}

// ---------- 主畫面 ----------
function statusCard(){
 const p=S.p,s=P.stats(p),inj=injuryOf(p.inj||0);
 return h('header',{class:'status'},face(p.look,68,'big'),h('div',{class:'grow'},
  h('div',{class:'row between'},h('b',{class:'big-name'},p.name),h('span',{class:'badge'},`Lv${p.lv}　${jobOf(p)}`)),
  meter('hp',p.hp,s.maxHp,`生命 ${p.hp}/${s.maxHp}`),meter('mp',p.mp,s.maxMp,`魔力 ${p.mp}/${s.maxMp}`),
  h('div',{class:'row between small'},h('span',{class:'gold'},`${p.gold} 金`),inj?h('span',{class:'warn'},inj.name):null,p.freeBp?h('button',{class:'link ok',onclick:()=>{S.tab='status';render();}},`可配點 ${p.freeBp}`):null,h('span',{class:'dim'},`擂台 ${p.w||0} 勝 ${p.l||0} 敗`))));
}
const TABS=[['town','城中','城'],['status','狀態','狀'],['bag','道具','囊'],['shop','商店','商'],['hospital','醫院','醫'],['guild','公會','會'],['master','大師','師'],['hunt','練功','練'],['arena','擂台','擂'],['market','交易所','易'],['guide','攻略','略']];
function render(){
 if(S.battle)return battleView();
 const body={town:townView,status:statusView,bag:bagView,shop:shopView,hospital:hospitalView,guild:guildView,master:masterView,hunt:huntView,arena:arenaView,market:marketView,guide:guideView}[S.tab]();
 app.replaceChildren(h('div',{class:'page'},statusCard(),
  h('nav',{class:'menu'},...TABS.map(([k,n,g])=>h('button',{class:S.tab===k?'on':'',onclick:()=>{S.tab=k;S.confirmWipe=false;S.pickLook=false;S.confirmDrop=false;render();}},h('i',{},g),h('span',{},n)))),body));
}
function logBox(){const box=h('div',{class:'log'},...S.log.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});return box;}
function townView(){
 return h('div',{},h('section',{class:'card town'},head('法蘭城','冒險者的起點'),h('p',{class:'dim'},PLACES.luoyang.desc),
  h('div',{class:'quick'},...[['hunt','出城練功'],['arena','上擂台'],['hospital','去醫院']].map(([k,n])=>h('button',{onclick:()=>{S.tab=k;render();}},n)))),logBox());
}

function statusView(){
 const p=S.p,s=P.stats(p),cap=singleCapAt(p.lv),g=GENERAL_BY_ID[p.look];
 return h('div',{},
  h('section',{class:'card'},h('div',{class:'gen-pick'},h('img',{class:'stand',src:art(p.look),alt:g.name}),h('div',{class:'grow'},
   h('b',{class:'big-name'},p.name),h('div',{class:'small dim'},`${g.name}・${g.faction}　${jobOf(p)}`),
   h('table',{class:'kv'},...[['等級',`${p.lv}（經驗 ${p.exp}/${expFor(p.lv+1)}）`],['聲望',`${p.rep}（${titleOf(p.rep)}）`],['屬性',h('span',{},...elemTags(p.elem))],['受傷',injuryOf(p.inj||0)?`${injuryOf(p.inj).name}（${p.inj}）`:'沒有']].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v)))),
   h('button',{class:'chip',onclick:()=>{S.pickLook=!S.pickLook;render();}},S.pickLook?'收起':'換武將立繪'))),
   S.pickLook?h('div',{class:'gen-grid'},...GENERALS.map(x=>h('button',{class:'gen'+(p.look===x.id?' on':''),onclick:()=>{p.look=x.id;S.pickLook=false;save();render();}},face(x.id,44),h('span',{},x.name)))):null),
  h('section',{class:'card'},head('BP',p.freeBp?`可分配 ${p.freeBp} 點（單項最多 ${cap}）`:`單項最多 ${cap}`),
   ...BP_KEYS.map(k=>h('div',{class:'row bp'},h('span',{class:'grow'},BP_NAMES[k]),h('b',{class:'num'},Math.floor(p.bp[k]/100)),
    h('button',{class:'step',disabled:!p.freeBp||p.bp[k]/100>=cap,onclick:()=>{const r=P.allocBp(p,k,1);if(r.ok)save();render();}},'＋1'))),
   h('div',{class:'statline'},...[['生命',s.maxHp],['魔力',s.maxMp],['攻擊',s.atk],['防禦',s.def],['敏捷',s.agi],['精神',s.spr],['回復',s.rec]].map(([k,v])=>h('span',{},h('small',{},k),h('b',{},v))))),
  h('section',{class:'card'},head('裝備'),...Object.entries(SLOT_NAMES).map(([slot,n])=>{const id=p.equip[slot];
   return h('div',{class:'row item'},h('span',{class:'slot'},n),h('span',{class:'grow'},id?gearLine(id):h('span',{class:'dim'},'—')),id?h('button',{onclick:act(()=>P.unequip(p,slot),'sys')},'卸下'):null);})),
  h('section',{class:'card'},head('技能',`${p.skills.length}/10 格・點一下看效果`),p.skills.length?null:h('p',{class:'dim'},'還沒學技能，到「大師」學。'),
   ...p.skills.map(x=>skillRow(p,x))),
  mateCard(),
  h('section',{class:'card'},S.confirmWipe?h('div',{class:'row'},h('span',{class:'grow warn'},'角色會整個刪掉，確定嗎？'),h('button',{class:'danger',onclick:()=>{clearLocal();S.p=null;S.confirmWipe=false;createView();}},'刪掉'),h('button',{onclick:()=>{S.confirmWipe=false;render();}},'不要'))
   :h('button',{class:'ghost',onclick:()=>{S.confirmWipe=true;render();}},'重新建立角色')));
}
// 一招技能：點開看這一級和下一級的效果、耗魔、熟練度
function skillRow(p,x){
 const sk=SKILLS[x.id],open=S.openSkill===x.id,pr=R.skillProgress(p,x);
 return h('div',{class:'item skill'+(open?' open':''),onclick:()=>{S.openSkill=open?null:x.id;render();}},
  h('div',{class:'row between'},h('b',{},`${sk.name} Lv${x.lv}`),h('span',{class:'small dim'},`耗魔 ${sk.mp(x.lv)}　${open?'▲':'▼'}`)),
  open?h('div',{class:'skill-detail'},
   h('p',{},h('span',{class:'tag'},'現在'),R.skillDesc(x.id,x.lv)),
   x.lv<pr.cap?h('p',{},h('span',{class:'tag'},`Lv${x.lv+1}`),R.skillDesc(x.id,x.lv+1),h('span',{class:'dim'},`（耗魔 ${sk.mp(x.lv+1)}）`)):null,
   pr.need?h('div',{},meter('exp',x.exp,pr.need,`熟練度 ${x.exp}/${pr.need}`)):null,
   h('p',{class:'small dim'},pr.need?`練功時用這招，打贏後每用一次得「${pr.perUse} × 敵人平均等級」熟練度（擂台不算）。`:`已經到上限 Lv${pr.cap}${pr.cap<10?'（晉級之後上限會提高）':''}。`,`這一招你的上限 Lv${pr.cap}。`)):null);
}
function mateCard(){
 const p=S.p,m=p.mate;
 if(!m)return h('section',{class:'card'},head('隨行夥伴','還沒有'),h('p',{class:'small dim'},'找一位武將跟著你練功：他有自己的等級、職業、技能、裝備，由電腦代打；隨時可以換他帶頭，換你自己操作。'),
  h('button',{class:'main',onclick:()=>createView(true)},'找夥伴'));
 const ms=R.withMate(p,()=>({s:P.stats(p),job:jobOf(p),hp:p.hp,mp:p.mp,inj:injuryOf(p.inj||0),free:p.freeBp}));
 return h('section',{class:'card'},head('隨行夥伴',GENERAL_BY_ID[m.look].name),
  h('div',{class:'row'},face(m.look,56),h('div',{class:'grow'},h('div',{class:'row between'},h('b',{},m.name),h('span',{class:'badge'},`Lv${m.lv}　${ms.job}`)),
   meter('hp',ms.hp,ms.s.maxHp,`生命 ${ms.hp}/${ms.s.maxHp}`),meter('mp',ms.mp,ms.s.maxMp,`魔力 ${ms.mp}/${ms.s.maxMp}`),
   h('div',{class:'small dim'},[ms.inj?ms.inj.name:'',ms.free?`可配點 ${ms.free}（換他帶頭才能配）`:'',m.skills.length?'技能：'+m.skills.map(x=>`${SKILLS[x.id].name}${x.lv}`).join('、'):'還沒學技能'].filter(Boolean).join('　')))),
  h('div',{class:'row'},h('button',{class:'main',onclick:()=>{const r=R.swapMate(p);say(r.msg,'win');S.openSkill=null;save();render();}},'換他帶頭'),
   S.confirmDrop?h('button',{class:'danger',onclick:()=>{const r=R.dropMate(p);say(r.msg);S.confirmDrop=false;save();render();}},'確定讓他走'):h('button',{class:'ghost',onclick:()=>{S.confirmDrop=true;render();}},'讓他離開')));
}
function gearLine(id){const it=ITEMS[id],bits=[];for(const [k,n] of [['atk','攻'],['def','防'],['agi','敏'],['spr','精'],['matk','魔攻'],['hp','命'],['mp','魔']])if(it[k])bits.push(n+(it[k]>0?'+':'')+it[k]);
 const kind=it.slot==='weapon'?WEAPON_TYPE_NAMES[it.type]:it.armor?ARMOR_NAMES[it.armor]:SLOT_NAMES[it.slot];
 return h('span',{},h('b',{class:KIND_CLASS[it.kind]},it.name),h('span',{class:'small dim'},`（${kind}・${it.lv}級）${bits.join(' ')}`));}
const itemName=(id,n=1)=>h('b',{class:KIND_CLASS[ITEMS[id].kind]},ITEMS[id].name+(n>1?` ×${n}`:''));

function bagView(){
 const p=S.p;
 return h('section',{class:'card'},head(`道具欄 ${p.bag.length}/${P.BAG_SIZE}`,'魔石拿去商店賣'),
  p.bag.length?null:h('p',{class:'dim'},'什麼都沒有。'),
  ...p.bag.map(x=>{const it=ITEMS[x.id],wear=it.slot&&P.canEquip(p,x.id);
   return h('div',{class:'row item'},h('div',{class:'grow'},it.slot?gearLine(x.id):itemName(x.id,x.n),h('div',{class:'small dim'},it.slot?(wear.ok?'':wear.msg):it.desc||'')),
    h('div',{class:'btns'},
     it.slot?h('button',{disabled:!wear.ok,onclick:act(()=>P.equip(p,x.id),'sys')},'裝備'):null,
     it.kind==='use'?h('button',{onclick:act(()=>P.useItemOutside(p,x.id))},'使用'):null));}));
}
function shopView(){
 const p=S.p,list=R.shopStock(S.shop);
 return h('div',{},
  h('div',{class:'tabs'},...['weapon','armor','goods','smithy'].map(k=>h('button',{class:S.shop===k?'on':'',onclick:()=>{S.shop=k;render();}},SHOPS[k].name))),
  h('section',{class:'card'},head(SHOPS[S.shop].name,`身上 ${p.gold} 金`),...list.map(id=>{const it=ITEMS[id],wear=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row item'+(wear.ok?'':' faded')},h('div',{class:'grow'},it.slot?gearLine(id):itemName(id),h('div',{class:'small dim'},(it.slot?'':it.desc)+(wear.ok?'':'你穿不上'))),
    h('button',{class:'buy',disabled:p.gold<it.price,onclick:act(()=>R.buy(p,id),'sys')},`${it.price} 金`));})),
  h('section',{class:'card'},head('收購','裝備照等級、魔石照大小'),h('button',{class:'hot wide',onclick:act(()=>R.sellCrystals(p),'win')},'魔石和材料全部賣掉'),
   ...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>h('div',{class:'row item'},h('span',{class:'grow'},itemName(x.id,x.n)),
    h('button',{onclick:act(()=>R.sell(p,x.id),'sys')},`賣 ${sellPrice(x.id)} 金`)))));
}
function hospitalView(){
 const p=S.p,all=R.restCost(p,'all'),hp=R.restCost(p,'hp'),mp=R.restCost(p,'mp'),tr=R.treatCost(p);
 return h('div',{},h('section',{class:'card'},head('法蘭城醫院','補生命 1 點 0.5 金、補魔力 1 點 1 金'),h('p',{class:'dim small'},'錢不夠時，護士會免費幫你把生命補到三成。'),
  h('div',{class:'stack'},
   h('button',{class:'main',disabled:!all,onclick:act(()=>R.rest(p,'all'))},all?`全部補滿　${all} 金`:'生命魔力都是滿的'),
   h('div',{class:'grid2'},h('button',{disabled:!hp,onclick:act(()=>R.rest(p,'hp'))},`只補生命　${hp} 金`),h('button',{disabled:!mp,onclick:act(()=>R.rest(p,'mp'))},`只補魔力　${mp} 金`)),
   h('button',{disabled:!tr,onclick:act(()=>R.treat(p))},tr?`治傷　${tr} 金`:'沒有受傷'))),logBox());
}
function guildView(){
 const p=S.p,learn=R.learnable(p);
 return h('div',{},
  h('section',{class:'card'},head('職業公會',p.job==='none'?'遊民就職免費':'轉職 1000 金、聲望歸零、從見習重來'),
   ...R.MUD_JOBS.map(id=>{const j=JOBS[id],cur=p.job===id,f=jobFacts(id);
    return h('div',{class:'row item'+(cur?' current':'')},h('div',{class:'grow'},h('b',{},j.name),h('span',{class:'small dim'},`　${GUIDE[id].role}`),h('div',{class:'small dim'},`${f.weapons}・${f.armor}　專長：${f.main.slice(0,3).join('、')}${f.main.length>3?'…':''}`)),
     h('button',{disabled:cur,onclick:act(()=>R.joinJob(p,id),'win')},cur?'目前':p.job==='none'?'就職':'轉職'));})),
  h('section',{class:'card'},head('學技能'),h('p',{class:'small dim'},'技能要找各職業的技能大師學。'),h('button',{onclick:()=>{S.tab='master';render();}},'去找技能大師')));
}
// 技能大師：每位大師教自己那一行的招；學不學得到、上限幾級看你的職業
function masterView(){
 const p=S.p,m=R.MASTERS.find(x=>x.job===S.master)||R.MASTERS.find(x=>x.skills.some(id=>P.capOf(p,id)>0))||R.MASTERS[0];
 return h('div',{},
  h('section',{class:'card'},head('技能大師',`技能欄 ${p.skills.length}/10 格`),p.job==='none'?h('p',{class:'warn'},'遊民什麼都學不了，先到「公會」就職。'):null,
   h('div',{class:'tabs wrap'},...R.MASTERS.map(x=>h('button',{class:(x===m?'on':'')+(x.skills.some(id=>P.capOf(p,id)>0)?'':' dimmed'),onclick:()=>{S.master=x.job;render();}},x.who)))),
  h('section',{class:'card'},head(`${m.hall}・${m.who}`,JOBS[m.job].name+'的本事'),
   ...m.skills.map(id=>{const sk=SKILLS[id],have=P.skillOf(p,id),cap=P.capOf(p,id);
    return h('div',{class:'row item'+(cap?'':' faded')},h('div',{class:'grow'},h('b',{},sk.name),h('span',{class:'small dim'},`　${cap?`你最多練到 Lv${cap}`:`${JOBS[p.job].name}學不了`}　${have?`已學 Lv${have.lv}`:sk.price+' 金'}`),h('div',{class:'small dim'},R.skillDesc(id,have?.lv||1))),
     have?h('button',{class:'ghost',onclick:act(()=>P.forgetSkill(p,id),'sys')},'忘記'):h('button',{disabled:!cap||p.gold<sk.price,onclick:act(()=>P.learnSkill(p,id),'win')},'學'));})),logBox());
}
function huntView(){
 const p=S.p,s=P.stats(p);
 return h('div',{},h('section',{class:'card'},head('練功',`一次遇到 1～${p.lv<=R.NEWBIE_LV?1:p.mate?R.MATE_GROUP_MAX:R.SOLO_GROUP_MAX} 隻`),h('p',{class:'small dim'},p.mate?`${p.mate.name}會跟著你出戰（電腦代打），兩人各一回合行動兩次。打倒魔物會掉魔石。`:'一個人出戰，一回合可以行動兩次。打倒魔物會掉魔石。到「狀態」可以找隨行夥伴。'),
  p.hp<s.maxHp*.3?h('p',{class:'warn'},'生命不到三成，先去醫院吧。'):null,
  ...R.HUNT_SPOTS.map(id=>{const pl=PLACES[id],open=R.spotOpen(p,id);
   return h('div',{class:'spot'+(open.ok?'':' faded'),style:{'--bg':`url(./assets/scenes/${pl.scene}.webp)`}},h('div',{class:'grow'},h('b',{},pl.name),h('span',{class:'badge'},`Lv${pl.lv[0]}～${pl.lv[1]}`),h('div',{class:'small'},open.ok?pl.desc:open.msg)),
    h('button',{class:'hot',disabled:!open.ok||p.hp<=1,onclick:()=>startHunt(id)},'出發'));})));
}
function arenaView(){
 if(!S.against){S.against=[];boutsAgainstMe().then(l=>{S.against=l;if(S.tab==='arena'&&!S.battle)render();});}
 const row=r=>h('div',{class:'row item rival'},face(r.look,48),h('div',{class:'grow'},h('b',{},r.name),h('span',{class:'small'},`　Lv${r.lv} ${rankName(r.job,r.rank)}`),h('div',{class:'small dim'},r.npc?`${GENERAL_BY_ID[r.look]?.faction||''}・競技場常駐`:`${r.w} 勝 ${r.l} 敗`)),
  h('button',{class:'hot',onclick:()=>startBout(r)},'挑戰'));
 return h('div',{},
  h('section',{class:'card'},head('競技場','一對一比武'),h('p',{class:'small dim'},'雙方先補滿生命魔力，打完不扣、不會受傷，喝掉的藥是真的喝掉了。對手不在線上也能打，由電腦照他的技能代打。30 回合沒分勝負比剩下的生命比例。')),
  h('section',{class:'card'},head('線上的冒險者',S.rivals.length?`${S.rivals.length} 人`:''),S.rivals.length?null:h('p',{class:'dim small'},S.online?'還沒有別人建立角色。':'這是離線版，只有常駐好手。'),...S.rivals.map(row)),
  h('section',{class:'card'},head('常駐名將'),...S.npcs.map(row)),
  S.against?.length?h('section',{class:'card'},head('有人來挑戰過你'),...S.against.map(r=>h('p',{class:'small'},`${r.byName} 挑戰你，${r.win===1?'他贏了':r.win===0?'你守住了':'平手'}　${new Date(r.t).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`))):null);
}
// ---------- 交易所 ----------
function marketView(){
 const p=S.p;
 if(!S.online)return h('section',{class:'card'},head('交易所'),h('p',{class:'dim'},'交易所要在發布的網頁（連線版）才開。這裡是離線版。'));
 const mine=S.market.filter(l=>l.seller===S.uid),others=S.market.filter(l=>l.seller!==S.uid&&!l.buyer);
 const sellable=p.bag.filter(x=>ITEMS[x.id].kind!=='key');if(!sellable.some(x=>x.id===S.mkPick))S.mkPick=sellable[0]?.id||'';
 const run=fn=>async()=>{if(S.mkBusy)return;S.mkBusy=true;S.mkMsg='……';render();const r=await fn();S.mkBusy=false;S.mkMsg=r.msg||'';if(r.msg)say(r.msg,r.ok?'win':'sys');render();};
 const sel=h('select',{onchange:e=>{S.mkPick=e.target.value;}},...sellable.map(x=>h('option',{value:x.id,selected:x.id===S.mkPick},`${ITEMS[x.id].name}${x.n>1&&!ITEMS[x.id].slot?` ×${x.n}`:''}`)));
 const inp=h('input',{type:'number',inputmode:'numeric',min:1,placeholder:'價錢（金）',value:S.mkPrice||'',oninput:e=>{S.mkPrice=e.target.value;}});
 return h('div',{},
  h('section',{class:'card'},head('交易所',`身上 ${p.gold} 金`),h('p',{class:'small dim'},`把道具、裝備掛出去讓別的玩家買。可疊的東西整組賣。賣掉的錢在你下次打開遊戲時自動收進來。最多同時掛 ${LIST_MAX} 張單。`),
   S.mkMsg?h('p',{class:'note'},S.mkMsg):null,
   sellable.length?h('div',{class:'sellform'},sel,inp,h('button',{class:'hot',disabled:S.mkBusy,onclick:run(async()=>{const r=await postListing(p,S.mkPick,S.mkPrice,mine.length);if(r.ok)S.mkPrice='';return r;})},'上架')):h('p',{class:'dim small'},'道具欄沒有能賣的東西。')),
  h('section',{class:'card'},head('掛單',`${others.length} 張`),others.length?null:h('p',{class:'dim small'},'現在沒有人在賣東西。'),
   ...others.map(l=>h('div',{class:'row item'},h('div',{class:'grow'},ITEMS[l.item].slot?gearLine(l.item):itemName(l.item,l.n),h('div',{class:'small dim'},`賣家：${l.sellerName}`)),
    h('button',{class:'buy',disabled:S.mkBusy||p.gold<l.price,onclick:run(()=>buyListing(p,l))},`${l.price} 金`)))),
  mine.length?h('section',{class:'card'},head('我的掛單',`${mine.length}/${LIST_MAX}`),...mine.map(l=>h('div',{class:'row item'},h('div',{class:'grow'},itemName(l.item,l.n),h('div',{class:'small dim'},l.buyer?`${l.buyerName} 買了，收錢中`:`${l.price} 金`)),
   l.buyer?null:h('button',{class:'ghost',disabled:S.mkBusy,onclick:run(()=>cancelListing(p,l))},'收回')))):null);
}
// ---------- 攻略 ----------
function guideView(){
 const id=S.guide,g=GUIDE[id],f=jobFacts(id),total=g.bp.reduce((a,b)=>a+b,0);
 return h('div',{},
  h('section',{class:'card'},head('職業攻略','一個人出戰、一回合兩動的打法'),
   h('div',{class:'tabs wrap'},...R.MUD_JOBS.map(j=>h('button',{class:id===j?'on':'',onclick:()=>{S.guide=j;render();}},JOBS[j].name))),
   h('div',{class:'guide'},
    h('h3',{class:'g-title'},JOBS[id].name,h('span',{class:'small dim'},`　${g.role}`)),
    h('table',{class:'kv'},...[['武器',f.weapons],['防具',f.armor],['專長技能',f.main.join('、')],['職階',f.ranks.join(' → ')]].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v)))),
    h('h4',{},'建議配點（每升一級 4 點）'),
    h('div',{class:'bpbar'},...BP_KEYS.map((k,i)=>g.bp[i]?h('span',{class:'bp-'+k,style:{flex:g.bp[i]}},`${BP_NAMES[k][0]} ${Math.round(g.bp[i]/total*100)}%`):null)),
    h('h4',{},'先學'),h('p',{},g.learn.map(s=>SKILLS[s].name).join(' → ')),
    h('h4',{},'擂台'),h('p',{},g.pvp),
    h('h4',{},'練功'),h('p',{},g.hunt))),
  h('section',{class:'card'},head('BP 換算','每 1 點'),h('table',{class:'kv'},...BP_TABLE.map(([k,v])=>h('tr',{},h('th',{},k),h('td',{class:'small'},v))))),
  h('section',{class:'card'},head('新手須知'),...TIPS.map(([t,x])=>h('div',{class:'item'},h('b',{},t),h('p',{class:'small'},x)))));
}

// ---------- 戰鬥 ----------
function startHunt(spot){
 const b=R.startHunt(S.p,spot,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'hunt',spot,scene:PLACES[spot].scene,lines:[{c:'sys',t:`${PLACES[spot].name}${b.floor>1?` 第 ${b.floor} 層`:''}：遇到${R.foes(b).map(u=>`${u.name} Lv${u.lv}`).join('、')}！`}]};
 beginBattle();
}
function startBout(r){
 const b=R.startBout(S.p,r.fighter,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'bout',rival:r,scene:'sect',lines:[{c:'sys',t:`擂台比武：${S.p.name} 對 ${r.name}（Lv${r.lv} ${rankName(r.job,r.rank)}）`}]};
 beginBattle();
}
function beginBattle(){
 const B=S.battle,b=B.b;B.shown=new Map(b.units.map(u=>[u.uid,{hp:u.hp,mp:u.mp,act:'idle',t0:0,dead:!u.alive}]));
 B.menu='main';B.busy=false;B.prev=S.p.lastMud||[{kind:'attack',target:null},{kind:'attack',target:null}];
 battleView();if(S.p.settings.auto)setTimeout(autoRound,300);
}
const me=b=>R.allies(b)[0];
const imgs={};
const imgOf=src=>{let i=imgs[src];if(!i){i=imgs[src]=new Image();i.src=src;}return i;};
function stage(B){
 const cv=h('canvas',{class:'stage'}),ctx=cv.getContext('2d'),bg=imgOf(`./assets/scenes/${B.scene}.webp`);
 const draw=now=>{
  if(!cv.isConnected){loop.delete(draw);return;}
  const dpr=Math.min(2,devicePixelRatio||1),W=cv.clientWidth||360,H=cv.clientHeight||220;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  if(bg.complete&&bg.naturalWidth){const s=Math.max(W/bg.naturalWidth,H/bg.naturalHeight);ctx.drawImage(bg,(W-bg.naturalWidth*s)/2,(H-bg.naturalHeight*s)*.6,bg.naturalWidth*s,bg.naturalHeight*s);}
  const sh=ctx.createLinearGradient(0,H*.55,0,H);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=sh;ctx.fillRect(0,0,W,H);
  const k=H/230,t=now/1000,fs=R.foes(B.b);
  const put=(u,x,y,facing)=>{const v=B.shown.get(u.uid);if(!v)return;const act=v.dead?'defeat':v.act,sec=act==='idle'?t:t-v.t0;
   if(act!=='idle'&&!v.dead&&sec>.8)v.act='idle';
   // 腳下的影子
   ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(x,y,26*k,7*k,0,0,Math.PI*2);ctx.fill();
   ctx.save();if(v.dead)ctx.globalAlpha=.55;
   if(GENERAL_BY_ID[u.art]){
    // 武將立繪：原圖面向右，站在右邊（我方）的翻過來；出手換出招圖，挨打抖一下，倒下躺平
    const atk=(act==='attack'||act==='special')&&sec<.5,img=imgOf(art(u.art+(atk?'_atk':''))),s=(H*.74)/328;
    if(img.complete&&img.naturalWidth){const w=img.naturalWidth*s,hh=img.naturalHeight*s,mirror=facing==='front-left';
     let dx=act==='hit'&&sec<.35?Math.sin(sec*60)*4:0,dy=0;
     ctx.translate(x+dx,y+dy);if(mirror)ctx.scale(-1,1);
     // 倒下：變灰、往下沉一點（轉九十度會轉出畫面外）
     if(v.dead){ctx.filter='grayscale(1)';ctx.translate(0,hh*.08*Math.min(1,(t-v.t0)*3));}
     else if(act==='hit'&&sec<.2)ctx.filter='brightness(2.2)';
     // 出招圖比站姿寬（往前伸的兵器），跟站姿的背後對齊，不然人會往後跳
     const idle=imgOf(art(u.art)),left=atk&&idle.naturalWidth?-idle.naturalWidth*s/2:-w/2;
     ctx.drawImage(img,left,-hh,w,hh);}
   }else{if(u.tint)ctx.filter=u.tint;
    drawMotion(ctx,bank,u.art,act,Math.max(0,sec),{x,y,height:(u.h||90)*k,facing,weapon:null});}
   ctx.restore();};
  fs.forEach((u,i)=>put(u,W*(fs.length===1?.27:i===0?.32:.13),H-(i===0?12:36)*k,'front-right'));
  // 隨行夥伴站在後面一點
  const mate=B.b.units.find(u=>u.uid==='m');if(mate)put(mate,W*.85,H-38*k,'front-left');
  put(me(B.b),W*(mate?.68:.74),H-(mate?10:16)*k,'front-left');
 };
 loop.add(draw);
 return h('div',{class:'stage-wrap'},cv,h('span',{class:'round'},B.b.over?'結束':`第 ${B.b.round+1} 回合`));
}
function unitCard(B,u){
 const v=B.shown.get(u.uid),st=u.st&&!v.dead?STATUS_NAMES[u.st.k]:'';
 const pickable=u.side!=='ally'&&!v.dead&&R.foes(B.b).filter(x=>x.alive).length>1,on=pickable&&(B.tgt===u.uid||!R.foes(B.b).some(x=>x.alive&&x.uid===B.tgt)&&R.foes(B.b).find(x=>x.alive)===u);
 return h('div',{class:'unit'+(v.dead?' dead':'')+(u.side==='ally'?' mine':'')+(on?' tgt':'')+(pickable?' pick':''),onclick:pickable&&!B.busy?()=>{B.tgt=u.uid;battleView();}:null},
  h('div',{class:'row between small'},h('b',{},u.name),h('span',{class:'dim'},`Lv${u.lv}`,st?h('span',{class:'st'},st):null,u.wallLeft>0&&!v.dead?h('span',{class:'st'},`聖盾 ${u.wallLeft}`):null)),
  meter('hp',v.hp,u.maxHp,`${v.hp}/${u.maxHp}`),u.side==='ally'||B.kind==='bout'?meter('mp',v.mp,u.maxMp,`${v.mp}/${u.maxMp}`):null);
}
function battleView(){
 const B=S.battle;if(!B)return render();
 const box=h('div',{class:'log blog'},...B.lines.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
 app.replaceChildren(h('div',{class:'page bout'},stage(B),h('div',{class:'sides'},h('div',{},...R.foes(B.b).map(u=>unitCard(B,u))),h('div',{},...R.allies(B.b).map(u=>unitCard(B,u)))),commands(B),box));
}
const SELF_KINDS=['heal','selfheal','regen','cure','wall'];
function commands(B){
 const b=B.b,p=S.p,u=me(b),n=R.actionsOf(b,u);
 if(b.over&&!B.busy){
  const res={win:['勝利','win'],lose:['敗北','lose'],escaped:['逃走了','sys'],draw:['平手','sys']}[b.over];
  return h('div',{class:'cmds over'},h('p',{class:'result '+res[1]},res[0]),h('div',{class:'row'},
   B.kind==='hunt'&&b.over!=='lose'?h('button',{class:'main',onclick:()=>startHunt(B.spot)},'繼續練功'):null,
   h('button',{class:'ghost',onclick:()=>{S.battle=null;S.tab=B.kind==='hunt'?'hunt':'arena';render();}},B.kind==='hunt'?'回城':'回擂台')));
 }
 const toggles=h('div',{class:'row toggles'},
  h('button',{class:'chip'+(p.settings.auto?' on':''),onclick:()=>{p.settings.auto=!p.settings.auto;save();battleView();if(p.settings.auto&&!B.busy)autoRound();}},p.settings.auto?'自動中':'自動'),
  h('button',{class:'chip'+(p.settings.speed===3?' on':''),onclick:()=>{p.settings.speed=p.settings.speed===3?1:3;save();battleView();}},'三倍速'));
 if(B.busy||p.settings.auto||!u.alive)return h('div',{class:'cmds'},h('p',{class:'dim small'},B.busy?'交手中……':!u.alive?'你倒下了，夥伴還在打……':'自動戰鬥中（重複上一回合的指令）'),toggles);
 // 按一下就出完這回合（Leo 2026-10-26）：一回合兩動時，同一個指令出兩次；補血、聖盾、道具、魔力不夠第二次時，第二動改成攻擊
 const enemies=R.foes(b).filter(x=>x.alive),tgt=enemies.find(e=>e.uid===B.tgt)?.uid??enemies[0]?.uid;
 const go=c=>{const atk={kind:'attack',target:tgt},second=c.kind==='skill'?(SELF_KINDS.includes(SKILLS[c.skill].kind)||u.mp<SKILLS[c.skill].mp(u.skills.find(s=>s.id===c.skill).lv)*2?atk:c):c.kind==='item'||c.kind==='escape'?{kind:'defend'}:c;
  const list=[c,second].slice(0,n);B.menu='main';playRound(list.map(x=>({actor:'p',...x})));};
 const back=h('button',{class:'ghost',onclick:()=>{B.menu='main';battleView();}},'返回');
 let body;
 if(B.menu==='skill'){
  body=h('div',{class:'grid2'},...u.skills.map(s=>{const sk=SKILLS[s.id],mp=sk.mp(s.lv),self=SELF_KINDS.includes(sk.kind);
   return h('button',{disabled:u.mp<mp,onclick:()=>go({kind:'skill',skill:s.id,target:self?'p':tgt})},`${sk.name} Lv${s.lv}`,h('small',{},`耗魔 ${mp}`));}),back);
 }else if(B.menu==='item'){
  const list=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id].battle);
  body=h('div',{class:'grid2'},...list.map(x=>h('button',{onclick:()=>go({kind:'item',item:x.id,target:'p',useItem:id=>P.removeItem(p,id)})},`${ITEMS[x.id].name} ×${x.n}`,h('small',{},ITEMS[x.id].desc))),list.length?null:h('p',{class:'dim small'},'沒有戰鬥中能用的藥。'),back);
 }else{
  body=h('div',{class:'grid4'},
   h('button',{class:'hot',onclick:()=>go({kind:'attack',target:tgt})},'攻擊'),
   h('button',{disabled:!u.skills.length,onclick:()=>{B.menu='skill';battleView();}},'技能'),
   h('button',{onclick:()=>go({kind:'defend'})},'防禦'),
   h('button',{onclick:()=>{B.menu='item';battleView();}},'道具'),
   B.kind==='hunt'?h('button',{class:'ghost',onclick:()=>go({kind:'escape'})},'逃跑'):null);
 }
 return h('div',{class:'cmds'},h('p',{class:'small dim'},(n>1?'一回合兩動，按一下出兩次':'這回合的行動')+(enemies.length>1?'；點上面的敵人換目標':'')),body,toggles);
}
function autoRound(){
 const B=S.battle;if(!B||B.busy||B.b.over)return;
 if(!me(B.b).alive)return playRound([]); // 帶頭的倒了，夥伴自己打
 if(!S.p.settings.auto)return;
 const b=B.b,u=me(b),n=R.actionsOf(b,u),have=id=>P.countItem(S.p,id),cmds=[];
 for(let i=0;i<n;i++){const c=autoCommand(b,B.prev[i]||{kind:'attack',target:null},u,have,ITEMS,i===0);if(c.kind==='item')c.useItem=id=>P.removeItem(S.p,id);
  if(c.target&&c.kind!=='item'&&!SELF_KINDS.includes(SKILLS[c.skill]?.kind)&&!b.units.find(x=>x.uid===c.target)?.alive)c.target=null;cmds.push({actor:'p',...c});}
 playRound(cmds);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms/(S.p.settings.speed||1)));
async function playRound(cmds){
 const B=S.battle,b=B.b;B.busy=true;
 // 自動戰鬥照原作重複上一回合的指令（存起來，下次進戰鬥也沿用；逃跑不重複）
 if(cmds.length&&!cmds.some(c=>c.kind==='escape'))B.prev=S.p.lastMud=cmds.map(({actor,useItem,...c})=>c);
 battleView();
 const ev=R.resolveRound(b,cmds);if(B.kind==='bout')R.boutTimeout(b);
 for(const e of ev){
  const line=R.narrate(b,e),now=performance.now()/1000,v=id=>B.shown.get(id);
  if(e.t==='act'){v(e.a).act=e.kind==='skill'?'special':'attack';v(e.a).t0=now;if(e.mp!=null)v(e.a).mp=e.mp;}
  if(e.t==='hit'||e.t==='poison'){v(e.d).hp=e.hp;if(!v(e.d).dead){v(e.d).act='hit';v(e.d).t0=now;}}
  if(e.t==='heal'||e.t==='revive'){v(e.d).hp=e.hp;if(e.t==='revive')v(e.d).dead=false;}
  if(e.t==='mp')v(e.d).mp=e.mp;
  if(e.t==='miss'){v(e.d).act='dodge';v(e.d).t0=now;}
  if(e.t==='die'){v(e.d).dead=true;v(e.d).t0=now;}
  if(!line)continue;
  B.lines.push(line);if(B.lines.length>200)B.lines.splice(0,B.lines.length-200);
  if(S.battle===B)battleView();await wait(e.t==='round'?250:520);
 }
 for(const u of b.units){const v=B.shown.get(u.uid);v.hp=u.hp;v.mp=u.mp;v.dead=!u.alive;}
 if(b.round>=R.BOUT_ROUNDS&&B.kind==='bout'&&b.over)B.lines.push({c:'sys',t:`${R.BOUT_ROUNDS} 回合到了，比剩下的生命比例。`});
 if(b.over)endBattle(B);
 B.busy=false;if(S.battle===B)battleView();
 if(!b.over&&(S.p.settings.auto||!me(b).alive))setTimeout(autoRound,150/(S.p.settings.speed||1));
}
function endBattle(B){
 const b=B.b,p=S.p;
 if(B.kind==='hunt'){
  const r=R.finishHunt(p,b);
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:b.over==='win'?'打贏了！':b.over==='lose'?'你倒下了。':'離開了戰場。'});
  for(const t of r.lines){B.lines.push({c:'sys',t});say(t);}
  if(b.over==='lose')p.settings.auto=false;
 }else{
  R.finishBout(p,b);const r=B.rival;
  const res=b.over==='win'?`你贏了 ${r.name}！`:b.over==='lose'?`你輸給了 ${r.name}。`:`你和 ${r.name} 打成平手。`;
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:res});say('擂台：'+res,b.over==='win'?'win':'sys');
  if(!r.npc)recordBout(p.name,{vs:r.key,vsName:r.name,win:b.over==='win'?1:b.over==='lose'?0:-1,t:Date.now()});
 }
 save();
}

// ---------- 開始 ----------
export async function start(){
 const p=await loadHero();
 net().then(n=>{S.online=!!n;S.uid=n?.uid||null;if(!n)return;
  watchRivals(l=>{S.rivals=l;if(S.tab==='arena'&&!S.battle&&S.p)render();});
  watchMarket(async(list)=>{S.market=list;
   if(S.p){const got=await collectSales(S.p,list);for(const t of got)say(t,'win');}
   // 正在輸入價錢時不重畫，免得字被洗掉
   if(S.p&&!S.battle&&(S.tab==='market'||S.tab==='town')&&!['INPUT','SELECT'].includes(document.activeElement?.tagName))render();});
 });
 if(!p)return createView();
 S.p=p;say(`歡迎回來，${p.name}。`);render();
}
