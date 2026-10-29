// 玩家角色：創角、能力、裝備、道具、升級配點、聲望、就職、轉職、晉級、學技能。全部是純規則，畫面只呼叫這些。
// 回傳 {ok:false,msg} 表示做不到，畫面直接把 msg 顯示給玩家。
import {derive,BP_KEYS,CREATE_BP,BP_PER_LEVEL,MAX_LEVEL,singleCapAt,expFor,validElement} from './stats.mjs';
import {applyInjury,addInjury,treatCost,TREAT_PER} from './injury.mjs';
import {JOBS,RANK_LEVEL,RANK_SKILL,RANK_REP,RANK_QUEST,PROMOTE_FEE,CHANGE_FEE,skillCap,gearCap,REP_START,rankName} from '../data/jobs.mjs';
import {SKILLS,SKILL_EXP,SKILL_SLOTS} from '../data/skills.mjs';
import {ITEMS,SLOTS} from '../data/items.mjs';
import {makeRng} from './rng.mjs';
import {RECIPES,CRAFT_EXP,CRAFT_MP} from '../data/recipes.mjs';
import {QUESTS} from '../data/quests.mjs';
import {OFFICERS,PARTY_MAX} from '../data/officers.mjs';
import {newOfficer,officerStats,officerUnit} from './officer.mjs';
import {newPet,petStats,petUnit,PET_MAX,PET_SLOTS,PET_SKILL_SHOP,petSkills,petLearnLv,petLearnPrice} from './pet.mjs';

export const BAG_SIZE=20; // 道具欄 20 格（原作）
export const START_GOLD=500; // ◎ 原作開局金額未查證
const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

export function createPlayer({name,look,bp,elem,seed=Date.now()}){
 name=String(name||'').trim();
 if(!name||name.length>8)return no('名字要 1～8 個字。');
 const total=BP_KEYS.reduce((n,k)=>n+(bp[k]||0),0);
 if(total!==CREATE_BP)return no(`點數要剛好分完 ${CREATE_BP} 點（現在 ${total}）。`);
 if(BP_KEYS.some(k=>(bp[k]||0)<0||(bp[k]||0)>singleCapAt(1)))return no(`單項最多 ${singleCapAt(1)} 點。`);
 if(!validElement(elem))return no('屬性要剛好 10 點，最多兩種，而且要相鄰（地水、水火、火風、風地）。');
 const rng=makeRng(seed);
 const p={v:1,name,look,lv:1,exp:0,freeBp:0,bp:Object.fromEntries(BP_KEYS.map(k=>[k,(bp[k]||0)*100])),elem:{...elem},
  luck:rng.int(1,5),// 運氣是隱藏數值，創角時隨機（◎ 範圍自訂）
  job:'none',rank:0,rep:REP_START,gold:START_GOLD,
  skills:[],bag:[],equip:{weapon:null,shield:null,head:null,body:null,feet:null},flags:{},place:'luoyang',quiz:null,officers:{},party:[],pets:[],petOut:null,petSeq:0,
  settings:{speed:1,auto:false},lastCmds:null,seed:rng.int(1,2**31)};
 const s=stats(p);p.hp=s.maxHp;p.mp=s.maxMp;
 return yes('',{player:p});
}

// 面板數值＝BP 換算＋裝備
export function stats(p){
 const s=derive(p.bp),o={maxHp:s.hp,maxMp:s.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0};
 for(const slot of SLOTS){const id=p.equip[slot];if(!id)continue;const it=ITEMS[id];
  for(const k of ['atk','def','agi','spr','rec','matk'])o[k]+=it[k]||0;if(it.hp)o.maxHp+=it.hp;if(it.mp)o.maxMp+=it.mp;}
 return o;
}
export const weaponOf=p=>p.equip.weapon?ITEMS[p.equip.weapon]:null;
export const jobTitle=p=>rankName(p.job,p.rank);

// 道具欄：消耗品與魔石可疊放，裝備一件占一格
const stacks=id=>['use','crystal','key','material'].includes(ITEMS[id].kind);
export const countItem=(p,id)=>p.bag.filter(x=>x.id===id).reduce((n,x)=>n+x.n,0);
export function addItem(p,id,n=1){
 if(stacks(id)){const s=p.bag.find(x=>x.id===id);if(s){s.n+=n;return true;}if(p.bag.length>=BAG_SIZE)return false;p.bag.push({id,n});return true;}
 for(let i=0;i<n;i++){if(p.bag.length>=BAG_SIZE)return false;p.bag.push({id,n:1});}return true;
}
export function removeItem(p,id,n=1){
 if(countItem(p,id)<n)return false;
 while(n>0){const i=p.bag.findIndex(x=>x.id===id),s=p.bag[i],k=Math.min(n,s.n);s.n-=k;n-=k;if(!s.n)p.bag.splice(i,1);}
 return true;
}

