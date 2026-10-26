// 文字版擂台的畫面：上面是名帖（狀態），選單跟在名帖下面（不固定在螢幕底部，Leo 2026-10-26），再下面是各頁內容。
// 角色是三國武將的立繪（generals.mjs），魔物用本作的動作圖。戰鬥：場景圖上畫雙方，指令在圖的正下方，戰況一行一行往下長。
// 規則全在 core/ 與 mud/rules.mjs；交易所、存檔在 mud/online.mjs。
import {h} from '../view/ui.mjs';
import {drawMotion,createMotionBank} from '../motion.mjs';
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import * as D from './dungeon.mjs';
import {derive,BP_KEYS,BP_NAMES,CREATE_BP,singleCapAt,expFor,ELEM_NAMES} from '../core/stats.mjs';
import {injuryOf} from '../core/injury.mjs';
import {autoCommand} from '../core/ai.mjs';
import {CG_CATS} from './gear.mjs';
import {drawFx,fxFromEvent,sfxOn} from './fx.mjs';
import {JOBS,rankName,titleOf} from '../data/jobs.mjs';
import {SKILLS,STATUS_NAMES,SKILL_EXP_PER_USE,weaponOk} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOT_NAMES,WEAPON_TYPE_NAMES,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {GENERALS,GENERAL_BY_ID,FACTIONS} from './generals.mjs';
import {GUIDE,BP_TABLE,jobFacts,TIPS} from './guide.mjs';
import {loadHero,saveHero,clearLocal,watchRivals,recordBout,boutsAgainstMe,net,watchMarket,postListing,cancelListing,buyListing,collectSales,LIST_MAX} from './online.mjs';

const app=document.getElementById('app');
const p0=()=>S.p;
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
   mate?h('section',{class:'card'},head('找一位隨行夥伴'),h('p',{class:'small dim'},'夥伴從 1 級開始，練功時由電腦代打。'),
    h('button',{class:'ghost',onclick:()=>{S.tab='tavern';render();}},'先不找')):null,
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
    if(mate){const r=R.addMate(S.p,opts);if(!r.ok){st.msg=r.msg;draw();return;}say(r.msg,'win');save();S.tab='tavern';render();return;}
    const r=R.newHero(opts);
    if(!r.ok){st.msg=r.msg;draw();return;}
    S.p=r.player;S.log=[];say(`${S.p.name}來到了法蘭城。`,'win');say('先到「公會」就職、「商店」買裝備，再去「冒險」練功。魔石拿去商店賣錢。');
    save();S.tab='town';render();}},mate?'就是他了':'踏入法蘭城')));
 };
 draw();
}

// ---------- 主畫面 ----------
function statusCard(){
 const p=S.p,s=P.stats(p),inj=injuryOf(p.inj||0);
 return h('header',{class:'status'},face(p.look,56,'big'),h('div',{class:'grow'},
  h('div',{class:'row between'},h('b',{class:'big-name'},p.name),h('span',{class:'badge'},`Lv${p.lv}　${jobOf(p)}`)),
  meter('hp',p.hp,s.maxHp,`生命 ${p.hp}/${s.maxHp}`),meter('mp',p.mp,s.maxMp,`魔力 ${p.mp}/${s.maxMp}`),
  h('div',{class:'row between small'},h('span',{class:'gold'},`${p.gold} 金`),inj?h('span',{class:'warn'},inj.name):null,p.freeBp?h('button',{class:'link ok',onclick:()=>{S.tab='status';render();}},`可配點 ${p.freeBp}`):null)));
}
// 選單：五大項；城裡的店家從「城中」進去，角色、冒險底下再分兩頁
const GROUPS=[['town','城中','城',['town','shop','hospital','guild','master','tavern','forge','market']],['char','角色','將',['status','bag']],['adv','冒險','戰',['hunt','dungeon']],['arena','擂台','擂',['arena']],['guide','攻略','略',['guide']]];
const PAGE_NAMES={town:'城中',status:'狀態',bag:'道具',shop:'商店',hospital:'醫院',guild:'公會',master:'技能大師',tavern:'酒館',forge:'工房',market:'交易所',hunt:'練功',dungeon:'地下城',arena:'擂台',guide:'攻略'};
const groupOf=tab=>GROUPS.find(g=>g[3].includes(tab))||GROUPS[0];
const go2=tab=>()=>{S.tab=tab;S.pickSlot=null;S.confirmWipe=false;S.pickLook=false;S.confirmDrop=false;render();scrollTo(0,0);};
// 角色頁最上面：點夥伴就換他操作（帶頭）
function partySwitch(){
 const p=S.p,m=p.mate,btn=(c,on)=>h('button',{class:'who'+(on?' on':''),onclick:on?null:()=>{const r=R.swapMate(p);say(r.msg,'win');S.openSkill=null;save();render();}},face(c.look,36),h('span',{},h('b',{},c.name),h('small',{},on?'操作中':`Lv${c.lv}・點我切換`)));
 return h('div',{class:'party'},btn(p,true),btn(m,false));
}
function subNav(){
 const g=groupOf(S.tab);
 if(g[0]==='char'&&S.p.mate)return h('div',{},partySwitch(),g[3].length>1?h('div',{class:'seg'},...g[3].map(t=>h('button',{class:S.tab===t?'on':'',onclick:go2(t)},PAGE_NAMES[t]))):null);
 if(g[0]==='town')return S.tab==='town'?null:h('div',{class:'crumb'},h('button',{class:'back',onclick:go2('town')},'‹ 城中'),h('b',{},PAGE_NAMES[S.tab]));
 return g[3].length>1?h('div',{class:'seg'},...g[3].map(t=>h('button',{class:S.tab===t?'on':'',onclick:go2(t)},PAGE_NAMES[t]))):null;
}
function render(){
 if(S.battle)return battleView();
 const body={town:townView,status:statusView,bag:bagView,shop:shopView,hospital:hospitalView,guild:guildView,tavern:tavernView,master:masterView,hunt:huntView,dungeon:dungeonView,forge:forgeView,arena:arenaView,market:marketView,guide:guideView}[S.tab]();
 app.replaceChildren(h('div',{class:'page'},statusCard(),
  h('nav',{class:'menu'},...GROUPS.map(([k,n,gl,tabs])=>h('button',{class:groupOf(S.tab)[0]===k?'on':'',onclick:go2(tabs[0])},h('i',{},gl),h('span',{},n)))),subNav(),body));
}
function logBox(){const box=h('div',{class:'log'},...S.log.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});return box;}
function townView(){
 const p=S.p,all=R.restCost(p,'all');
 const tiles=[['shop','商','商店','武器、防具、藥、收魔石'],['hospital','醫','醫院',all?`補滿 ${all} 金`:'生命魔力都是滿的'],['guild','會','公會',p.job==='none'?'先來就職':`${jobOf(p)}・晉級`],
  ['master','師','技能大師',`技能 ${p.skills.length}/10`],['tavern','酒','酒館',p.mate?`夥伴：${p.mate.name}`:'找隨行夥伴'],['forge','鍛','工房','材料打造裝備'],['market','易','交易所','跟玩家買賣']];
 return h('div',{},h('section',{class:'town-hero'},h('h2',{},'法蘭城'),h('p',{},PLACES.luoyang.desc)),
  h('section',{class:'card'},head('站位','近戰只打得到前排'),rowPicker(false,p.name),p.mate?rowPicker(true,p.mate.name):null),
  h('div',{class:'tiles'},...tiles.map(([k,gl,n,sub])=>h('button',{class:'tile',onclick:go2(k)},h('i',{},gl),h('b',{},n),h('small',{},sub)))),logBox());
}

