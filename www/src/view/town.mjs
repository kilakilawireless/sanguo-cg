// 洛陽城：曹操傳式選單，點設施找 NPC。就職、轉職、晉級、學技能、商店、醫館都在這裡。
import {h,mount,spriteCanvas,talk,toast,choose,modal,ask} from './ui.mjs';
import {G,go,save,hud,repTitle} from '../game.mjs';
import {openStatus,itemLine} from './status.mjs';
import * as P from '../core/player.mjs';
import {JOBS,COMBAT_JOBS,GATHER_JOBS,CRAFT_JOBS,CHANGE_FEE,PROMOTE_FEE} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS,SHOPS,sellPrice} from '../data/items.mjs';
import {OFFICERS,OFFICER_ORDER,PARTY_MAX} from '../data/officers.mjs';
import {officerStats} from '../core/officer.mjs';
import {RECIPES} from '../data/recipes.mjs';
import {PET_SLOTS,PET_SKILL_SHOP,petSkills,petLearnLv} from '../core/pet.mjs';
import {PLACES} from '../data/places.mjs';
import {QUESTS,QUEST_ORDER} from '../data/quests.mjs';

const MENTOR_ART={lumber:'commonerM',miner:'shaolinMonk',hunter:'hfSpear',sword:'shuofeng',axe:'shaolinMonk',spear:'hfSpear',bow:'commonerM',mage:'changming',sorcerer:'yunzhonghe',priest:'wudangTaoist'};
const FAC=[
 {id:'clinic',name:'醫館',who:'張機',art:'suxin',note:'治療、止痛藥'},
 {id:'guild',name:'職業公會',who:'受傷的士兵',art:'palaceGuard',note:'通行證、聲望'},
 {id:'tavern',name:'酒館',who:'老闆娘',art:'commonerF',note:'招募武將'},
 {id:'board',name:'佈告欄',who:'居民的委託',art:'commonerM',note:'支線任務'},
 {id:'tamer',name:'馴獸棚',who:'馴獸師',art:'commonerF',note:'寵物學技能'},
 {id:'workshop',name:'百工坊',who:'馬鈞',art:'commonerM',note:'樵夫・礦工・獵人'},
 {id:'smithy',name:'工匠坊',who:'蒲元',art:'shaolinMonk',note:'打造兵器鎧甲、製藥、料理'},
 ...COMBAT_JOBS.map(j=>({id:'job_'+j,job:j,name:JOBS[j].hall,who:JOBS[j].mentor,art:MENTOR_ART[j],note:`${JOBS[j].name}導師`})),
 {id:'weapon',name:'武器鋪',who:SHOPS.weapon.keeper,art:'commonerM',note:'劍斧槍弓杖'},
 {id:'armor',name:'衣甲鋪',who:SHOPS.armor.keeper,art:'commonerF',note:'鎧、衣、袍'},
 {id:'goods',name:'雜貨鋪',who:SHOPS.goods.keeper,art:'aheng',note:'藥品、收購魔石材料'},
];
const F=id=>FAC.find(f=>f.id===id);
// 設施分三區，手機上比較好找
const GROUPS=[['life','城中'],['mentor','職業導師'],['shop','商店與工坊']];
const groupOf=f=>f.job?'mentor':['weapon','armor','goods','smithy','workshop'].includes(f.id)?'shop':'life';
// 長安：醫館、酒館、工匠坊、商店（◎ 照原作每個城鎮都有醫院和商店）
const TOWN_FAC={luoyang:FAC,changan:[{...F('clinic'),who:'吉平'},{...F('tavern'),who:'酒保'},F('board'),F('tamer'),F('smithy'),F('weapon'),F('armor'),F('goods')]};

export function goal(p){
 if(!p.party.length&&!Object.keys(p.officers).length)return '先到酒館找典韋，他願意免費跟你同行。之後還能招募華佗、太史慈、左慈，湊滿五人隊伍。';
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
 if(p.rank===1){
  if(p.flags.beast)return '晉級羽林條件：50 級、聲望 50000、5000 金以上，回導師那裡晉級。';
  if(!p.flags.hangu)return p.lv<24?'在樹精之森練到 24 級左右，再去攻打函谷關。關上的華雄擋住了往長安的路。':'去函谷關打倒華雄，打通往長安的路。';
  if(p.lv<45)return '到長安招募馬超、蔡文姬。驪山陵適合 32～42 級。45 級以後去神獸之谷挑戰白虎。';
  return '去神獸之谷打倒白虎，完成晉級任務「咆哮的神獸」。';
 }
 return '恭喜晉級羽林！後面的晉級任務之後開放。';
}