export function canEquip(p,id){
 const it=ITEMS[id];if(!it?.slot)return no('這不能裝備。');
 const cap=gearCap(p.job,p.rank,it);
 if(!cap)return no(`${JOBS[p.job].name}不能用這種裝備。`);
 if(it.lv>cap)return no(`${jobTitle(p)}只能用 ${cap} 級以下的裝備。`);
 return yes();
}
// 有耐久的（文字版 p.dur）：耐久跟著那件裝備走，在背包裡記在那一格的 dur
const takeDur=(p,id)=>p.dur?p.bag.find(x=>x.id===id)?.dur:undefined;
const putDur=(p,id,d)=>{if(!p.dur||d==null)return;const e=[...p.bag].reverse().find(x=>x.id===id&&x.dur==null);if(e)e.dur=d;};
export function equip(p,id){
 const r=canEquip(p,id);if(!r.ok)return r;const d=takeDur(p,id);if(!removeItem(p,id))return no('身上沒有。');
 const slot=ITEMS[id].slot,old=p.equip[slot],od=p.dur?.[slot];p.equip[slot]=id;if(p.dur){if(d==null)delete p.dur[slot];else p.dur[slot]=d;}
 if(old){addItem(p,old);putDur(p,old,od);}clampHpMp(p);return yes(`裝備了${ITEMS[id].name}。`);
}
export function unequip(p,slot){
 const id=p.equip[slot];if(!id)return no('');if(p.bag.length>=BAG_SIZE)return no('道具欄滿了。');
 const od=p.dur?.[slot];if(p.dur)delete p.dur[slot];p.equip[slot]=null;addItem(p,id);putDur(p,id,od);clampHpMp(p);return yes(`卸下了${ITEMS[id].name}。`);
}
// 轉職後不能用的裝備自動卸下
function dropIllegalGear(p){for(const slot of SLOTS){const id=p.equip[slot];if(id&&!canEquip(p,id).ok){p.equip[slot]=null;addItem(p,id);}}}
export function clampHpMp(p){const s=stats(p);p.hp=Math.min(p.hp,s.maxHp);p.mp=Math.min(p.mp,s.maxMp);}
export function useItemOutside(p,id){
 const it=ITEMS[id];if(it.kind!=='use')return no('這不能使用。');const s=stats(p);
 if(!(it.hp&&p.hp<s.maxHp||it.mp&&p.mp<s.maxMp))return no('不需要使用。');
 removeItem(p,id);if(it.hp)p.hp=Math.min(s.maxHp,p.hp+it.hp);if(it.mp)p.mp=Math.min(s.maxMp,p.mp+it.mp);return yes(`使用了${it.name}。`);
}

// 升級：每級 4 點，自己分配（照原作，不自動加）
export function gainExp(p,n){
 const ups=[];p.exp+=n;
 while(p.lv<MAX_LEVEL&&p.exp>=expFor(p.lv+1)){p.lv++;p.freeBp+=BP_PER_LEVEL;ups.push(p.lv);}
 return ups;
}
export function allocBp(p,key,n=1){
 if(p.freeBp<n)return no('沒有可分配的點數。');
 if(p.bp[key]/100+n>singleCapAt(p.lv))return no(`單項不能超過總點數的一半（${singleCapAt(p.lv)} 點）。`);
 const before=stats(p);p.bp[key]+=n*100;p.freeBp-=n;const after=stats(p);
 p.hp+=Math.max(0,after.maxHp-before.maxHp);p.mp+=Math.max(0,after.maxMp-before.maxMp);return yes();
}

// 聲望：單機版不設每日上限（Leo 決定；原作每天 800）。遊民不累積
export function gainRep(p,n){if(p.job==='none')return 0;p.rep+=n;return n;}