// 酒館：找隨行夥伴、管理夥伴（◎ 地點自訂）。夥伴跟新角色一樣從 1 級、遊民、沒技能開始，自己練
function tavernView(){
 const p=S.p,ros=p.roster||[];
 const resetBtn=mate=>{const c=mate?p.mate:p,cost=R.resetBpCost(c),k=mate?'m':'p';
  return S.confirmReset===k?h('div',{class:'row'},h('span',{class:'grow small warn'},`花 ${cost} 金重置${c.name}的點數？`),h('button',{class:'danger',onclick:()=>{S.confirmReset=null;act(()=>R.resetBp(p,mate),'win')();}},'重置'),h('button',{onclick:()=>{S.confirmReset=null;render();}},'不要'))
   :h('button',{class:'wide',disabled:p.gold<cost,onclick:()=>{S.confirmReset=k;render();}},`重置${c.name}的點數　${cost} 金`);};
 return h('div',{},mateCard(),
  h('section',{class:'card'},head('住在酒館',`${ros.length}/${R.ROSTER_MAX}`),ros.length?null:h('p',{class:'small dim'},'還沒有人。新找的夥伴、留下來的夥伴會住在這裡。'),
   ...ros.map((c,i)=>h('div',{class:'row item'},face(c.look,44),h('div',{class:'grow'},h('b',{},c.name),h('div',{class:'small dim'},`Lv${c.lv}　${rankName(c.job,c.rank)}`)),
    S.confirmDismiss===i?h('button',{class:'danger',onclick:()=>{S.confirmDismiss=null;act(()=>R.dismissRoster(p,i),'sys')();}},'確定'):h('button',{class:'ghost',onclick:()=>{S.confirmDismiss=i;render();}},'離開'),
    h('button',{class:'hot',onclick:act(()=>R.takeFromRoster(p,i),'win')},p.mate?'換他出發':'帶他出發'))),
   p.mate&&ros.length>=R.ROSTER_MAX?null:h('button',{class:'wide',onclick:()=>createView(true)},'找新夥伴')),
  h('section',{class:'card'},head('重置點數','等級 × 100 金'),h('p',{class:'small dim'},'把配好的 BP 全部收回重配。'),resetBtn(false),p.mate?resetBtn(true):null),logBox());
}
function statusView(){
 const p=S.p,s=P.stats(p),cap=singleCapAt(p.lv),g=GENERAL_BY_ID[p.look];
 return h('div',{},
  h('section',{class:'card'},h('div',{class:'gen-pick'},h('img',{class:'stand',src:art(p.look),alt:g.name}),h('div',{class:'grow'},
   h('b',{class:'big-name'},p.name),h('div',{class:'small dim'},`${g.name}・${g.faction}　${jobOf(p)}`),
   h('table',{class:'kv small'},...[['等級',`${p.lv}　經驗 ${p.exp}/${expFor(p.lv+1)}`],['聲望',`${p.rep}・${titleOf(p.rep)}`],['屬性',h('span',{},...elemTags(p.elem),injuryOf(p.inj||0)?h('span',{class:'warn'},`　${injuryOf(p.inj).name}`):null)]].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v)))),
   h('button',{class:'chip',onclick:()=>{S.pickLook=!S.pickLook;render();}},S.pickLook?'收起':'換立繪'))),
   S.pickLook?h('div',{class:'gen-grid'},...GENERALS.map(x=>h('button',{class:'gen'+(p.look===x.id?' on':''),onclick:()=>{p.look=x.id;S.pickLook=false;save();render();}},face(x.id,44),h('span',{},x.name)))):null),
  h('section',{class:'card'},head('BP',p.freeBp?`可分配 ${p.freeBp} 點（單項最多 ${cap}）`:`單項最多 ${cap}`),
   h('div',{class:'bpgrid'},...BP_KEYS.map(k=>h('div',{class:'bpcell'},h('small',{},BP_NAMES[k]),h('b',{},Math.floor(p.bp[k]/100)),
    p.freeBp?h('button',{class:'step',disabled:p.bp[k]/100>=cap,onclick:()=>{const r=P.allocBp(p,k,1);if(r.ok)save();render();}},'＋'):null))),
   h('div',{class:'statline'},...[['生命',s.maxHp],['魔力',s.maxMp],['攻擊',s.atk],['防禦',s.def],['敏捷',s.agi],['精神',s.spr],['回復',s.rec]].map(([k,v])=>h('span',{},h('small',{},k),h('b',{},v))))),
  h('section',{class:'card'},h('div',{class:'head'},h('h2',{},'裝備'),h('button',{class:'chip',onclick:act(()=>R.equipBest(p),'sys')},'一鍵換最好的')),
   ...Object.entries(SLOT_NAMES).flatMap(([slot,n])=>{const id=p.equip[slot],ch=R.gearChoices(p,slot),open=S.pickSlot===slot;
   // 點一下這一格：列出背包裡穿得上的，直接換
   return [h('div',{class:'row item gearrow',onclick:()=>{S.pickSlot=open?null:slot;render();}},h('span',{class:'slot'},n),h('span',{class:'grow'},id?gearLine(id):h('span',{class:'dim'},'—')),
     ch.length?h('span',{class:'small ok'},`${ch.length} 件 ${open?'▲':'▼'}`):null,id?h('button',{class:'chip',onclick:e=>{e.stopPropagation();act(()=>P.unequip(p,slot),'sys')();}},'卸下'):null),
    open?h('div',{class:'gearpick'},ch.length?null:h('p',{class:'small dim'},'背包裡沒有穿得上的。'),...ch.map(x=>h('div',{class:'row'},h('span',{class:'grow small'},gearLine(x)),h('button',{class:'chip hot',onclick:()=>{S.pickSlot=null;act(()=>P.equip(p,x),'sys')();}},'換上')))):null];})),
  h('section',{class:'card'},head('站位',R.ROW_NAMES[R.rowOf(P.battleUnit(p),p.row)]),h('p',{class:'small dim'},'近戰只打得到前排；弓、魔法打得到後排。'),rowPicker(false)),
  h('section',{class:'card'},head('技能',`${p.skills.length}/10 格・點一下看效果`),p.skills.length?null:h('p',{class:'dim'},'還沒學技能，到城中的「技能大師」學。'),
   h('details',{class:'howto'},h('summary',{},'技能怎麼升級？'),h('ol',{class:'small'},
    h('li',{},'到「大師」花錢學會，一開始是 Lv1。'),
    h('li',{},`在練功或地下城用這招，打贏那一場才算數：每用一次得「${SKILL_EXP_PER_USE} × 敵人平均等級」熟練度（擂台不算）。打越強的魔物升越快。`),
    h('li',{},'熟練度滿了自動升一級，耗魔和效果一起變強。點下面的技能可以看下一級的效果和熟練度。'),
    h('li',{},'每個職業、職階練得到的等級有上限（本行技能最高，別行的低）；晉級之後上限會提高。'),
    h('li',{},'技能等級高了，戰鬥中仍然放最高級；想省魔可以用「練功用的技能」設定交給自動戰鬥。'))),
   ...p.skills.map(x=>skillRow(p,x))),
  h('section',{class:'card'},S.confirmWipe?h('div',{class:'row'},h('span',{class:'grow warn'},'角色會整個刪掉，確定嗎？'),h('button',{class:'danger',onclick:()=>{clearLocal();S.p=null;S.confirmWipe=false;createView();}},'刪掉'),h('button',{onclick:()=>{S.confirmWipe=false;render();}},'不要'))
   :h('button',{class:'ghost',onclick:()=>{S.confirmWipe=true;render();}},'重新建立角色')));
}
// 站位設定：mate＝設定夥伴的。withMate 會換掉 p.mate 這個物件，所以每次都重新拿
const charOf=mate=>mate?S.p.mate:S.p;
function rowPicker(mate,label){
 const u=mate?R.withMate(S.p,()=>P.battleUnit(S.p)):P.battleUnit(S.p),auto=R.rowOf(u,''),cur=charOf(mate).row||'';
 const seg=h('div',{class:'seg'},...Object.entries(R.ROW_NAMES).map(([k,n])=>h('button',{class:cur===k?'on':'',onclick:()=>{charOf(mate).row=k;save();render();}},k?n:`自動·${R.ROW_NAMES[auto].slice(0,1)}`)));
 return label?h('div',{class:'rowpick'},h('span',{class:'small dim'},label),seg):seg;
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
 if(!m)return h('section',{class:'card'},head('隨行夥伴','還沒有'),h('button',{class:'main',onclick:()=>createView(true)},'找夥伴'));
 const ms=R.withMate(p,()=>({s:P.stats(p),job:jobOf(p),hp:p.hp,mp:p.mp,inj:injuryOf(p.inj||0),free:p.freeBp}));
 return h('section',{class:'card'},head('隨行夥伴',GENERAL_BY_ID[m.look].name),
  h('div',{class:'row'},face(m.look,56),h('div',{class:'grow'},h('div',{class:'row between'},h('b',{},m.name),h('span',{class:'badge'},`Lv${m.lv}　${ms.job}`)),
   meter('hp',ms.hp,ms.s.maxHp,`生命 ${ms.hp}/${ms.s.maxHp}`),meter('mp',ms.mp,ms.s.maxMp,`魔力 ${ms.mp}/${ms.s.maxMp}`),
   rowPicker(true,'站位'),
   h('div',{class:'small dim'},[ms.inj?ms.inj.name:'',ms.free?`可配點 ${ms.free}`:'',m.skills.length?'技能：'+m.skills.map(x=>`${SKILLS[x.id].name}${x.lv}`).join('、'):'還沒學技能'].filter(Boolean).join('　')))),
  h('div',{class:'row'},h('button',{class:'grow',onclick:act(()=>R.stashMate(p),'sys')},'留在酒館'),
   S.confirmDrop?h('button',{class:'danger',onclick:()=>{const r=R.dropMate(p);say(r.msg);S.confirmDrop=false;save();render();}},'確定讓他走'):h('button',{class:'ghost',onclick:()=>{S.confirmDrop=true;render();}},'讓他離開')));
}
function gearLine(id){const it=ITEMS[id],bits=[];for(const [k,n] of [['atk','攻'],['def','防'],['agi','敏'],['spr','精'],['matk','魔攻'],['rec','回復'],['hp','命'],['mp','魔'],['crit','必殺'],['counter','反擊'],['hit','命中'],['dodge','閃躲'],...Object.entries(D.GEM_RES)])if(it[k])bits.push(n+(it[k]>0?'+':'')+it[k]);
 const kind=it.cg?CG_CATS[it.cg]:it.slot==='weapon'?WEAPON_TYPE_NAMES[it.type]:it.slot==='body'&&it.armor?ARMOR_NAMES[it.armor]:SLOT_NAMES[it.slot];
 return h('span',{},h('b',{class:KIND_CLASS[it.kind]},it.name),h('span',{class:'small dim'},`（${kind}・${it.lv}級）${bits.join(' ')}`));}