export function showTown(id){
 const p=G.p;if(!TOWN_FAC[id])id=TOWN_FAC[p.place]?p.place:'luoyang';p.place=id;save();const FAC=TOWN_FAC[id];
 const draw=()=>root.replaceChildren(
  hud(h('button',{class:p.settings.townList?'on':'',onclick:()=>{p.settings.townList=!p.settings.townList;save();draw();}},'清單'),h('button',{onclick:()=>openStatus('stat',draw)},'狀態'),h('button',{class:'primary',onclick:()=>go.map()},'出城')),
  h('div',{class:'place-title'},h('h2',{},PLACES[id].name),h('span',{class:'muted small'},goal(p))),
  p.settings.townList?h('div',{class:'facilities scroll'},...GROUPS.flatMap(([g,title])=>{const list=FAC.filter(f=>groupOf(f)===g);return list.length?[h('div',{class:'fac-group'},title),...list.map(f=>h('button',{class:'fac',onclick:()=>visit(f,draw)},spriteCanvas(f.art),h('span',{},h('b',{},f.name),h('small',{},`${f.who}・${f.note}`))))]:[];})):townScene(p,FAC,draw));
 const root=h('div',{class:p.settings.townList?'screen bg':'screen'});
 go.refresh=draw;draw();mount(root);
}

const say=(f,t)=>talk([[f.who,f.art,t]]);
async function visit(f,redraw){
 const p=G.p,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 if(f.id==='clinic'){
  const c=P.restCost(p),tc=P.treatAllCost(p);
  const v=await choose(`${f.name}・${f.who}`,[
   {label:`治療（${c} 金）`,value:'rest',disabled:!c,note:'把生命、魔力補滿'},
   {label:`治傷（${tc} 金）`,value:'treat',disabled:!tc,note:tc?'治好主角、武將、寵物的受傷':'沒有人受傷'},
   {label:`買止痛藥（${ITEMS.painkiller.price} 金）`,value:'pk',note:'就職要用'},
  ],{text:'「哪裡不舒服？」'});
  if(v==='rest')return done(P.rest(p));
  if(v==='treat')return done(P.treatAll(p));
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
  if(v==='how')return talk([[ '公會書記','commonerM','想就職的話，先拿到試煉洞窟的通行證。洞窟 6 樓的試煉官看你手上拿什麼武器，就替你寫哪個職業的推薦信。'],['公會書記','commonerM','劍去劍術館、斧去斧將營、槍去驍騎營、弓去射場、杖去水鏡莊或觀星臺。道士不用推薦信，去道觀答于吉的問題就行。'],['公會書記','commonerM',`已經有職業的人想換，就是轉職：要再拿一次推薦信、付 ${CHANGE_FEE} 金，聲望會歸零，從見習重新開始，超過新職業上限的技能會降級。`]]);
  if(v==='rep')return say({who:'公會書記',art:'commonerM'},p.job==='none'?'「遊民不會累積聲望。先就職吧。」':`「你的聲望是 ${p.rep}，稱號『${repTitle(p)}』。今天還能再累積 ${p.repPool} 點，每天最多 800，沒用完的可以存，最多存 4800。」`);
  if(v==='quit'&&await ask('回到遊民會失去所有技能。','回到遊民'))return done(P.quitJob(p));
  return;
 }
 if(f.id==='tavern')return tavern(f,redraw);
 if(f.id==='tamer')return tamer(f,redraw);
 if(f.id==='board')return board(redraw);
 if(f.id==='workshop'){
  const j=await choose('百工坊・馬鈞',GATHER_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${JOBS[id].main.map(s=>SKILLS[s].name).join('')}`})),{text:'「出城砍樹、挖礦、打獵，也能過日子。採到的材料拿去雜貨鋪賣，以後還能拿來做東西。遊民也能先學採集。」'});
  if(j)return mentor({id:'job_'+j,job:j,name:'百工坊',who:JOBS[j].mentor,art:MENTOR_ART[j]},redraw);
  return;
 }
 if(f.id==='smithy'){
  const mine=p.skills.filter(s=>SKILLS[s.id].kind==='craft');
  const j=await choose('工匠坊・蒲元',[{label:'製造',value:'craft',disabled:!mine.length,note:mine.length?mine.map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、'):'要先跟師傅學製造技能'},
   ...CRAFT_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${SKILLS[JOBS[id].main[0]].name}`}))],
   {text:'「材料拿來，我這裡的爐子、木台隨你用。商店買不到的 3、4 級好裝備，只有工匠做得出來；藥劑師做藥、廚師做菜也在這裡。不是本行的人也能學，但最多只能學到 2 級。」'});
  if(j==='craft')return workshopCraft(redraw);
  if(j)return mentor({id:'job_'+j,job:j,name:'工匠坊',who:JOBS[j].mentor,art:'commonerM'},redraw);
  return;
 }
 if(f.job)return mentor(f,redraw);
 return shop(f,SHOPS[f.id],redraw);
}