// 技能
export const skillOf=(p,id)=>p.skills.find(s=>s.id===id);
export const capOf=(p,id)=>skillCap(p.job,p.rank,id);
export function learnSkill(p,id){
 const sk=SKILLS[id];
 if(p.job==='none'&&!capOf(p,id))return no('遊民還不能學這個，先去就職吧。');
 if(skillOf(p,id))return no('已經學會了。');
 if(p.skills.length>=SKILL_SLOTS)return no(`技能欄只有 ${SKILL_SLOTS} 格。`);
 if(!capOf(p,id))return no(`${JOBS[p.job].name}學不了這招。`);
 if(p.gold<sk.price)return no(`錢不夠：要 ${sk.price} 金，還差 ${sk.price-p.gold} 金。`);
 p.gold-=sk.price;p.skills.push({id,lv:1,exp:0});return yes(`學會了${sk.name}。`);
}
export function forgetSkill(p,id){const i=p.skills.findIndex(s=>s.id===id);if(i<0)return no('');p.skills.splice(i,1);return yes(`忘記了${SKILLS[id].name}。`);}
// 技能經驗：到上限就不再增加
export function addSkillExp(p,id,n){
 const s=skillOf(p,id);if(!s)return null;const cap=capOf(p,id);
 if(s.lv>=cap)return null;s.exp+=n;let up=null;
 while(s.lv<Math.min(cap,10)&&s.exp>=SKILL_EXP[s.lv]){s.lv++;up=s.lv;}
 if(s.lv>=cap)s.exp=Math.min(s.exp,SKILL_EXP[s.lv-1]);
 return up;
}

// 就職流程（照原作的試煉洞窟）：醫院買止痛藥 → 交給職業公會換通行證 → 試煉洞窟 6 樓拿對應武器的推薦信 → 找導師就職
export function givePainkiller(p){
 if(countItem(p,'trialPass'))return no('你已經有通行證了。');
 if(!removeItem(p,'painkiller'))return no('「我的傷口痛得要命……要是有止痛藥就好了。醫院有賣。」');
 addItem(p,'trialPass');return yes('「謝謝！這張試煉洞窟的通行證就送你吧。」');
}
const LETTER_OF={sword:'letterSword',axe:'letterAxe',spear:'letterSpear',bow:'letterBow',staff:'letterStaff',dagger:'letterDagger'};
export function askLetter(p){
 // 空手來就給格鬥士的推薦信（原作格鬥士）
 const w=weaponOf(p),id=w?LETTER_OF[w.type]:'letterFist';if(countItem(p,id))return no('「推薦信已經給你了。」');
 if(!addItem(p,id))return no('道具欄滿了。');
 const body=p.equip.body&&ITEMS[p.equip.body];
 if(w&&['sword','axe','spear'].includes(w.type)&&body?.armor==='heavy'&&!countItem(p,'letterGuard')&&addItem(p,'letterGuard'))return yes(`「穿著重甲還拿得動${w.name}，當劍士、戰斧鬥士、騎士都行，要當士兵守住同伴也行。」得到${ITEMS[id].name}和${ITEMS.letterGuard.name}。`);
 return yes(`${w?`「你很適合用${w.name}。`:'「赤手空拳也敢走到這裡，好膽量。'}拿著這封信去找導師吧。」得到${ITEMS[id].name}。`);
}
// 傳教士不用推薦信，要答對教會神父的問題（◎ 題目自訂）
export const QUIZ=[
 ['傳教士用什麼替同伴回復生命？',['補血魔法','火焰魔法','昏睡魔法'],0],
 ['隊友氣絕了，要用哪個魔法救他？',['氣絕回復','乾坤一擲','亂射'],0],
 ['中了石化的隊友要靠哪個魔法？',['潔淨魔法','風刃魔法','遺忘魔法'],0],
];
export function answerQuiz(p,answers){
 if(answers.length!==QUIZ.length||answers.some((a,i)=>a!==QUIZ[i][2]))return no('「心不誠，下次再來。」');
 p.flags.quizPassed=true;return yes('「很好，你可以入我道門。」');
}
export function canTakeJob(p,jobId){
 const j=JOBS[jobId];
 if(p.job===jobId)return no('你已經是這個職業了。');
 if(j.gather||j.free){}
 else if(j.quiz){if(!p.flags.quizPassed)return no('「先回答我的問題。」');}
 else if(!countItem(p,j.letter))return no(`「拿${ITEMS[j.letter].name}來，我才收你。」`);
 if(p.job!=='none'&&p.gold<CHANGE_FEE)return no(`轉職要 ${CHANGE_FEE} 金。`);
 return yes();
}
// 遊民就職免費；從別的職業換過來就是轉職：付錢、聲望歸零、從見習重來、超過新上限的技能降級（照原作）
export function takeJob(p,jobId){
 const r=canTakeJob(p,jobId);if(!r.ok)return r;const j=JOBS[jobId],change=p.job!=='none';
 if(j.letter)removeItem(p,j.letter);else if(j.quiz)delete p.flags.quizPassed;
 if(change){p.gold-=CHANGE_FEE;p.rep=0;}
 p.job=jobId;p.rank=0;
 const down=[];for(const s of p.skills){const c=capOf(p,s.id);if(s.lv>c){s.lv=Math.max(1,c);s.exp=SKILL_EXP[s.lv-1];down.push(SKILLS[s.id].name);}}
 dropIllegalGear(p);
 return yes(`${change?'轉職':'就職'}成為${jobTitle(p)}！`+(down.length?`（${down.join('、')}降到新職業的上限）`:'')+(change?'聲望歸零。':''));
}
// 回到遊民：失去所有技能（照原作）
export function quitJob(p){if(p.job==='none')return no('');p.job='none';p.rank=0;p.skills=[];dropIllegalGear(p);return yes('你回到了遊民身份，所有技能都忘了。');}