const itemName=(id,n=1)=>h('b',{class:KIND_CLASS[ITEMS[id].kind]},ITEMS[id].name+(n>1?` ×${n}`:''));

function bagView(){
 const p=S.p;
 return h('div',{},h('section',{class:'card'},head(`道具欄 ${p.bag.length}/${P.BAG_SIZE}`,'魔石拿去商店賣'),
  p.bag.length?null:h('p',{class:'dim'},'什麼都沒有。'),
  ...p.bag.map(x=>{const it=ITEMS[x.id],wear=it.slot&&P.canEquip(p,x.id);
   return h('div',{class:'row item'},h('div',{class:'grow'},it.slot?gearLine(x.id):itemName(x.id,x.n),h('div',{class:'small dim'},it.slot?(wear.ok?'':wear.msg):it.desc||'')),
    h('div',{class:'btns'},
     it.slot?h('button',{disabled:!wear.ok,onclick:act(()=>P.equip(p,x.id),'sys')},'裝備'):null,
     it.kind==='use'?h('button',{onclick:act(()=>P.useItemOutside(p,x.id))},'使用'):null));})),
  matsCard());
}
// 材料袋：材料、寶石、水龍素材都放這裡，不佔道具欄
const matList=p=>Object.entries(p.mats||{}).filter(([,n])=>n>0).sort((a,b)=>(ITEMS[a[0]].tier||0)-(ITEMS[b[0]].tier||0)||a[0].localeCompare(b[0]));
function matsCard(sell=false){
 const p=S.p,list=matList(p);
 return h('section',{class:'card'},head('材料袋',`${list.length} 種・不佔道具欄`),list.length?null:h('p',{class:'dim small'},'打魔物會掉礦石、木材、毛皮；地下城的王會掉寶石。'),
  h('div',{class:'mats big'},...list.map(([id,n])=>sell?h('button',{class:'mat',onclick:act(()=>D.sellMat(p,id),'sys')},`${ITEMS[id].name} ×${n}　賣 ${sellPrice(id)*n}`):h('span',{class:'mat',title:ITEMS[id].desc},`${ITEMS[id].name} ×${n}`))));
}
function shopView(){
 const p=S.p,list=R.shopStock(S.shop);
 return h('div',{},
  h('div',{class:'tabs'},...['weapon','armor','goods'].map(k=>h('button',{class:S.shop===k?'on':'',onclick:()=>{S.shop=k;render();}},SHOPS[k].name))),
  h('section',{class:'card'},head(SHOPS[S.shop].name,`身上 ${p.gold} 金`),...list.map(id=>{const it=ITEMS[id],wear=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row item'+(wear.ok?'':' faded')},h('div',{class:'grow'},it.slot?gearLine(id):itemName(id),h('div',{class:'small dim'},(it.slot?'':it.desc)+(wear.ok?'':'你穿不上'))),
    h('button',{class:'buy',disabled:p.gold<it.price,onclick:act(()=>R.buy(p,id),'sys')},`${it.price} 金`));})),
  h('section',{class:'card'},head('收購','材料留著打造，要賣再一個一個賣'),h('button',{class:'hot wide',onclick:act(()=>R.sellCrystals(p),'win')},'魔石全部賣掉'),
   ...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>h('div',{class:'row item'},h('span',{class:'grow'},itemName(x.id,x.n)),
    h('button',{onclick:act(()=>R.sell(p,x.id),'sys')},`賣 ${sellPrice(x.id)} 金`)))),
  S.shop==='goods'?matsCard(true):null);
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
  promoteCard());
}
// 晉級：照原作的等級、聲望、晉級費；晉級任務改成通關指定的地下城（◎）
function promoteCard(){
 const p=S.p;if(p.job==='none')return null;const c=D.promoteCheck(p);
 return h('section',{class:'card'},head('晉級',`現在：${jobOf(p)}`),!c.rows.length?h('p',{class:'dim small'},c.msg):h('div',{},
  
  ...c.rows.map(([t,ok,now])=>h('div',{class:'row between small'},h('span',{class:ok?'ok':''},(ok?'✓ ':'・')+t),h('span',{class:'dim'},now))),
  h('button',{class:'main',disabled:!c.ok,onclick:act(()=>D.promote(p),'win')},`晉級成${c.name}`)));
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
 return h('div',{},h('section',{class:'card'},head('練功',`一次遇到 1～${p.lv<=R.NEWBIE_LV?1:p.mate?R.MATE_GROUP_MAX:R.SOLO_GROUP_MAX} 隻`),  p.hp<s.maxHp*.3?h('p',{class:'warn'},'生命不到三成，先去醫院吧。'):null,
  autoSetup(),
  ...R.HUNT_SPOTS.map(id=>{const pl=PLACES[id],open=R.spotOpen(p,id);
   return h('div',{class:'spot'+(open.ok?'':' faded'),style:{'--bg':`url(./assets/scenes/${pl.scene}.webp)`}},h('div',{class:'grow'},h('b',{},pl.name),h('span',{class:'badge'},`Lv${pl.lv[0]}～${pl.lv[1]}`),h('div',{class:'small'},open.ok?pl.desc:open.msg)),
    h('button',{class:'hot',disabled:!open.ok||p.hp<=1,onclick:()=>startHunt(id)},'出發'));})));
}
// 練功的自動設定：自動戰鬥用哪一招、打完自動下一場（Leo 2026-10-26）
// 每個角色各自設定（o＝帶頭的 p 或夥伴 p.mate；夥伴沒設定就照電腦的判斷打）
function huntSkillPick(mate){
 const u=mate?R.withMate(S.p,()=>P.battleUnit(S.p)):P.battleUnit(S.p),o=charOf(mate),opts=[['',mate?'電腦自己判斷':'重複上一回合的指令'],['attack','普通攻擊'],...o.skills.filter(x=>weaponOk(u,x.id)&&!['field','gather','craft','passive'].includes(SKILLS[x.id].kind)).map(x=>[x.id,`${SKILLS[x.id].name} Lv${x.lv}（耗魔 ${SKILLS[x.id].mp(x.lv)}）`])];
 if(o.huntSkill&&!opts.some(([v])=>v===o.huntSkill))o.huntSkill='';
 return h('label',{class:'pick small'},h('span',{},o.name),h('select',{onchange:e=>{charOf(mate).huntSkill=e.target.value;save();}},...opts.map(([v,n])=>h('option',{value:v,selected:(o.huntSkill||'')===v},n))));
}
function autoSetup(){
 const p=S.p,st=p.settings;
 return h('div',{class:'autoset'},
  h('b',{class:'small'},'自動戰鬥用的招'),huntSkillPick(false),p.mate?huntSkillPick(true):null,
  h('label',{class:'row small check'},h('input',{type:'checkbox',checked:!!st.autoNext,onchange:e=>{st.autoNext=e.target.checked;if(st.autoNext)st.auto=true;save();}}),'自動下一場（生命不到三成、魔力不夠就停）'));
}
function dungeonView(){
 const p=S.p,cur=p.dg&&D.DUNGEON_BY_ID[p.dg.id],s=P.stats(p);
 return h('div',{},
  cur?h('section',{class:'card'},head(cur.name,`第 ${p.dg.floor}／${D.FLOORS} 層`),
   h('div',{class:'row'},h('button',{class:'hot',disabled:p.hp<=1,onclick:()=>startFloor()},'繼續往下'),h('button',{class:'ghost',onclick:()=>{D.leaveDungeon(p);save();render();}},'撤退'))):null,
  h('section',{class:'card'},head('地下城',`每座 ${D.FLOORS} 層，最深處有王`),
   h('p',{class:'small dim'},'王有自己的職業和招式，一回合兩動、生命比較多，必掉寶石。'),
   p.hp<s.maxHp*.5?h('p',{class:'warn'},'生命不到一半，先去醫院吧。'):null,
   ...D.DUNGEONS.map(d=>{const open=D.dungeonOpen(p,d),n=D.cleared(p,d);
    return h('div',{class:'row item'+(open.ok?'':' faded')},face(d.look,44),h('div',{class:'grow'},h('b',{},d.name),h('span',{class:'badge'},`王 Lv${d.lv}`),n?h('span',{class:'small ok'},`　通關 ${n} 次`):null,
     h('div',{class:'small'},...D.bossKits(d).map(([n,rk,sk])=>h('div',{},h('span',{class:'gold'},`${d.pair?n+' ':''}${rk}`),'　',sk.map(([k,l])=>`${k}${l}`).join('、')))),
     h('div',{class:'small dim'},open.ok?`魔物 Lv${d.monLv[0]}～${d.monLv[1]}`:open.msg)),
     h('button',{class:'hot',disabled:!open.ok||!!p.dg||p.hp<=1,onclick:()=>{const r=D.enterDungeon(p,d.id);if(r.ok){save();startFloor();}}},'進入'));})));
}
// 寶石合成：三顆同等級 → 隨機同等級；三顆同一種 → 升一級
function gemFuseView(kindTabs){
 const p=S.p,tray=(S.fuse||=[]).filter(id=>D.matCount(p,id)>0),own=D.gemsIn(p).sort((a,b)=>ITEMS[b].grade-ITEMS[a].grade||ITEMS[a].name.localeCompare(ITEMS[b].name));S.fuse=tray;
 const inTray=id=>tray.filter(x=>x===id).length,pv=D.fusePreview(tray);
 const canAdd=id=>tray.length<3&&inTray(id)<D.matCount(p,id)&&(!tray.length||ITEMS[tray[0]].grade===ITEMS[id].grade);
 return h('div',{},kindTabs,
  h('section',{class:'card'},head('寶石合成','三顆同等級'),
   h('div',{class:'fuse'},...[0,1,2].map(i=>tray[i]?h('button',{class:'slotgem on',onclick:()=>{tray.splice(i,1);render();}},h('b',{},ITEMS[tray[i]].name),h('small',{},'點一下拿掉')):h('span',{class:'slotgem'},'空'))),
   h('p',{class:'small '+(pv?'ok':'dim')},pv?(pv.up?`三顆一樣 → ${ITEMS[pv.out].name}`:`隨機一顆等級 ${pv.grade} 的寶石`):'放三顆同等級的寶石。三顆同一種會升一級，不同種會隨機變成同等級的一顆。'),
   h('button',{class:'main',disabled:!pv,onclick:()=>{const r=D.fuseGems(p,tray);S.fuse=[];say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},'合成')),
  h('section',{class:'card'},head('身上的寶石',`${own.length} 種`),own.length?null:h('p',{class:'small dim'},'地下城的王會掉寶石。'),
   ...own.map(id=>{const n=D.matCount(p,id),it=ITEMS[id],three=n>=3&&D.fusePreview([id,id,id])?.up;
    return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{class:'k-mat'},`${it.name} ×${n}`),h('div',{class:'small dim'},it.desc)),
     three?h('button',{class:'ghost',onclick:()=>{S.fuse=[id,id,id];render();}},'放三顆'):null,
     h('button',{disabled:!canAdd(id),onclick:()=>{tray.push(id);render();}},'放入'));})),logBox());
}
function forgeView(){
 const p=S.p,kind=S.forgeKind||'weapon',cats=Object.keys(CG_CATS).filter(c=>kind==='weapon'?['sword','axe','spear','bow','staff','dagger'].includes(c):kind==='armor'&&!['sword','axe','spear','bow','staff','dagger'].includes(c)),cat=cats.includes(S.forgeCat)?S.forgeCat:'';
 const list=Object.keys(D.RECIPES).filter(id=>D.recipeKind(id)===kind&&(!cat||ITEMS[id].cg===cat)).sort((a,b)=>ITEMS[a].lv-ITEMS[b].lv||(ITEMS[a].type||ITEMS[a].slot).localeCompare(ITEMS[b].type||ITEMS[b].slot));
 const kindTabs=h('div',{class:'tabs'},...[['weapon','兵器'],['armor','防具'],['dragon','水龍系列'],['gem','寶石合成']].map(([k,n])=>h('button',{class:kind===k?'on':'',onclick:()=>{S.forgeKind=k;S.forgeCat='';render();}},n)));
 if(kind==='gem')return gemFuseView(kindTabs);
 const mine=list.filter(id=>!S.forgeAll?P.canEquip(p,id).ok||kind==='dragon':true),gems=D.gemsIn(p);if(S.forgeGem&&!gems.includes(S.forgeGem))S.forgeGem='';
 return h('div',{},
  kindTabs,
  cats.length?h('div',{class:'tabs wrap small'},...[['','全部'],...cats.map(c=>[c,CG_CATS[c]])].map(([c,n])=>h('button',{class:cat===c?'on':'',onclick:()=>{S.forgeCat=c;render();}},n))):null,
  h('section',{class:'card'},head('工房',`身上 ${p.gold} 金`),kind==='dragon'?h('p',{class:'small dim'},'生鏽／破爛的裝備＋鋼騎之礦＋魔族的水晶＋幻之鋼條／朴／百里香。王宮職階才穿得上。'):null,
   gems.length?h('label',{class:'row small check'},'加寶石：',h('select',{onchange:e=>{S.forgeGem=e.target.value;render();}},h('option',{value:''},'不加'),...gems.map(g=>h('option',{value:g,selected:S.forgeGem===g},`${ITEMS[g].name} ×${p.mats[g]}`)))):null,
   S.forgeGem?h('p',{class:'small dim'},ITEMS[S.forgeGem].desc):null,
   h('label',{class:'row small check'},h('input',{type:'checkbox',checked:!!S.forgeAll,onchange:e=>{S.forgeAll=e.target.checked;render();}}),'也列出穿不上的'),
   ...mine.map(id=>{const rc=D.RECIPES[id];const c=D.canForge(p,id,S.forgeGem||null),wear=P.canEquip(p,id),out=S.forgeGem?D.withGem(id,S.forgeGem):id;
    return h('div',{class:'row item'+(c.ok?'':' faded-soft')},h('div',{class:'grow'},gearLine(out),
     h('div',{class:'mats'},...rc.mats.map(([m,n])=>{const have=D.matCount(p,m);return h('span',{class:'mat'+(have>=n?' ok':'')},`${ITEMS[m].name} ${have}/${n}`);}),h('span',{class:'mat'+(p.gold>=rc.fee?' ok':'')},`工錢 ${rc.fee}`)),
     wear.ok?null:h('div',{class:'small dim'},'你穿不上')),
     h('button',{class:'hot',disabled:!c.ok,onclick:act(()=>D.forge(p,id,S.forgeGem||null),'win')},'打造'));})),logBox());
}
function arenaView(){
 if(!S.against){S.against=[];boutsAgainstMe().then(l=>{S.against=l;if(S.tab==='arena'&&!S.battle)render();});}
 const row=r=>h('div',{class:'row item rival'},face(r.look,48),h('div',{class:'grow'},h('b',{},r.name),h('span',{class:'small'},`　Lv${r.lv} ${rankName(r.job,r.rank)}`),h('div',{class:'small dim'},r.npc?`${GENERAL_BY_ID[r.look]?.faction||''}・競技場常駐`:`${r.w} 勝 ${r.l} 敗`)),
  h('button',{class:'hot',onclick:()=>startBout(r)},'挑戰'));
 return h('div',{},
  h('section',{class:'card'},head('競技場',`${p0().w||0} 勝 ${p0().l||0} 敗`),h('p',{class:'small dim'},'一對一。雙方補滿再打，打完不扣血；30 回合沒分勝負比剩下的生命比例。')),
  h('section',{class:'card'},head('線上的冒險者',S.rivals.length?`${S.rivals.length} 人`:''),S.rivals.length?null:h('p',{class:'dim small'},S.online?'還沒有別人建立角色。':'這是離線版，只有常駐好手。'),...S.rivals.map(row)),
  h('section',{class:'card'},head('常駐名將'),...S.npcs.map(row)),
  S.against?.length?h('section',{class:'card'},head('有人來挑戰過你'),...S.against.map(r=>h('p',{class:'small'},`${r.byName} 挑戰你，${r.win===1?'他贏了':r.win===0?'你守住了':'平手'}　${new Date(r.t).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`))):null);
}
// ---------- 交易所 ----------
function marketView(){
 const p=S.p;
 if(!S.online)return h('section',{class:'card'},head('交易所'),h('p',{class:'dim'},'交易所要在發布的網頁（連線版）才開。這裡是離線版。'));
 const mine=S.market.filter(l=>l.seller===S.uid),others=S.market.filter(l=>l.seller!==S.uid&&!l.buyer);
 const sellable=[...p.bag.filter(x=>ITEMS[x.id].kind!=='key'),...matList(p).map(([id,n])=>({id,n}))];if(!sellable.some(x=>x.id===S.mkPick))S.mkPick=sellable[0]?.id||'';
 const run=fn=>async()=>{if(S.mkBusy)return;S.mkBusy=true;S.mkMsg='……';render();const r=await fn();S.mkBusy=false;S.mkMsg=r.msg||'';if(r.msg)say(r.msg,r.ok?'win':'sys');render();};
 const sel=h('select',{onchange:e=>{S.mkPick=e.target.value;}},...sellable.map(x=>h('option',{value:x.id,selected:x.id===S.mkPick},`${ITEMS[x.id].name}${x.n>1&&!ITEMS[x.id].slot?` ×${x.n}`:''}`)));
 const inp=h('input',{type:'number',inputmode:'numeric',min:1,placeholder:'價錢（金）',value:S.mkPrice||'',oninput:e=>{S.mkPrice=e.target.value;}});
 return h('div',{},
  h('section',{class:'card'},head('交易所',`身上 ${p.gold} 金`),h('p',{class:'small dim'},`賣掉的錢下次打開遊戲時收進來，最多掛 ${LIST_MAX} 張單。`),
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
function startFloor(){
 const p=S.p,d=D.DUNGEON_BY_ID[p.dg.id],b=D.startFloor(p,(Math.random()*2**31)>>>0),boss=p.dg.floor>=D.FLOORS;
 S.battle={b,kind:'dungeon',scene:d.lv<20?'cave':'courtyard',lines:[{c:'sys',t:boss?`${d.name}最深處：${D.bossLabel(d)}擋在前面！`:`${d.name}第 ${p.dg.floor} 層：遇到${R.foes(b).map(u=>`${u.name} Lv${u.lv}`).join('、')}！`}]};
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
  // 打擊感：頓格時時間停住；畫面震動（背景放大一點，震的時候不露邊）
  const real=now/1000,frozen=B.stopUntil&&real<B.stopUntil,sk=B.shake&&real-B.shake.t0<.28?B.shake:null;
  if(sk){const d=1-(real-sk.t0)/.28,m=sk.mag*d*d;ctx.translate((Math.random()-.5)*2*m,(Math.random()-.5)*2*m);}
  if(bg.complete&&bg.naturalWidth){const s=Math.max(W/bg.naturalWidth,H/bg.naturalHeight)*1.06;ctx.drawImage(bg,(W-bg.naturalWidth*s)/2,(H-bg.naturalHeight*s)*.6,bg.naturalWidth*s,bg.naturalHeight*s);}
  const sh=ctx.createLinearGradient(0,H*.55,0,H);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=sh;ctx.fillRect(0,0,W,H);
  const k=H/230,t=frozen?B.stopAt:real,fs=R.foes(B.b),pos=new Map();
  const put=(u,x,y,facing)=>{const v=B.shown.get(u.uid);if(!v)return;pos.set(u.uid,{x,y,h:GENERAL_BY_ID[u.art]?H*.6:(u.h||90)*k});const act=v.dead?'defeat':v.act,sec=act==='idle'?t:t-v.t0;
   if(act!=='idle'&&!v.dead&&sec>.8)v.act='idle';
   // 腳下的影子
   // 打擊感：出手的人往前衝一下，挨打的人被打退（我方在右邊，往左打）
   const dir=u.side==='ally'?-1:1;
   if((act==='attack'||act==='special')&&sec<.32&&!v.dead)x+=dir*Math.sin(sec/.32*Math.PI)*22*k;
   if(act==='hit'&&sec<.4&&!v.dead){const q=sec/.4;x-=dir*(q<.15?q/.15:1-(q-.15)/.85)*16*k;}
   ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(x,y,26*k,7*k,0,0,Math.PI*2);ctx.fill();
   ctx.save();if(v.dead)ctx.globalAlpha=.55;
   if(GENERAL_BY_ID[u.art]){
    // 武將立繪：原圖面向右，站在右邊（我方）的翻過來；出手換出招圖，挨打抖一下，倒下躺平
    const atk=(act==='attack'||act==='special')&&sec<.5,img=imgOf(art(u.art+(atk?'_atk':''))),s=(H*.74)/328;
    if(img.complete&&img.naturalWidth){const w=img.naturalWidth*s,hh=img.naturalHeight*s,mirror=facing==='front-left';
     let dx=act==='hit'&&sec<.3?Math.sin(sec*70)*3:0,dy=0;
     ctx.translate(x+dx,y+dy);if(mirror)ctx.scale(-1,1);
     // 倒下：變灰、往下沉一點（轉九十度會轉出畫面外）
     if(v.dead){ctx.filter='grayscale(1)';ctx.translate(0,hh*.08*Math.min(1,(t-v.t0)*3));}
     else if(act==='hit'&&sec<.12)ctx.filter='brightness(3) saturate(0)';else if(act==='hit'&&sec<.25)ctx.filter='brightness(1.6) sepia(1) hue-rotate(-30deg) saturate(3)';
     // 出招圖比站姿寬（往前伸的兵器），跟站姿的背後對齊，不然人會往後跳
     const idle=imgOf(art(u.art)),left=atk&&idle.naturalWidth?-idle.naturalWidth*s/2:-w/2;
     ctx.drawImage(img,left,-hh,w,hh);}
   }else{if(u.tint)ctx.filter=u.tint;if(act==='hit'&&sec<.12&&!v.dead)ctx.filter='brightness(3) saturate(0)';
    drawMotion(ctx,bank,u.art,act,Math.max(0,sec),{x,y,height:(u.h||90)*k,facing,weapon:null});}
   ctx.restore();};
  fs.forEach((u,i)=>put(u,W*(fs.length===1?.27:i===0?.32:.13),H-(i===0?12:36)*k,'front-right'));
  // 我方：後排的站右邊一點；兩人同一排時夥伴站在後面一點
  const mate=B.b.units.find(u=>u.uid==='m'),m0=me(B.b),back=u=>u.row==='back';
  if(!mate)put(m0,W*(back(m0)?.8:.72),H-16*k,'front-left');
  else if(back(m0)===back(mate)){put(mate,W*.85,H-38*k,'front-left');put(m0,W*.68,H-10*k,'front-left');}
  else{const [f,r]=back(m0)?[mate,m0]:[m0,mate];put(r,W*.86,H-36*k,'front-left');put(f,W*.66,H-10*k,'front-left');}
  drawFx(ctx,B,pos,t,S.p.settings.speed||1);
  // 必殺：整個畫面閃白一下
  if(B.flash&&real-B.flash<.15){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=.45*(1-(real-B.flash)/.15);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
 };
 loop.add(draw);
 return h('div',{class:'stage-wrap'},cv,h('span',{class:'round'},B.b.over?'結束':`第 ${B.b.round+1} 回合`));
}
function unitCard(B,u){
 const v=B.shown.get(u.uid),st=u.st&&!v.dead?STATUS_NAMES[u.st.k]:'';
 const pickable=u.side!=='ally'&&!v.dead&&R.foes(B.b).filter(x=>x.alive).length>1,on=pickable&&(B.tgt===u.uid||!R.foes(B.b).some(x=>x.alive&&x.uid===B.tgt)&&(R.foes(B.b).find(x=>x.alive&&x.row!=='back')||R.foes(B.b).find(x=>x.alive))===u);
 return h('div',{class:'unit'+(v.dead?' dead':'')+(u.side==='ally'?' mine':'')+(on?' tgt':'')+(pickable?' pick':''),onclick:pickable&&!B.busy?()=>{B.tgt=u.uid;battleView();}:null},
  h('div',{class:'row between small'},h('b',{},u.name),h('span',{class:'dim'},`Lv${u.lv}`,u.side==='enemy'&&u.row==='back'&&B.b.mods?.frontOnly?h('span',{class:'st'},'後排'):null,st?h('span',{class:'st'},st):null,u.wallLeft>0&&!v.dead?h('span',{class:'st'},`聖盾 ${u.wallLeft}`):null)),
  meter('hp',v.hp,u.maxHp,`${v.hp}/${u.maxHp}`),u.side==='ally'||B.kind==='bout'?meter('mp',v.mp,u.maxMp,`${v.mp}/${u.maxMp}`):null);
}
function battleView(){
 const B=S.battle;if(!B)return render();
 const box=h('div',{class:'log blog'},...B.lines.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
 app.replaceChildren(h('div',{class:'page bout'},stage(B),h('div',{class:'sides'},h('div',{},...R.foes(B.b).map(u=>unitCard(B,u))),h('div',{},...R.allies(B.b).map(u=>unitCard(B,u)))),commands(B),box));
}
const SELF_KINDS=['heal','selfheal','regen','cure','wall','stance','cover','honor','barrier'];
const isSelf=sk=>SELF_KINDS.includes(sk.kind)||sk.target==='ally'||sk.target==='self';
const NO_BATTLE=['passive','field','gather','craft'];
// 護衛的對象是夥伴；其他自己用的招對象是自己
const selfTarget=sk=>sk.kind==='cover'?'m':'p';
// 自動、三倍速、自動下一場（練功才有）
function togglesOf(B){
 const p=S.p,b=B.b;
 return h('div',{class:'row toggles'},
  b.over?null:h('button',{class:'chip'+(p.settings.auto?' on':''),onclick:()=>{p.settings.auto=!p.settings.auto;if(!p.settings.auto)p.settings.autoNext=false;save();battleView();if(p.settings.auto&&!B.busy)autoRound();}},p.settings.auto?'自動中':'自動'),
  b.over?null:h('button',{class:'chip'+(p.settings.speed===3?' on':''),onclick:()=>{p.settings.speed=p.settings.speed===3?1:3;save();battleView();}},'三倍速'),
  b.over?null:h('button',{class:'chip'+(p.settings.sfx!==false?' on':''),onclick:()=>{p.settings.sfx=p.settings.sfx===false;sfxOn.v=p.settings.sfx;save();battleView();}},'音效'),
  B.kind==='hunt'?h('button',{class:'chip'+(p.settings.autoNext?' on':''),onclick:()=>{const st=p.settings;st.autoNext=!st.autoNext;
   if(st.autoNext&&!st.auto){st.auto=true;if(!B.busy&&!b.over)setTimeout(autoRound,50);}save();battleView();if(b.over&&!B.busy)queueNext(B);}},'自動下一場'):null);
}
function commands(B){
 const b=B.b,p=S.p,u=me(b),n=R.actionsOf(b,u);
 if(b.over&&!B.busy){
  const res={win:['勝利','win'],lose:['敗北','lose'],escaped:['逃走了','sys'],draw:['平手','sys']}[b.over];
  return h('div',{class:'cmds over'},h('p',{class:'result '+res[1]},res[0]),h('div',{class:'row'},
   B.kind==='hunt'&&b.over!=='lose'?h('button',{class:'main',onclick:()=>startHunt(B.spot)},'繼續練功'):null,
   B.kind==='dungeon'&&p.dg?h('button',{class:'main',onclick:()=>startFloor()},p.dg.floor>=D.FLOORS?`前往最深處（${D.DUNGEON_BY_ID[p.dg.id].boss}）`:`前進第 ${p.dg.floor} 層`):null,
   B.kind==='dungeon'&&p.dg?h('button',{class:'ghost',onclick:()=>{D.leaveDungeon(p);save();S.battle=null;S.tab='dungeon';render();}},'撤退回城'):
   h('button',{class:'ghost',onclick:()=>{S.battle=null;S.tab={hunt:'hunt',dungeon:'dungeon'}[B.kind]||'arena';render();}},B.kind==='bout'?'回擂台':'回城')),
   B.stopMsg?h('p',{class:'small warn'},B.stopMsg):B.nextAt?h('p',{class:'small dim'},'馬上自動下一場……（關掉「自動下一場」就停）'):null,
   B.kind==='hunt'?togglesOf(B):null);
 }
 const toggles=togglesOf(B);
 if(B.busy||p.settings.auto||!u.alive)return h('div',{class:'cmds'},h('p',{class:'dim small'},B.busy?'交手中……':!u.alive?'你倒下了，夥伴還在打……':'自動戰鬥中（重複上一回合的指令）'),toggles);
 // 按一下就出完這回合（Leo 2026-10-26）：一回合兩動；技能一回合只能放一次，第二動改成攻擊；道具、逃跑的第二動改防禦
 const enemies=R.foes(b).filter(x=>x.alive),tgt=enemies.find(e=>e.uid===B.tgt)?.uid??(enemies.find(e=>e.row!=='back')||enemies[0])?.uid; // 沒選目標時先打前排
 const go=c=>{const atk={kind:'attack',target:tgt},second=c.kind==='skill'?atk:c.kind==='item'||c.kind==='escape'?{kind:'defend'}:c;
  const list=[c,second].slice(0,n);B.menu='main';playRound(list.map(x=>({actor:'p',...x})));};
 const back=h('button',{class:'ghost',onclick:()=>{B.menu='main';battleView();}},'返回');
 let body;
 if(B.menu==='skill'){
  const mateUp=b.units.some(x=>x.uid==='m'&&x.alive);
  body=h('div',{class:'grid2'},...u.skills.filter(s=>!NO_BATTLE.includes(SKILLS[s.id].kind)).map(s=>{const sk=SKILLS[s.id],mp=sk.mp(s.lv),self=isSelf(sk),wOk=weaponOk(u,s.id),noMate=(sk.kind==='cover'||sk.kind==='honor')&&!mateUp;
   return h('button',{disabled:u.mp<mp||!wOk||noMate,onclick:()=>go({kind:'skill',skill:s.id,target:self?selfTarget(sk):tgt})},`${sk.name} Lv${s.lv}`,h('small',{},!wOk?'武器不合':noMate?'要有夥伴':`耗魔 ${mp}`));}),back);
 }else if(B.menu==='item'){
  const list=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id].battle);
  body=h('div',{class:'grid2'},...list.map(x=>h('button',{onclick:()=>go({kind:'item',item:x.id,target:'p',useItem:id=>P.removeItem(p,id)})},`${ITEMS[x.id].name} ×${x.n}`,h('small',{},ITEMS[x.id].desc))),list.length?null:h('p',{class:'dim small'},'沒有戰鬥中能用的藥。'),back);
 }else{
  body=h('div',{class:'grid4'},
   h('button',{class:'hot',onclick:()=>go({kind:'attack',target:tgt})},'攻擊'),
   h('button',{disabled:!u.skills.length,onclick:()=>{B.menu='skill';battleView();}},'技能'),
   h('button',{onclick:()=>go({kind:'defend'})},'防禦'),
   h('button',{onclick:()=>{B.menu='item';battleView();}},'道具'),
   b.canEscape?h('button',{class:'ghost',onclick:()=>go({kind:'escape'})},'逃跑'):null);
 }
 return h('div',{class:'cmds'},h('p',{class:'small dim'},(n>1?'一回合兩動：技能只放一次，另一動普攻':'這回合的行動')+(enemies.length>1?'；點上面的敵人換目標':'')),body,toggles);
}
// 練功、地下城的自動戰鬥照「自動戰鬥用」的設定出招；技能一回合只放一次，第二動攻擊
function huntPlan(B,u,n){
 const id=S.p.huntSkill;if(!id||B.kind==='bout')return null;
 if(id==='attack')return [{kind:'attack',target:null},{kind:'attack',target:null}];
 const s=u.skills.find(x=>x.id===id);if(!s)return null;const sk=SKILLS[id],self=isSelf(sk),c={kind:'skill',skill:id,target:self?selfTarget(sk):null};
 return [c,{kind:'attack',target:null}];
}
// 夥伴照「自動戰鬥用的招」出手（練功、地下城；擂台沒有夥伴）。沒設定、魔力不夠、沒人要補時交給電腦判斷
function mateCmds(B){
 const b=B.b,m=b.units.find(u=>u.uid==='m'&&u.alive),id=S.p.mate?.huntSkill;if(!m||!id||B.kind==='bout')return [];
 const n=R.actionsOf(b,m);if(id==='attack')return Array.from({length:n},()=>({actor:'m',kind:'attack',target:null}));
 const s=m.skills.find(x=>x.id===id),sk=SKILLS[id];if(!s||!weaponOk(m,id)||m.mp<sk.mp(s.lv))return [];
 const mine=b.units.filter(x=>x.side==='ally'&&x.alive),hurt=mine.filter(x=>x.hp<x.maxHp*.5).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0];
 if(sk.kind==='heal'&&!hurt)return [];if(sk.kind==='wall'&&m.wallLeft>1)return [];
 const self=isSelf(sk),c={actor:'m',kind:'skill',skill:id,target:sk.kind==='heal'?hurt.uid:self?(sk.kind==='cover'?'p':'m'):null};
 return [c,...Array.from({length:n-1},()=>({actor:'m',kind:'attack',target:null}))];
}
// 自動下一場：打贏練功就接著打；生命不到三成、或魔力不夠放設定的那招就停
function queueNext(B){
 const p=S.p,st=p.settings;if(B.kind!=='hunt'||B.b.over!=='win'||!st.autoNext||B.nextAt)return;
 const s=P.stats(p),sk=p.huntSkill&&p.huntSkill!=='attack'&&p.skills.find(x=>x.id===p.huntSkill);
 if(p.hp<s.maxHp*.3){B.stopMsg='生命不到三成，自動下一場先停下。去醫院補一補吧。';return;}
 if(sk&&p.mp<SKILLS[sk.id].mp(sk.lv)){B.stopMsg=`魔力不夠放${SKILLS[sk.id].name}，自動下一場先停下。`;return;}
 B.nextAt=Date.now();setTimeout(()=>{if(S.battle===B&&st.autoNext)startHunt(B.spot);else{B.nextAt=0;if(S.battle===B)battleView();}},1200/(st.speed||1));
}
function autoRound(){
 const B=S.battle;if(!B||B.busy||B.b.over)return;
 if(!me(B.b).alive)return playRound([]); // 帶頭的倒了，夥伴自己打
 if(!S.p.settings.auto)return;
 const b=B.b,u=me(b),n=R.actionsOf(b,u),have=id=>P.countItem(S.p,id),cmds=[];
 const plan=huntPlan(B,u,n)||B.prev;
 for(let i=0;i<n;i++){const c=autoCommand(b,plan[i]||{kind:'attack',target:null},u,have,ITEMS,i===0);if(c.kind==='item')c.useItem=id=>P.removeItem(S.p,id);
  if(c.target&&c.kind!=='item'&&!(SKILLS[c.skill]&&isSelf(SKILLS[c.skill]))&&!b.units.find(x=>x.uid===c.target)?.alive)c.target=null;cmds.push({actor:'p',...c});}
 playRound(cmds);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms/(S.p.settings.speed||1)));
