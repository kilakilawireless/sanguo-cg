// 洛陽城：曹操傳式選單，點設施找 NPC。就職、轉職、晉級、學技能、商店、醫館都在這裡。
import {h,mount,spriteCanvas,talk,toast,choose,modal,ask} from './ui.mjs';
import {G,go,save,hud,repTitle} from '../game.mjs';
import {openStatus,itemLine} from './status.mjs';
import * as P from '../core/player.mjs';
import {JOBS,COMBAT_JOBS,CHANGE_FEE,PROMOTE_FEE} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS,SHOPS,sellPrice} from '../data/items.mjs';

const MENTOR_ART={sword:'shuofeng',axe:'shaolinMonk',spear:'hfSpear',bow:'commonerM',mage:'changming',priest:'wudangTaoist'};
const FAC=[
 {id:'clinic',name:'醫館',who:'張機',art:'suxin',note:'治療、止痛藥'},
 {id:'guild',name:'職業公會',who:'受傷的士兵',art:'palaceGuard',note:'通行證、聲望'},
 ...COMBAT_JOBS.map(j=>({id:'job_'+j,job:j,name:JOBS[j].hall,who:JOBS[j].mentor,art:MENTOR_ART[j],note:`${JOBS[j].name}導師`})),
 {id:'weapon',name:'武器鋪',who:SHOPS.weapon.keeper,art:'commonerM',note:'劍斧槍弓杖'},
 {id:'armor',name:'衣甲鋪',who:SHOPS.armor.keeper,art:'commonerF',note:'鎧、衣、袍'},
 {id:'goods',name:'雜貨鋪',who:SHOPS.goods.keeper,art:'aheng',note:'藥品、收魔石'},
];

export function goal(p){
 if(p.job==='none'){
  if(Object.values(JOBS).some(j=>j.letter&&P.countItem(p,j.letter)))return '帶著推薦信去找那個職業的導師就職。';
  if(P.countItem(p,'trialPass'))return '先裝備想學的那種武器，再到試煉洞窟 6 樓找試煉官拿推薦信。想當道士的話，直接去道觀答題。';
  if(P.countItem(p,'painkiller'))return '把止痛藥交給職業公會裡受傷的士兵。';
  return '到醫館買止痛藥，交給職業公會裡受傷的士兵，換試煉洞窟的通行證。';
 }
 if(p.rank===0){
  if(p.flags.treant)return '晉級條件：20 級、聲望 10000、500 金以上，回導師那裡晉級。';
  if(p.lv>=20)return '去長老樹精之森打倒長老樹精，完成晉級任務。';
  return '到洛陽郊外、黃巾營寨歷練。20 級後挑戰長老樹精之森，晉級正職。';
 }
 return '恭喜晉級！後面的晉級任務之後開放。';
}

export function showTown(){
 const p=G.p;p.place='luoyang';save();
 const draw=()=>root.replaceChildren(
  hud(h('button',{onclick:()=>openStatus('stat',draw)},'狀態'),h('button',{class:'primary',onclick:()=>go.map()},'出城')),
  h('div',{class:'place-title'},h('h2',{},'洛陽'),h('span',{class:'muted small'},goal(p))),
  h('div',{class:'facilities scroll'},...FAC.map(f=>h('button',{class:'fac',onclick:()=>visit(f,draw)},spriteCanvas(f.art),h('span',{},h('b',{},f.name),h('small',{},`${f.who}・${f.note}`))))));
 const root=h('div',{class:'screen bg',style:{'--bg':'url(./assets/scenes/town.webp)'}});
 draw();mount(root);
}

const say=(f,t)=>talk([[f.who,f.art,t]]);
async function visit(f,redraw){
 const p=G.p,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 if(f.id==='clinic'){
  const c=P.restCost(p);
  const v=await choose(`${f.name}・${f.who}`,[
   {label:`治療（${c} 金）`,value:'rest',disabled:!c,note:'把生命、魔力補滿'},
   {label:`買止痛藥（${ITEMS.painkiller.price} 金）`,value:'pk',note:'就職要用'},
  ],{text:'「哪裡不舒服？」'});
  if(v==='rest')return done(P.rest(p));
  if(v==='pk'){if(p.gold<ITEMS.painkiller.price)return say(f,'「錢不夠喔。」');if(!P.addItem(p,'painkiller'))return say(f,'「你的道具欄滿了。」');p.gold-=ITEMS.painkiller.price;return done({msg:'「止痛藥給你。職業公會那邊有個受了傷的士兵，好像正需要。」'});}
  return;
 }
 if(f.id==='guild'){
  const v=await choose(`${f.name}`,[
   {label:'把止痛藥給受傷的士兵',value:'pk',note:'換試煉洞窟通行證'},
   {label:'問就職的事',value:'how'},
   {label:'查看聲望與稱號',value:'rep'},
   {label:'回到遊民',value:'quit',disabled:p.job==='none',note:'會失去所有技能'},
  ]);
  if(v==='pk')return done(P.givePainkiller(p));
  if(v==='how')return talk([[ '公會書記','commonerM','想就職的話，先拿到試煉洞窟的通行證。洞窟 6 樓的試煉官看你手上拿什麼武器，就替你寫哪個職業的推薦信。'],['公會書記','commonerM','劍去劍術館、斧去斧將營、槍去驍騎營、弓去射場、杖去水鏡莊。道士不用推薦信，去道觀答于吉的問題就行。'],['公會書記','commonerM',`已經有職業的人想換，就是轉職：要再拿一次推薦信、付 ${CHANGE_FEE} 金，聲望會歸零，從見習重新開始，超過新職業上限的技能會降級。`]]);
  if(v==='rep')return say({who:'公會書記',art:'commonerM'},p.job==='none'?'「遊民不會累積聲望。先就職吧。」':`「你的聲望是 ${p.rep}，稱號『${repTitle(p)}』。今天還能再累積 ${p.repPool} 點，每天最多 800，沒用完的可以存，最多存 4800。」`);
  if(v==='quit'&&await ask('回到遊民會失去所有技能。','回到遊民'))return done(P.quitJob(p));
  return;
 }
 if(f.job)return mentor(f,redraw);
 return shop(f,SHOPS[f.id],redraw);
}