// 晉級：等級（或專職技能等級）、聲望、晉級任務三項都要達到，再付錢
export function promoteCheck(p){
 const j=JOBS[p.job];if(p.job==='none')return {ok:false,rows:[],msg:'遊民不能晉級。'};
 const to=p.rank+1;if(to>4)return {ok:false,rows:[],msg:'已經是最高職階了。'};
 const rows=[];
 if(j.promoteBy==='level')rows.push([`等級 ${RANK_LEVEL[to]}`,p.lv>=RANK_LEVEL[to],`現在 ${p.lv}`]);
 else{const s=skillOf(p,j.promoteBy);rows.push([`${SKILLS[j.promoteBy].name} ${RANK_SKILL[to]} 級`,(s?.lv||0)>=RANK_SKILL[to],`現在 ${s?.lv||0}`]);}
 rows.push([`聲望 ${RANK_REP[to]}`,p.rep>=RANK_REP[to],`現在 ${p.rep}`]);
 const q=RANK_QUEST[to];if(!j.gather)rows.push([QUEST_NAMES[q],!!p.flags[q],p.flags[q]?'已完成':'未完成']);
 rows.push([`${PROMOTE_FEE[to]} 金`,p.gold>=PROMOTE_FEE[to],`現在 ${p.gold}`]);
 return {ok:rows.every(r=>r[1]),rows,to,name:rankName(p.job,to)};
}
export const QUEST_NAMES={treant:'晉級任務「樹精長老的末日」',beast:'晉級任務「咆哮的神獸」',curse:'晉級任務「詛咒的迷宮」',oath:'晉級任務「誓言之花」（之後開放）'};
export function promote(p){
 const c=promoteCheck(p);if(!c.ok)return no(c.msg||'條件還沒達到。');
 p.gold-=PROMOTE_FEE[c.to];p.rank=c.to;return yes(`晉級為${c.name}！技能和裝備的上限提高了。`);
}

// 醫院：照原作 1 點生命 0.5 金、1 點魔力 1 金（主角、隊上傭兵一起算；寵物照原作免費，Leo 2026-10-29）。what：hp 只補生命、mp 只補魔力、all 都補
const restees=p=>[[p,stats(p)],...partyOf(p).map(o=>[o,officerStats(o.id,o.lv)]),...(p.pets||[]).map(x=>[x,petStats(x),true])];
export const HP_PRICE=.5,MP_PRICE=1,CHARITY=.3;
// 資深護士（原作：只服務戰鬥系）：補魔順便把生命也補滿，一次收「魔力缺的×1＋（生命缺的−魔力缺的×2）×0.5」但最多 (等級−1)×15+137 金，剩下的免費（Leo 2026-10-27 要查的原作設定；2026-10-28 說補魔會順便補到血、不只法系）。
// 遊民、採集系沒有這個優惠，照 1 點 0.5／1 金算。普通護士（what＝hp）只補生命 0.5 金／點。
export const isCombat=o=>{const j=JOBS[o?.job];return !!j&&o.job!=='none'&&!j.gather;};
export const isCaster=o=>JOBS[o?.job]?.weapon==='staff';
export const nurseCap=o=>(Math.max(1,o.lv||1)-1)*15+137;
export const mpCap=nurseCap;
// 一個人這趟要付多少：what＝hp 只補生命；mp／all 走資深護士（戰鬥系生命一起補、封頂），其他人照點數
// 補魔順便補血（Leo 2026-10-29：補 200 魔會免費補 400 血，超過的才收補血的錢）：補 1 點魔力送 HP_FREE 點生命
export const HP_FREE=2;
const feeOf=(o,t,what,pet)=>{if(pet)return 0;const lh=Math.max(0,t.maxHp-o.hp),lm=Math.max(0,t.maxMp-o.mp),hp=lh*HP_PRICE,mp=lm*MP_PRICE;
 if(what==='hp')return hp;const both=mp+Math.max(0,lh-lm*HP_FREE)*HP_PRICE;if(isCombat(o))return Math.min(both,nurseCap(o));return what==='mp'?mp:both;};