async function mentor(f,redraw){
 const p=G.p,j=JOBS[f.job],mine=p.job===f.job,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 const teach=Object.entries(SKILLS).filter(([,s])=>s.teacher===f.job);
 const opts=[];
 if(!mine)opts.push({label:p.job==='none'?`就職成為${j.ranks[0]}`:`轉職為${j.ranks[0]}（${CHANGE_FEE} 金）`,value:'join',note:j.gather?'不用推薦信':j.quiz?'要先答對問題':`要${ITEMS[j.letter].name}`});
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
   return {label:`${s.name}　${s.price} 金`,value:id,disabled:!!have,note:have?'已學會':`${s.desc(1)}${cap?`（你的上限 ${cap} 級）`:'（你學不了）'}`};}),{text:`金錢 ${p.gold}。技能欄 ${p.skills.length}/10。`});
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
 if(v==='chat')return say(f,CHAT[f.job]||(j.craft?`「${j.name}靠${SKILLS[j.main[0]].name}吃飯。技能等級越高，做得出越好的裝備；材料去野外採，或跟採集的人買。」`:'「好好修行。」'));
}
const CHAT={
 sword:'「劍是百兵之君。連環斬、破釜沉舟、兵貴神速，都是劍客的看家本領。」',
 axe:'「拿斧頭的人最容易打出必殺！我潘鳳可是上將！」',
 spear:'「拿槍的人反擊最多。敵人越打你，你還手越多。」',
 bow:'「弓手站在後面放箭，近身的反擊打不到你。萬箭齊發能一口氣射好幾支。」',
 mage:'「術法看的是精神與魔攻。屬性相剋的話，傷害能差上三成。」',
 lumber:'「伐木要在有樹的地方，洛陽郊外、黃巾營寨、樹精之森都行。伐木等級越高，砍得到越好的木材。」',
 miner:'「試煉洞窟裡有銅礦、鐵礦，運氣好還有銀礦。挖礦很耗力氣，魔力用光就挖不動了。」',
 hunter:'「洛陽郊外有獸肉、獸皮。樹精之森有鹿角、貂皮，不過那裡的怪物很兇。」',
 sorcerer:'「方術不傷人，卻能讓人睡、讓人亂、讓人忘。頭目心志堅定，比較難得手。中了石化或昏睡的隊友，要靠道士的清心術。」',
 priest:'「青囊術的回復量看對象的回復力。道士晉級看的是青囊術的等級，不是人的等級。」',
};

// 酒館：招募或請武將離隊（原作的組隊，單機版由武將補滿五人）
async function tavern(f,redraw){
 const p=G.p;
 const v=await choose('酒館・招募武將',OFFICER_ORDER.filter(id=>(OFFICERS[id].town||'luoyang')===p.place||p.party.includes(id)).map(id=>{const d=OFFICERS[id],o=p.officers[id],inParty=p.party.includes(id),c=P.canRecruit(p,id);
  return {label:`${d.name}　${JOBS[d.job].name}${o?` Lv${o.lv}`:''}　${inParty?'（隊伍中，點了離隊）':o?'（在酒館等你）':d.fee?`${d.fee} 金`:'免費'}`,value:id,note:inParty?'':c.ok?'':c.msg};}),
  {text:`隊伍 ${p.party.length+1}/${PARTY_MAX+1} 人。武將會自己判斷行動，經驗照各自的等級算。金錢 ${p.gold}`});
 if(!v)return;const d=OFFICERS[v];
 if(p.party.includes(v)){if(await ask(`請${d.name}離隊？他會留在酒館，等級不會掉。`,'離隊')){const r=P.dismiss(p,v);save();redraw();toast(r.msg);}return;}
 const r=P.canRecruit(p,v);if(!r.ok)return talk([[d.name,d.art,r.msg]]);
 if(!p.officers[v])await talk([[d.name,d.art,d.intro]]);
 const res=P.recruit(p,v);save();redraw();toast(res.msg);
}