async function mentor(f,redraw){
 const p=G.p,j=JOBS[f.job],mine=p.job===f.job,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 const teach=Object.entries(SKILLS).filter(([,s])=>s.teacher===f.job);
 const opts=[];
 if(!mine)opts.push({label:p.job==='none'?`就職成為${j.ranks[0]}`:`轉職為${j.ranks[0]}（${CHANGE_FEE} 金）`,value:'join',note:j.quiz?'要先答對問題':`要${ITEMS[j.letter].name}`});
 if(j.quiz&&!mine)opts.push({label:'回答于吉的問題',value:'quiz',disabled:!!p.flags.quizPassed});
 if(teach.length)opts.push({label:'學技能',value:'learn'});
 if(mine)opts.push({label:'晉級',value:'promote'});
 opts.push({label:'聊聊',value:'chat'});
 const v=await choose(`${j.hall}・${j.mentor}`,opts,{text:mine?`「${P.jobTitle(p)}，修行得怎麼樣？」`:`「這裡是${j.hall}，教的是${j.name}的本事。」`});
 if(v==='join'){
  const c=P.canTakeJob(p,f.job);if(!c.ok)return say(f,c.msg);
  if(p.job!=='none'&&!await ask(`轉職要 ${CHANGE_FEE} 金，聲望歸零、從見習重新開始，超過新上限的技能會降級。`,'轉職'))return;
  return done(P.takeJob(p,f.job));
 }
 if(v==='quiz'){
  const ans=[];
  for(const [q,choices] of P.QUIZ){const a=await choose('于吉的問題',choices.map((c,i)=>({label:c,value:i})),{text:q});if(a==null)return;ans.push(a);}
  return done(P.answerQuiz(p,ans));
 }
 if(v==='learn'){
  const id=await choose('學技能',teach.map(([id,s])=>{const have=P.skillOf(p,id),cap=P.capOf(p,id);
   return {label:`${s.name}　${s.price} 金`,value:id,disabled:!!have,note:have?'已學會':`${s.desc(1)}${p.job==='none'?'':`（你的上限 ${cap} 級）`}`};}),{text:`金錢 ${p.gold}。技能欄 ${p.skills.length}/10。`});
  if(id)return done(P.learnSkill(p,id));
  return;
 }
 if(v==='promote'){
  const c=P.promoteCheck(p);
  if(!c.rows.length)return say(f,c.msg);
  const go2=await choose('晉級',[{label:`晉級為${c.name}`,value:'ok',disabled:!c.ok}],{text:h('div',{},...c.rows.map(([n,ok,now])=>h('div',{class:ok?'green':'red'},`${ok?'✓':'✗'} ${n}（${now}）`)))});
  if(go2)return done(P.promote(p));
  return;
 }
 if(v==='chat')return say(f,CHAT[f.job]);
}
const CHAT={
 sword:'「劍是百兵之君。連擊、乾坤一擲、迅速果斷，都是劍客的看家本領。」',
 axe:'「拿斧頭的人最容易打出必殺！我潘鳳可是上將！」',
 spear:'「拿槍的人反擊最多。敵人越打你，你還手越多。」',
 bow:'「弓手站在後面放箭，近身的反擊打不到你。亂射能一口氣射好幾支。」',
 mage:'「術法看的是精神與魔攻。屬性相剋的話，傷害能差上三成。」',
 priest:'「補血魔法的回復量看對象的回復力。道士晉級看的是補血魔法的等級，不是人的等級。」',
};

async function shop(f,s,redraw){
 const p=G.p;
 const v=await choose(`${s.name}・${s.keeper}`,[{label:'買',value:'buy'},{label:'賣',value:'sell'}],{text:`「歡迎光臨。」金錢 ${p.gold}`});
 if(v==='buy'){
  modal(`${s.name}・買`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...s.stock.map(id=>{const it=ITEMS[id],ok=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row'},h('span',{class:'grow'},it.name,h('div',{class:'small muted'},itemLine(id),it.slot&&!ok.ok?`（${ok.msg}）`:'')),h('span',{class:'gold'},it.price),
    h('button',{disabled:p.gold<it.price,onclick:()=>{if(!P.addItem(p,id)){toast('道具欄滿了');return;}p.gold-=it.price;save();redraw();refresh();toast(`買了${it.name}`);}},'買'));})));
 }else if(v==='sell'){
  modal(`${s.name}・賣`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}`),...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>
   h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,x.n>1?` ×${x.n}`:''),h('span',{class:'gold'},sellPrice(x.id)),
    h('button',{onclick:()=>{P.removeItem(p,x.id);p.gold+=sellPrice(x.id);save();redraw();refresh();}},'賣'),
    x.n>1?h('button',{onclick:()=>{const n=x.n;P.removeItem(p,x.id,n);p.gold+=sellPrice(x.id)*n;save();redraw();refresh();}},'全賣'):null))));
 }
}