export const mpFee=(o,missing)=>{const n=Math.max(0,missing)*MP_PRICE;return isCombat(o)?Math.min(n,nurseCap(o)):n;};
const costOf=(list,what)=>{let n=0;for(const [o,t,pet] of list)n+=feeOf(o,t,what,pet);return Math.ceil(n);};
// 有沒有人要補（寵物不用錢，錢是 0 也可能要補）
export const restNeed=(p,what='all')=>restees(p).some(([o,t])=>what!=='mp'&&o.hp<t.maxHp||what!=='hp'&&o.mp<t.maxMp);
const fill=(o,t,what)=>{if(what!=='mp'||isCombat(o))o.hp=t.maxHp;if(what!=='hp')o.mp=t.maxMp;};
export const restCost=(p,what='all')=>costOf(restees(p),what);
// 分開算：主角、隊上傭兵、寵物各要多少（醫院選單上顯示，寵物多的時候看得出錢花在哪）
export const restCostBy=(p,what='all')=>({me:costOf([[p,stats(p)]],what),officers:costOf(partyOf(p).map(o=>[o,officerStats(o.id,o.lv)]),what),pets:costOf((p.pets||[]).map(x=>[x,petStats(x),true]),what)});
export function rest(p,what='all'){const c=restCost(p,what);if(!restNeed(p,what))return no(what==='mp'?'大家的魔力都是滿的。':what==='hp'?'大家的生命都是滿的。':'大家都很健康。');
 // 錢不夠補滿：有多少補多少（付得起整個人的就整個補，不然先補生命，主角優先）；補完還不到三成生命的，護士免費補到三成（◎ 免得沒錢又受傷時出不了城）
 if(p.gold<c){let g=p.gold;
  for(const [o,t,pet] of restees(p)){const fee=Math.ceil(feeOf(o,t,what,pet));if(g>=fee){fill(o,t,what);g-=fee;}}
  for(const [k,price] of [['hp',HP_PRICE],['mp',MP_PRICE]])if(what===k||what==='all')for(const [o,t] of restees(p)){const n=Math.min(t['max'+(k==='hp'?'Hp':'Mp')]-o[k],Math.floor(g/price));o[k]+=n;g-=n*price;}
  const spent=p.gold-Math.floor(g);p.gold=Math.floor(g);
  let free=0;if(what!=='mp')for(const [o,t] of restees(p)){const n=Math.max(0,Math.ceil(t.maxHp*CHARITY)-o.hp);o.hp+=n;free+=n;}
  if(!spent&&!free)return no(`錢不夠：補滿要 ${c} 金。`);
  return yes(`錢不夠補滿（要 ${c} 金）${spent?`，用 ${spent} 金補了一部分`:''}${free?'。護士看你可憐，免費幫生命不到三成的人補到三成':''}。`);}
 p.gold-=c;
 for(const [o,t] of restees(p))fill(o,t,what);return yes(what==='hp'?'生命都補滿了。':'生命、魔力都補滿了。');}