async function playRound(cmds){
 const B=S.battle,b=B.b;B.busy=true;
 // 自動戰鬥照原作重複上一回合的指令（存起來，下次進戰鬥也沿用；逃跑不重複）
 if(cmds.length&&!cmds.some(c=>c.kind==='escape'))B.prev=S.p.lastMud=cmds.map(({actor,useItem,...c})=>c);
 battleView();
 cmds=[...cmds,...mateCmds(B)];
 const ev=R.resolveRound(b,cmds);if(B.kind==='bout')R.boutTimeout(b);
 for(const e of ev){
  const line=R.narrate(b,e),now=performance.now()/1000,v=id=>B.shown.get(id);sfxOn.v=S.p.settings.sfx!==false;fxFromEvent(B,e);
  if(e.t==='act'){v(e.a).act=e.kind==='skill'?'special':'attack';v(e.a).t0=now;if(e.mp!=null)v(e.a).mp=e.mp;}
  if(e.t==='hit'||e.t==='poison'||e.t==='recoil'){v(e.d).hp=e.hp;if(!v(e.d).dead){v(e.d).act='hit';v(e.d).t0=now;}}
  // 物理打中的瞬間，出手的人剛好衝到最前面
  if(e.t==='hit'&&!e.elem&&e.a!==e.d&&v(e.a)&&!v(e.a).dead){v(e.a).act='attack';v(e.a).t0=now-.16;}
  if(e.t==='heal'||e.t==='revive'){v(e.d).hp=e.hp;if(e.t==='revive')v(e.d).dead=false;}
  if(e.t==='mp')v(e.d).mp=e.mp;
  if(e.t==='miss'){v(e.d).act='dodge';v(e.d).t0=now;}
  if(e.t==='die'){v(e.d).dead=true;v(e.d).t0=now;}
  if(!line)continue;
  B.lines.push(line);if(B.lines.length>200)B.lines.splice(0,B.lines.length-200);
  if(S.battle===B)battleView();await wait(e.t==='round'?250:e.t==='act'&&e.kind==='attack'?160:520);
 }
 for(const u of b.units){const v=B.shown.get(u.uid);v.hp=u.hp;v.mp=u.mp;v.dead=!u.alive;}
 if(b.round>=R.BOUT_ROUNDS&&B.kind==='bout'&&b.over)B.lines.push({c:'sys',t:`${R.BOUT_ROUNDS} 回合到了，比剩下的生命比例。`});
 if(b.over)endBattle(B);
 B.busy=false;if(S.battle===B)battleView();
 if(!b.over&&(S.p.settings.auto||!me(b).alive))setTimeout(autoRound,150/(S.p.settings.speed||1));
}
function endBattle(B){
 const b=B.b,p=S.p;
 if(B.kind==='hunt'||B.kind==='dungeon'){
  const r=D.finishFight(p,b);
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:b.over==='win'?'打贏了！':b.over==='lose'?'你倒下了。':'離開了戰場。'});
  for(const t of r.lines){B.lines.push({c:'sys',t});say(t);}
  if(b.over==='lose')p.settings.auto=false;
  queueNext(B);
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