async function shop(f,s,redraw){
 const p=G.p;
 const v=await choose(`${s.name}・${s.keeper}`,[{label:'買',value:'buy'},{label:'賣',value:'sell'}],{text:`「歡迎光臨。」金錢 ${p.gold}`});
 if(v==='buy'){
  modal(`${s.name}・買`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...[...s.stock].sort((a,b)=>(ITEMS[a].slot&&!P.canEquip(p,a).ok)-(ITEMS[b].slot&&!P.canEquip(p,b).ok)).map(id=>{const it=ITEMS[id],ok=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row',style:ok.ok?null:{opacity:.55}},h('span',{class:'grow'},it.name,h('div',{class:'small muted'},itemLine(id),it.slot&&!ok.ok?`（${ok.msg}）`:'')),h('span',{class:'gold'},it.price),
    h('button',{disabled:p.gold<it.price,onclick:()=>{if(!P.addItem(p,id)){toast('道具欄滿了');return;}p.gold-=it.price;save();redraw();refresh();toast(`買了${it.name}`);}},'買'));})));
 }else if(v==='sell'){
  modal(`${s.name}・賣`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}`),...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>
   h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,x.n>1?` ×${x.n}`:''),h('span',{class:'gold'},sellPrice(x.id)),
    h('button',{onclick:()=>{P.removeItem(p,x.id);p.gold+=sellPrice(x.id);save();redraw();refresh();}},'賣'),
    x.n>1?h('button',{onclick:()=>{const n=x.n;P.removeItem(p,x.id,n);p.gold+=sellPrice(x.id)*n;save();redraw();refresh();}},'全賣'):null))));
 }
}

// 製造：列出會的製造技能能做的裝備（到技能上限為止），材料不夠的反灰
function workshopCraft(redraw){
 const p=G.p;
 modal('製造',(refresh)=>{
  const mine=p.skills.filter(s=>SKILLS[s.id].kind==='craft');
  const rows=Object.entries(RECIPES).filter(([,r])=>mine.some(s=>s.id===r.skill)&&r.lv<=Math.max(P.capOf(p,r.skill),1)).sort((a,b)=>a[1].skill.localeCompare(b[1].skill)||a[1].lv-b[1].lv);
  return h('div',{class:'col'},h('div',{class:'gold'},`魔力 ${p.mp}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...rows.map(([id,r])=>{const c=P.canCraft(p,id);
   return h('div',{class:'row',style:c.ok?null:{opacity:.6}},h('span',{class:'grow'},`${ITEMS[id].name}（${r.lv} 級${SKILLS[r.skill].name}）`,
    h('div',{class:'small muted'},itemLine(id)),h('div',{class:'small'},...r.mats.map(([m,n])=>h('span',{class:P.countItem(p,m)>=n?'green':'red'},`${ITEMS[m].name} ${P.countItem(p,m)}/${n}　`)),`魔力 ${r.mp}`)),
    h('button',{disabled:!c.ok,onclick:()=>{const res=P.craft(p,id);save();redraw();refresh();toast(res.msg);}},'做'));}));
 });
}