// 傭兵：在酒吧招募、離隊。離隊的傭兵留在酒吧，等級不會掉。
export const partyOf=p=>(p.party||[]).map(id=>p.officers[id]);
export function canRecruit(p,id){
 const d=OFFICERS[id];if(p.party.includes(id))return no('已經在隊伍裡了。');
 if(p.party.length>=PARTY_MAX)return no(`隊伍最多 ${PARTY_MAX+1} 人。`);
 if(d.need==='job'&&p.job==='none')return no('「等你就職了再來找我吧。」');
 if(!p.officers[id]&&p.gold<d.fee)return no(`要 ${d.fee} 金。`);
 return yes();
}
export function recruit(p,id){
 const r=canRecruit(p,id);if(!r.ok)return r;const d=OFFICERS[id];
 if(!p.officers[id]){p.gold-=d.fee;p.officers[id]=newOfficer(id,Math.max(1,p.lv-1));}
 p.party.push(id);return yes(`${d.name}加入了隊伍。`);
}
export function dismiss(p,id){const i=p.party.indexOf(id);if(i<0)return no('');p.party.splice(i,1);return yes(`${OFFICERS[id].name}留在酒吧等你。`);}
// 站位：近身的站前排，其他站後排；主角在後排正中間
// 主角可以選站前排或後排（原作可調站位，預設後排），寵物站主角的另一排同位置
export function partyUnits(p){
 const pet=petOutOf(p),me=battleUnit(p),pool={front:[0,1,2,3,4],back:[0,1,2,3,4]},take=(row,s)=>pool[row]=pool[row].filter(x=>x!==s);
 take(me.row,0);const pu=pet?{...petUnit(pet),row:me.row==='back'?'front':'back',slot:0}:null;if(pu)take(pu.row,0);
 // 傭兵照原作的玩家隊友站法：跟主角同一排、排在兩側（主角在中間），寵物站另一排
 const os=partyOf(p).map(o=>{let row=me.row;if(!pool[row].length)row=row==='front'?'back':'front';const s=pool[row].shift();return {...officerUnit(o,s),row};});
 return [applyInjury(me,p.inj),...(pu?[applyInjury(pu,pet.inj)]:[]),...os.map(u=>applyInjury(u,p.officers[u.oid].inj))];
}
// 寵物
export const petOutOf=p=>(p.pets||[]).find(x=>x.uid===p.petOut)||null;
export function addPet(p,mon,lv,rng){if(p.pets.length>=PET_MAX)return null;const pet=newPet(mon,lv,rng,'pet'+(++p.petSeq));p.pets.push(pet);if(!p.petOut)p.petOut=pet.uid;return pet;}
export function setPetOut(p,uid){p.petOut=p.petOut===uid?null:uid;return yes(p.petOut?`${petOutOf(p).name}出戰。`:'寵物休息。');}
export function releasePet(p,uid){const i=p.pets.findIndex(x=>x.uid===uid);if(i<0)return no('');const [x]=p.pets.splice(i,1);if(p.petOut===uid)p.petOut=null;return yes(`放生了${x.name}。`);}
export const petRoom=p=>PET_MAX-(p.pets||[]).length;
export function petLearn(p,uid,id){
 const x=p.pets.find(q=>q.uid===uid);if(!x)return no('');const have=petSkills(x);
 if(have.some(s=>s.id===id))return no(`${x.name}已經會了。`);
 if(have.length>=PET_SLOTS)return no(`${x.name}的技能欄滿了（${PET_SLOTS} 格），先忘掉一個。`);
 if(!PET_SKILL_SHOP[id])return no('');const price=petLearnPrice(x,id);if(p.gold<price)return no(`錢不夠：要 ${price} 金，還差 ${price-p.gold} 金。`);
 p.gold-=price;(x.learned||=[]).push({id,lv:petLearnLv(x)});return yes(`${x.name}學會了${SKILLS[id].name} Lv${petLearnLv(x)}。`);
}
export function petForget(p,uid,id){const x=p.pets.find(q=>q.uid===uid),i=x?.learned?.findIndex(s=>s.id===id);if(i==null||i<0)return no('天生的技能忘不掉。');x.learned.splice(i,1);return yes(`${x.name}忘記了${SKILLS[id].name}。`);}
// 戰鬥結束把傭兵的生命魔力寫回去（氣絕的剩 1）
export function syncParty(p,units){for(const u of units){const o=u.kind==='officer'?p.officers[u.oid]:u.kind==='pet'?p.pets.find(x=>x.uid===u.pid):null;if(o){o.hp=Math.max(1,u.hp);o.mp=u.mp;}}}
// 戰後受傷：這場被打倒過的人（主角、傭兵、寵物）加受傷程度；回傳 [[名字, 受傷程度]]
export function injureParty(p,units,rand=Math.random){const out=[];for(const u of units){if(!u.downs)continue;const o=u.kind==='player'?p:u.kind==='officer'?p.officers[u.oid]:u.kind==='pet'?p.pets.find(x=>x.uid===u.pid):null;if(o)out.push([u.name,addInjury(o,u.downs,rand)]);}return out;}
// 醫院治傷：整隊（含在酒吧休息的傭兵、所有寵物）一起治
const injured=p=>[{o:p,lv:p.lv},...Object.values(p.officers||{}).map(o=>({o,lv:o.lv})),...(p.pets||[]).map(o=>({o,lv:o.lv}))].filter(x=>x.o.inj>0);
export const treatAllCost=p=>injured(p).reduce((n,x)=>n+treatCost(x.o.inj,x.lv),0);
// 錢不夠治好全部：重傷以上先免費治到中傷（◎，跟補血先免費補到三成一樣，免得沒錢、受傷、一直輸一路惡化），
// 再有多少錢治多少，傷最重的先治
export const TREAT_FREE=49;
export function treatAll(p){const c=treatAllCost(p);if(!c)return no('沒有人受傷。');
 if(p.gold<c){let free=0;for(const x of injured(p))if(x.o.inj>TREAT_FREE){free+=x.o.inj-TREAT_FREE;x.o.inj=TREAT_FREE;}
  let g=p.gold;for(const x of injured(p).sort((a,b)=>b.o.inj-a.o.inj)){const per=TREAT_PER(x.lv),n=Math.min(x.o.inj,Math.floor(g/per));x.o.inj-=n;g-=n*per;}
  const spent=p.gold-Math.floor(g),fr=free?'醫院先免費把重傷治到中傷，':'';if(!spent&&!free)return no(`錢不夠：治好全部要 ${c} 金。`);p.gold=Math.floor(g);return yes(`錢不夠治好全部（要 ${c} 金），${fr}${spent?`用 ${spent} 金先治了傷最重的。`:'剩下的要有錢再治。'}`);}
 p.gold-=c;for(const x of injured(p))x.o.inj=0;return yes('傷都治好了，可以照常出戰。');}

export const FIST_ATK=lv=>Math.round(12+1.6*lv);
// 戰鬥用的我方單位
export function battleUnit(p){
 const s=stats(p),w=weaponOf(p),fist=!w&&p.job==='fighter';
 // 格鬥士空手：攻擊加 12＋1.6×等級（◎，跟同時期買得到的兵器差不多），也吃兵器傷害加成
 if(fist)s.atk+=FIST_ATK(p.lv);
 return {uid:'p',kind:'player',name:p.name,art:p.look,h:92,lv:p.lv,race:'human',elem:p.elem,luck:p.luck,
  maxHp:s.maxHp,hp:p.hp,maxMp:s.maxMp,mp:p.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:s.matk,
  weaponType:w?.type||(fist?'fist':null),ranged:!!w?.ranged,skills:p.skills.filter(s=>!['gather','craft','field'].includes(SKILLS[s.id].kind)).map(s=>({id:s.id,lv:s.lv})),row:p.settings?.row||'back',slot:0,...gearMods(p)};
}
// 裝備上的必殺、反擊、命中、閃躲修正（文字版擂台的水龍系列、寶石才有）：必殺、反擊照點數加機率 %；命中 ÷1.8（Leo 2026-10-29「原作的命中補助這麼低嗎 那你改成/1.8」）、閃躲 ÷4 算成閃躲率的 %（◎）
function gearMods(p){const o={};for(const slot of SLOTS){const it=ITEMS[p.equip[slot]];if(!it)continue;
 for(const [k,m,d] of [['crit','critMod',1],['counter','counterMod',1],['hit','hitMod',1.8],['dodge','avoidMod',4]])if(it[k])o[m]=(o[m]||0)+it[k]/d;
 if(it.mres)o.mres=(o.mres||0)+it.mres;
 if(it.mpPct)for(const [k,v] of Object.entries(it.mpPct))(o.mpPct||={})[k]=(o.mpPct[k]||0)+v; // 抗魔（文字版的裝備才有，battle.mjs castMagic 減傷）
 // 寶石的抗異常（rsleep 等）：被下咒的成功率扣這麼多 %
 for(const st of ['poison','sleep','stone','confuse','drunk','forget'])if(it['r'+st])(o.res||={})[st]=(o.res?.[st]||0)+it['r'+st];}
 return o;}

// 醫療技能（戰鬥外）：ref 是 'p'、'o:傭兵id'、'pet:寵物uid'。◎ 每次得 150×技能等級 經驗，醫療系每次 5 聲望
export function careTargets(p){return [{ref:'p',name:p.name,o:p,max:stats(p).maxHp},...partyOf(p).map(o=>({ref:'o:'+o.id,name:OFFICERS[o.id].name,o,max:officerStats(o.id,o.lv).maxHp})),...(p.pets||[]).map(x=>({ref:'pet:'+x.uid,name:x.name,o:x,max:petStats(x).maxHp}))];}
export function useFieldSkill(p,id,ref){
 const s=skillOf(p,id),d=SKILLS[id];if(!s||d.kind!=='field')return no('');const t=careTargets(p).find(x=>x.ref===ref);if(!t)return no('');
 const cost=d.mp(s.lv);if(p.mp<cost)return no('魔力不夠。');
 let msg;
 if(id==='treat'){if(!(t.o.inj>0))return no(`${t.name}沒有受傷。`);const before=t.o.inj;t.o.inj=Math.max(0,before-d.cure(s.lv));msg=t.o.inj?`${t.name}的傷好了一些（${before}→${t.o.inj}）。`:`${t.name}的傷治好了。`;}
 else{const n=Math.min(d.heal(s.lv),t.max-t.o.hp);if(n<=0)return no(`${t.name}的生命是滿的。`);t.o.hp+=n;msg=`${t.name}回復了 ${n} 生命。`;}
 p.mp-=cost;const up=addSkillExp(p,id,150*s.lv);if(JOBS[p.job].gather)gainRep(p,5);
 return yes(msg+(up?`${d.name}升到 Lv${up}！`:''));
}
// 採集（原作伐木、挖掘、狩獵）：每次耗 1 魔力，成功就拿到這個地方有的、技能等級夠的材料。
// ◎ 成功率 60%＋每級 4%；技能經驗每次 100×材料階級；採集系每次成功得 5 聲望。
export function gather(p,table,skillId,rand=Math.random){
 const s=skillOf(p,skillId),sk=SKILLS[skillId];if(!s)return no('還沒學會這個技能。');
 const list=(table?.[skillId]||[]).filter(id=>ITEMS[id].tier<=s.lv);
 if(!list.length){const all=table?.[skillId]||[];return no(all.length?`${sk.name}要 ${Math.min(...all.map(id=>ITEMS[id].tier))} 級才採得到這裡的東西。`:`這裡沒有能${sk.name}的東西。`);}
 if(p.mp<sk.mp(s.lv))return no('魔力不夠，沒力氣了。');
 p.mp-=sk.mp(s.lv);
 if(rand()*100>=60+4*s.lv)return yes('什麼都沒採到。',{item:null});
 const id=list[Math.floor(rand()*list.length)];
 if(!addItem(p,id))return no('道具欄滿了。');
 const up=addSkillExp(p,skillId,100*ITEMS[id].tier);
 if(JOBS[p.job].gather)gainRep(p,5);
 return yes(`得到${ITEMS[id].name}。`+(up?`${sk.name}升到 ${up} 級！`:''),{item:id,up});
}