// 馴獸棚：寵物花錢學技能、忘記學來的技能
async function tamer(f,redraw){
 const p=G.p;
 if(!p.pets.length)return say(f,'「你還沒有寵物。戰鬥中用「捕捉」抓一隻，帶來我教牠本事。」');
 const uid=await choose('馴獸棚・選寵物',p.pets.map(x=>({label:`${x.name} Lv${x.lv}`,value:x.uid,note:`技能 ${petSkills(x).length}/${PET_SLOTS}：${petSkills(x).map(s=>SKILLS[s.id].name).join('、')||'無'}`})),{text:`「學到的技能等級看寵物現在的等級，學了就不會再變。」金錢 ${p.gold}`});
 if(!uid)return;const x=p.pets.find(q=>q.uid===uid),have=petSkills(x);
 const v=await choose(`${x.name}・學技能（Lv${petLearnLv(x)}）`,[
  ...Object.entries(PET_SKILL_SHOP).map(([id,price])=>({label:`${SKILLS[id].name}　${price} 金`,value:'learn:'+id,disabled:have.some(s=>s.id===id)||have.length>=PET_SLOTS||p.gold<price,note:have.some(s=>s.id===id)?'已經會了':SKILLS[id].desc(petLearnLv(x))})),
  ...(x.learned||[]).map(s=>({label:`忘記${SKILLS[s.id].name}`,value:'forget:'+s.id,note:'空出技能欄'}))],{text:`技能欄 ${have.length}/${PET_SLOTS}。金錢 ${p.gold}`});
 if(!v)return;const [op,id]=v.split(':');
 const r=op==='learn'?P.petLearn(p,uid,id):P.petForget(p,uid,id);save();redraw();toast(r.msg);
}

// 佈告欄：這座城的支線任務
async function board(redraw){
 const p=G.p,list=QUEST_ORDER.filter(id=>QUESTS[id].town===p.place);
 const status=id=>{const q=QUESTS[id],s=P.questOf(p,id),n=P.questProgress(p,id);
  if(!s)return p.lv<q.minLv?`要 ${q.minLv} 級`:'可以接';if(s.state==='done')return '已完成';return n>=q.need.n?'可以回報！':`進行中 ${n}/${q.need.n}`;};
 const id=await choose('佈告欄',list.map(id=>({label:`${QUESTS[id].name}（${QUESTS[id].giver}）`,value:id,disabled:P.questOf(p,id)?.state==='done',note:status(id)})),{text:'城裡居民的委託。完成後回來找委託人領報酬。'});
 if(!id)return;const q=QUESTS[id],who={who:q.giver,art:q.art},s=P.questOf(p,id);
 if(!s){await say(who,q.text);const r=P.acceptQuest(p,id);save();redraw();return r.ok?toast(r.msg):say(who,`「${r.msg}」`);}
 const r=P.finishQuest(p,id);
 if(!r.ok)return say(who,`「還沒好嗎？${q.need.item?`${ITEMS[q.need.item].name}要 ${q.need.n} 個，你身上有 ${P.questProgress(p,id)} 個。`:`還差 ${q.need.n-P.questProgress(p,id)} 隻。`}」`);
 save();redraw();await say(who,q.done);toast(r.msg,3500);
}

// 城鎮場景（照原作）：場景圖上站著各個 NPC，點人就對話、開功能；手機直拿時可以左右滑。主角站在廣場中間。
// 座標是 NPC 腳底在場景圖上的位置（%）。「清單」按鈕可以切回設施清單。
const NPC_POS={clinic:[12,64],tavern:[21,45],board:[69,33],guild:[82,42],tamer:[91,84],workshop:[23,82],smithy:[46,46],weapon:[33,35],armor:[44,30],goods:[56,37],
 job_sword:[30,62],job_axe:[38,73],job_spear:[66,58],job_bow:[74,72],job_mage:[85,60],job_sorcerer:[50,88],job_priest:[64,90]};
function townScene(p,FAC,redraw){
 const scene=h('div',{class:'town-scene'},
  ...FAC.map(f=>{const [x,y]=NPC_POS[f.id]||[50,50];return h('button',{class:'npc',style:{left:x+'%',top:y+'%'},onclick:()=>visit(f,redraw),title:`${f.who}・${f.note}`},
   h('span',{class:'plate'},f.name),spriteCanvas(f.art,{w:70,h:96,height:84,facing:x<50?'front-right':'front-left'}));}),
  h('div',{class:'npc me',style:{left:'50%',top:'64%'}},h('span',{class:'plate'},p.name),spriteCanvas(p.look,{w:70,h:96,height:84,facing:'front-right'})));
 const wrap=h('div',{class:'town-stage'},scene);
 requestAnimationFrame(()=>{wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)/2;});
 return wrap;
}