// 製造：材料夠、技能等級 ≥ 裝備等級、魔力夠就做得出來（照原作必定成功、耗魔照原作公式；◎ 經驗、聲望 20 自訂）
export const craftMp=(p,id)=>CRAFT_MP(RECIPES[id].lv,skillOf(p,RECIPES[id].skill)?.lv||1);
export function canCraft(p,id){
 const r=RECIPES[id],s=skillOf(p,r.skill);
 if(!s)return no(`要先學會${SKILLS[r.skill].name}。`);
 if(s.lv<r.lv)return no(`${SKILLS[r.skill].name}要 ${r.lv} 級。`);
 const lack=r.mats.filter(([m,n])=>countItem(p,m)<n);if(lack.length)return no(`材料不夠：${lack.map(([m,n])=>`${ITEMS[m].name}${countItem(p,m)}/${n}`).join('、')}。`);
 const mp=craftMp(p,id);if(p.mp<mp)return no(`魔力不夠（要 ${mp}）。`);
 return yes();
}
export function craft(p,id){
 const c=canCraft(p,id);if(!c.ok)return c;const r=RECIPES[id];
 const bagAfter=p.bag.length-r.mats.filter(([m,n])=>countItem(p,m)===n).length;if(!(stacks(id)&&countItem(p,id))&&bagAfter>=BAG_SIZE)return no('道具欄滿了。');
 const mp=craftMp(p,id);for(const [m,n] of r.mats)removeItem(p,m,n);p.mp-=mp;addItem(p,id);
 const up=addSkillExp(p,r.skill,CRAFT_EXP(r.lv));if(JOBS[p.job].craft)gainRep(p,20);
 return yes(`做出了${ITEMS[id].name}！`+(up?`${SKILLS[r.skill].name}升到 ${up} 級！`:''),{up});
}

// 支線任務：p.quests[id]={state:'active'|'done',kills}
export const questOf=(p,id)=>(p.quests||={})[id]||null;
export function questProgress(p,id){const q=QUESTS[id],s=questOf(p,id);return q.need.item?countItem(p,q.need.item):(s?.kills||0);}
export function acceptQuest(p,id){const q=QUESTS[id];if(questOf(p,id))return no('');if(p.lv<q.minLv)return no(`要 ${q.minLv} 級才能接。`);p.quests[id]={state:'active',kills:0};return yes(`接下了「${q.name}」。`);}
export function questKills(p,mons){const got=[];for(const [id,q] of Object.entries(QUESTS)){const s=questOf(p,id);if(s?.state!=='active'||!q.need.kill)continue;const before=s.kills;s.kills=Math.min(q.need.n,s.kills+mons.filter(m=>m===q.need.kill).length);if(s.kills>=q.need.n&&before<q.need.n)got.push(q.name);}return got;}
export function finishQuest(p,id){
 const q=QUESTS[id],s=questOf(p,id);if(s?.state!=='active')return no('');
 if(questProgress(p,id)<q.need.n)return no('還沒完成。');
 const r=q.reward;if(r.item&&p.bag.length>=BAG_SIZE&&!countItem(p,r.item[0]))return no('道具欄滿了。');
 if(q.need.item)removeItem(p,q.need.item,q.need.n);
 s.state='done';p.gold+=r.gold||0;const ups=gainExp(p,r.exp||0);if(r.item)addItem(p,r.item[0],r.item[1]);
 return yes(`任務完成！得到 ${r.gold} 金、經驗 ${r.exp}`+(r.item?`、${ITEMS[r.item[0]].name}×${r.item[1]}`:'')+(ups.length?`。升到 ${p.lv} 級！`:'。'));
}
