// 文字版擂台（MUD）的規則：角色、BP、職業、技能、裝備、戰鬥公式全部用本作的 core/ 與 data/，這裡只把它們接成文字遊戲。
// 不碰畫面。跟單機版不同的地方都標 ◎：
//  ◎ 就職不走試煉洞窟，到公會直接就職（轉職一樣付 1000 金、聲望歸零）；晉級之後再開放
//  ◎ 不帶寵物、傭兵，人物照原作一回合行動兩次；練功一群最多 2 隻。可以帶一位隨行夥伴（另一位武將，電腦代打），一群最多 4 隻
//  ◎ 技能找各職業的技能大師學（公會只管就職）
//  ◎ 擂台比武雙方都先補滿生命魔力、打完不扣、不會受傷；30 回合沒分出勝負，比剩下的生命比例
import * as P from '../core/player.mjs';
import {petUnit,petStats,petGainExp,PET_MAX,PET_SLOTS,gradeSum,petLearnLv,captureRate} from '../core/pet.mjs';
import {MONSTERS} from '../data/monsters.mjs';
import {createBattle,resolveRound,rewards,allies,foes,actionsOf} from '../core/battle.mjs';
import {expFrom} from '../core/combat.mjs';
import {applyInjury} from '../core/injury.mjs';
import {makeRng} from '../core/rng.mjs';
import {BP_KEYS,singleCapAt,totalBpAt,expFor,ELEM_NAMES,BP_MULT,validElement} from '../core/stats.mjs';
BP_MULT.tgh=1.3; // 文字版強度的效果 ×1.3（Leo 2026-10-27）
import {JOBS,gearCap} from '../data/jobs.mjs';
import {SKILLS,SKILL_EXP,SKILL_EXP_PER_USE} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOTS,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {GENERAL_BY_ID} from './generals.mjs';

const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

// 能就職的職業：戰鬥系裡不靠寵物、隊友的（封印師、馴獸師要寵物，之後再開）
export const MUD_JOBS=['sword','axe','spear','bow','fighter','guard','assassin','mage','wizard','priest']; // 咒術師併進傳教士（Leo 2026-10-26）
// 只對隊友、寵物有用的技能，一個人出戰學了沒用就不列
const SOLO_USELESS=new Set(['gather','craft','field','capture','rally','revive']); // 護衛有夥伴才用得到，照樣教

export function newHero(opts){const r=P.createPlayer(opts);if(!r.ok)return r;r.player.w=0;r.player.l=0;r.player.mud=1;return r;}

export function joinJob(p,id){
 if(!MUD_JOBS.includes(id))return no('');const j=JOBS[id];
 // ◎ 推薦信、神父的問題都省掉：公會直接收人
 const gave=j.letter&&!P.countItem(p,j.letter)&&P.addItem(p,j.letter);if(j.quiz)p.flags.quizPassed=true;
 const r=P.takeJob(p,id);
 if(!r.ok){if(gave)P.removeItem(p,j.letter);if(j.quiz)delete p.flags.quizPassed;}
 return r;
}
// 文字版改過的技能（Leo 2026-10-26，◎）：等級越高期望傷害越高。諸刃攻擊加成＝原作 ×1.3、聖盾放一次撐 3 回合；
// skill 裡是覆蓋原作數字的函式（battle.mjs 看 b.mods.skill[技能]）：
//  連擊：總傷害每次隨機 100%～(100+16×L)%（Lv10 介於 100%～260%，平均 180%），平分到每一下
//  乾坤一擲：110% 起每級 +13.3%，Lv10 230%；迅速果斷：攻擊 200% 起每級 +15%，Lv10 335%（要賠下一回合）
//  一擊必中：110% 起每級 +10%，Lv10 200%（加必殺、出手慢）；亂射：每箭 42% 起每級 +2%，Lv10 60%
export const bladeUp=L=>Math.round(SKILLS.blade.atkUp(L)*MODS.bladeMult);
// 中毒（Leo 2026-10-26）：每回合扣最大生命 (6+等級)%，會毒死人；頭目減半
// 文字版的戰鬥：套 MODS；斧、槍的必殺、反擊已經寫在武器上（gear.mjs），不再用「運氣 ×4」（weaponLuck＝1）
export function mudBattle(b){b.mods=MODS;for(const u of b.units)u.weaponLuck=1;return b;}
export const MODS={catchRivals:true,bladeMult:1.3,wall:{rate:.85,noCounter:true,turns:L=>Math.min(4,2+Math.floor(L/3))},wallMagic:true,mres:true,coverTurns:3,frontOnly:true,oneSkill:true,magicMult:1.6,poison:{pct:L=>.06+.01*L,lethal:true},skill:{
 // 連擊（Leo 2026-10-26）：每一下固定普攻的 50%、幾乎不浮動，靠多打幾下拉到期望值：基本 2 下，另有 m 次機會各 p% 多打一下；平均 100+8L%
 combo:{per:.5,spread:.06,extra:L=>{const m=Math.ceil(.32*L);return [m,16*L/m];}},
 allin:{mult:L=>1.1+1.2*(L-1)/9},
 swift:{atkMult:L=>2+.15*(L-1)},
 sure:{mult:L=>1.1+.1*(L-1)},
 volley:{arrowMult:L=>.4+.02*L},
}};
const M=MODS.skill,pc=x=>Math.round(x*100);
const poisonTxt=(L,area)=>`讓${area}中毒：每回合結束扣最大生命的 ${pc(MODS.poison.pct(L))}%，會毒死人（頭目減半）。成功率約 ${50+5*L}%，持續 ${3+Math.floor(L/3)} 回合。`;
const MOD_DESC={
 poison1:L=>poisonTxt(L,'敵人'),poison2:L=>poisonTxt(L,'目標和他前後左右'),poison3:L=>poisonTxt(L,'敵人全體'),
 venom:L=>`攻擊並讓對方中毒：每回合結束扣最大生命的 ${pc(MODS.poison.pct(L))}%，會毒死人（頭目減半）。成功率約 ${50+5*L}%，持續 ${3+Math.floor(L/3)} 回合。`,
 combo:L=>{const [m,p]=M.combo.extra(L);return `每一下是普攻的 50%（傷害幾乎不浮動），打 2～${2+m} 下：基本 2 下，另外 ${m} 次各有 ${Math.round(p)}% 機率多打一下。平均普攻的 ${100+8*L}%、最高 ${100+50*m}%。奇數級隨機對象，偶數級同一對象。`;},
 allin:L=>`傷害 ${pc(M.allin.mult(L))}%，命中 −${SKILLS.allin.hitPenalty(L)}%。`,
 swift:L=>`攻擊 ${pc(M.swift.atkMult(L))}%、出手速度 ${pc(SKILLS.swift.speedMult(L))}%，下一回合不能行動。不能用小刀、弓。`,
 sure:L=>`傷害 ${pc(M.sure.mult(L))}%、必殺率 +30%，出手變慢（速度 70%）。只能用弓。`,
 volley:L=>`隨機射出 ${L+2} 箭，每箭為普攻的 ${pc(M.volley.arrowMult(L))}%；同一個人連中越多箭傷害越低（每多一箭 ×0.75）。只能用弓。`,
 blade:L=>`攻擊 +${bladeUp(L)}%，自己的防禦與精神 −${SKILLS.blade.selfDown(L)}% 到下回合。`,
 cover:L=>`放一次撐 ${MODS.coverTurns} 回合（含這回合）：替一名隊友擋下所有近身物理攻擊，自己受到的傷害 −${SKILLS.cover.cut(L)}%。自己倒下或中異常狀態就斷掉。`,
 wall:L=>`放一次撐 ${MODS.wall.turns(L)} 回合（含這回合）：受到的物理和魔法傷害只剩 ${Math.round(SKILLS.wall.rate(L)*MODS.wall.rate*100)}%。撐著的時候照樣可以攻擊，可以再搭反擊、護衛、騎士之譽。`};
// 畫面上不放資料來源的註記（◎、照原作），只留技能和機制（Leo 2026-10-26）
export const plainText=t=>String(t).replace(/（◎ ?照原作[^）]*）/g,'').replace(/◎ ?/g,'').replace(/照原作[，、：]?/g,'').replace(/（\s*）/g,'');
export const skillDesc=(id,L)=>plainText((MOD_DESC[id]||SKILLS[id].desc)(L));
export const learnable=p=>Object.keys(SKILLS).filter(id=>!SOLO_USELESS.has(SKILLS[id].kind)&&P.capOf(p,id)>0);
// 技能大師 ◎（Leo 2026-10-26：技能不在公會學）：照原作各職業的導師教自己那一行的招，別的職業能學的也照樣教（等級上限照你的職業）
// 咒術師的技能改在傳教士那邊學
const teachOf=id=>SKILLS[id].teacher==='sorcerer'?'priest':SKILLS[id].teacher;
export const MASTERS=MUD_JOBS.map(job=>({job,who:JOBS[job].mentor,hall:JOBS[job].hall,skills:Object.keys(SKILLS).filter(id=>teachOf(id)===job&&!SOLO_USELESS.has(SKILLS[id].kind))})).filter(m=>m.skills.length);
// 技能熟練度：戰鬥裡用一次得「每次 × 敵人平均等級」，打贏才算（擂台不算）；累積到門檻升一級，上限看職業和職階
export const skillProgress=(p,s)=>{const cap=P.capOf(p,s.id);return {cap,need:s.lv<Math.min(cap,10)?SKILL_EXP[s.lv]:null,exp:s.exp,perUse:SKILL_EXP_PER_USE};};

// 商店：照職業與職階擋掉不能用的裝備（還是可以買，只是穿不上）
// 裝備要打造（Leo 2026-10-26）：武器店、防具店只賣新手的國民裝備
export const shopStock=k=>SHOPS[k].stock.filter(id=>ITEMS[id]&&(!ITEMS[id].slot||ITEMS[id].cheap));
export function buy(p,id){
 const it=ITEMS[id];if(p.gold<it.price)return no(`錢不夠：要 ${it.price} 金。`);
 if(!P.addItem(p,id))return no('道具欄滿了（20 格）。');p.gold-=it.price;return yes(`買了${it.name}。`);
}
export function sell(p,id){if(['key','material'].includes(ITEMS[id].kind))return no('這個不能賣。'); // 材料不能跟商店買賣（Leo 2026-10-26）
if(!P.removeItem(p,id))return no('');const g=sellPrice(id);p.gold+=g;return yes(`賣掉${ITEMS[id].name}，得到 ${g} 金。`);}
// 魔石一次賣掉；材料要留著打造，一個一個賣
export function sellCrystals(p){let g=0,n=0;for(const x of [...p.bag])if(ITEMS[x.id].kind==='crystal'){g+=sellPrice(x.id)*x.n;n+=x.n;P.removeItem(p,x.id,x.n);}
 if(!n)return no('身上沒有魔石。');p.gold+=g;return yes(`賣掉 ${n} 個魔石，得到 ${g} 金。`);}
export const canWear=(p,id)=>P.canEquip(p,id).ok;

// ---------- 練功 ----------
// 一群最多幾隻，照出門的人數（自己＋夥伴＋借來的）：1 人 2 隻（◎ 試算：3 隻時一個人打芙蕾雅每三場輸一場）、2 人 4、3 人 5、4 人 6、5 人 7
export const GROUP_MAX=[2,4,5,6,7];
export const SOLO_GROUP_MAX=GROUP_MAX[0];
export const groupMax=(heroLv,withMate)=>heroLv<=NEWBIE_LV?1:GROUP_MAX[Math.min(GROUP_MAX.length-1,+withMate||0)];
export const NEWBIE_LV=3; // ◎ Leo 2026-10-26：一開局太難。3 級以前一次只遇 1 隻，怪最多比你高 1 級
// 練功點：12～17 級補一個樹精之森外圍 ◎、後面的洞窟也能練功（Leo 2026-10-27：13 級就練不動）；文字版只看等級、要不要就職
const SPOT_FIX={
 woods:{name:'樹精之森外圍',kind:'field',scene:'forest',needJob:true,needLv:12,lv:[12,17],groups:[2,4],mons:[['sapling',4],['redWolf',3],['bee',2]],desc:'樹精之森外面的林子，樹精和火焰狼常出沒。'},
 forest:{desc:'樹精長老住的森林，越深越多樹精。'},
 camp:{groups:[2,4]},
 hangu:{needLv:24},lishan:{needLv:30},
 beast:{needLv:42,desc:'神獸守著的山谷，老虎、山貓成群。'},
 curse:{needLv:46,desc:'被詛咒的迷宮，殭屍、死靈騎士到處都是。'},
};
export const HUNT_SPOTS=['suburb','trial','camp','woods','forest','hangu','lishan','beast','curse'];
export const SPOTS=Object.fromEntries(HUNT_SPOTS.map(id=>[id,{...PLACES[id],...SPOT_FIX[id]}]));
export function spotOpen(p,id){const pl=SPOTS[id];
 if(pl.needJob&&p.job==='none')return no('要先就職才能去。');
 if(pl.needLv&&p.lv<pl.needLv)return no(`要 ${pl.needLv} 級。`);
 return yes();
}
// 遇敵：怪物種類、等級、一群幾隻照地點的設定；洞窟隨機挑一層。withMate＝帶了幾個夥伴（true 當 1）
export function encounter(spot,rng,heroLv=99,withMate=false){
 const pl=SPOTS[spot],floor=pl.floors?rng.int(1,pl.floors):1,table=pl.floorMons?pl.floorMons(floor):pl.mons;
 const cap=groupMax(heroLv,withMate),lvMax=heroLv<=NEWBIE_LV?Math.max(pl.lv[0],Math.min(pl.lv[1],heroLv+1)):pl.lv[1];
 const total=table.reduce((n,[,w])=>n+w,0),n=rng.int(...pl.groups.map(g=>Math.min(cap,g)));
 const out=[];for(let i=0;i<n;i++){let r=rng.next()*total,id=table[0][0];for(const [m,w] of table){r-=w;if(r<0){id=m;break;}}out.push([id,rng.int(pl.lv[0],lvMax)]);}
 return {enemies:out,floor,lvRange:[pl.lv[0],lvMax]};
}
// 站位：自己設定前排或後排（p.row，Leo 2026-10-26）；沒設定（自動）時 ◎ 拿弓、杖的站後排，其他站前排。近戰只打得到前排
export const ROW_NAMES={front:'前',back:'後'};
export const rowOf=(u,pref)=>pref==='front'||pref==='back'?pref:u.ranged||u.weaponType==='staff'?'back':'front';
// 壞掉的裝備（耐久 0，events.mjs）戰鬥中沒有效果
export const myUnit=p=>{const eq={...p.equip};for(const s of Object.keys(eq))if(eq[s]&&p.dur?.[s]===0)eq[s]=null;const u=applyInjury(P.battleUnit({...p,equip:eq}),p.inj);return {...u,row:rowOf(u,p.row),slot:0};};
// ---------- 隨行夥伴 ◎（Leo 2026-10-26） ----------
// 夥伴是另一位武將，有自己的等級、BP、屬性、職業、技能、裝備、受傷；錢和道具欄兩人共用。
// 練功時跟著出戰，電腦照 ai.mjs 代打（人物沒帶寵物，一樣一回合兩動）；擂台還是只派帶頭的那位。
// 「換人」＝帶頭的和夥伴對調：換過來就能自己操作、配點、換裝、學技能，所以畫面和規則只要管 p 這一位。
export const CHAR_KEYS=['name','look','lv','exp','freeBp','bp','elem','luck','job','rank','rep','skills','equip','hp','mp','inj','w','l','lastMud','seed','row','huntSkill','huntSkill2','dur','pets','petOut','petSeq'];
// 夥伴最多 4 位（p.mate、p.mate2、p.mate3、p.mate4）。隊伍人數照隊裡最高等級的人（Leo 2026-10-27）：20 級 3 人、30 級 4 人、50 級 5 人
export const MATE_IDS=[1,2,3,4];
export const PARTY_LVS=[[50,4],[30,3],[20,2]]; // [等級, 夥伴幾位]
export const MK=i=>i===1?'mate':'mate'+i;
export const PARTY_MAX=5;
export const topLv=p=>Math.max(p.lv||0,...MATE_IDS.map(i=>p[MK(i)]?.lv||0));
export const mateSlots=p=>PARTY_LVS.find(([l])=>topLv(p)>=l)?.[1]||1;
export const TRIO_LV=PARTY_LVS[2][0];
export const trioOpen=p=>mateSlots(p)>=2;
export const mateIds=p=>MATE_IDS.filter(i=>p[MK(i)]); // 身邊的夥伴
export function swapMate(p,i=1){const k=MK(i),m=p[k];if(!m)return no('');const cur={};for(const key of CHAR_KEYS){cur[key]=p[key];p[key]=m[key];}p[k]=cur;return yes(`換${p.name}帶頭，${cur.name}跟在身邊。`);}
export const withMate=(p,fn,i=1)=>{if(!i)return fn();swapMate(p,i);try{return fn();}finally{swapMate(p,i);}};
// 前面的走了，後面的往前補
const tidy=p=>{const ms=mateIds(p).map(i=>p[MK(i)]);MATE_IDS.forEach((i,j)=>{p[MK(i)]=ms[j]||null;});};
const freeSlot=p=>MATE_IDS.find(i=>i<=mateSlots(p)&&!p[MK(i)])||0;
// 酒館寄放的角色（p.roster，Leo 2026-10-26）：已經有夥伴時，新找的人先住在酒館
export const ROSTER_MAX=8;
export function addMate(p,opts){
 p.roster||=[];
 if([p,...MATE_IDS.map(i=>p[MK(i)]),...p.roster].some(c=>c&&c.look===opts.look))return no('這位武將已經在你的隊伍或酒館裡了。');
 const slot=freeSlot(p);
 if(!slot&&p.roster.length>=ROSTER_MAX)return no(`酒館最多住 ${ROSTER_MAX} 人。`);
 const r=newHero(opts);if(!r.ok)return r;const m={};for(const k of CHAR_KEYS)m[k]=r.player[k];m.w=0;m.l=0;m.lastMud=null;
 if(!slot){p.roster.push(m);return yes(`${m.name}在酒館住下了。`);}
 p[MK(slot)]=m;return yes(`${m.name}成為你的隨行夥伴。`);
}
// 夥伴寄放到酒館／從酒館帶出來（身上有夥伴就對調）
export function stashMate(p,k=1){const m=p[MK(k)];if(!m)return no('');p.roster||=[];if(p.roster.length>=ROSTER_MAX)return no(`酒館最多住 ${ROSTER_MAX} 人。`);
 p.roster.push(m);p[MK(k)]=null;tidy(p);return yes(`${m.name}留在酒館。`);}
// slot：換掉哪一位（不給就補空位，沒空位換掉第一位）
export function takeFromRoster(p,i,slot){const c=p.roster?.[i];if(!c)return no('');
 const k=slot||freeSlot(p)||1;
 if(p[MK(k)])p.roster[i]=p[MK(k)];else p.roster.splice(i,1);p[MK(k)]=c;tidy(p);return yes(`${c.name}跟著你出發。`);}
export function dismissRoster(p,i){const c=p.roster?.[i];if(!c)return no('');const back=[];for(const id of Object.values(c.equip||{}))if(id&&P.addItem(p,id))back.push(ITEMS[id].name);
 p.roster.splice(i,1);return yes(`${c.name}離開了。`+(back.length?`收回${back.join('、')}。`:''));}
// 酒館重置點數 ◎：花「等級² × 20」金，把配好的 BP 全部收回來重配（mate＝替夥伴重置）
export const resetBpCost=c=>c.lv*c.lv*20; // ◎ 讓錢有用（Leo 2026-10-26）：等級² × 20（20 級 8000、50 級 50000）
// 換屬性（Leo 2026-10-27）：魔物掉的水晶碎片集滿 SHARD_COST 片，就能換成任一合法的屬性組合（跟創角一樣：合計 10，最多相鄰兩種）
export const SHARD='crystalShard',SHARD_PCT=6,SHARD_COST=5; // ◎ 每隻魔物 6% 掉一片；5 片換一次
export const ELEM_PRESETS=[{earth:10},{water:10},{fire:10},{wind:10},{earth:5,water:5},{water:5,fire:5},{fire:5,wind:5},{wind:5,earth:5}];
export const sameElem=(a,b)=>['earth','water','fire','wind'].every(k=>(a?.[k]||0)===(b?.[k]||0));
export const ELEM_HELP=['地剋水、水剋火、火剋風、風剋地：打到被自己剋的對手，傷害多三成；打到剋自己的，少三成。','兩種各 5 的屬性，剋制效果各算一半，剋與被剋會互相抵消。','沒有屬性的一方，被任何屬性打都算被剋。','攻擊魔法照魔法本身的屬性算，不看施法者的屬性。','魔物的屬性寫在戰鬥畫面的名字旁邊，看到剋自己的就換人打或換屬性。'];
export function changeElem(p,e){
 if(!validElement(e))return no('屬性要剛好 10 點，最多兩種，而且要相鄰（地水、水火、火風、風地）。');
 if(sameElem(p.elem,e))return no('已經是這個屬性了。');
 const have=p.mats?.[SHARD]||0;if(have<SHARD_COST)return no(`要 ${SHARD_COST} 片水晶碎片（現在 ${have} 片）。魔物身上有機會掉，地下城的王一定掉。`);
 p.mats[SHARD]-=SHARD_COST;p.elem={...e};
 return yes(`${p.name}的屬性換成${elemText(e)}了（用掉 ${SHARD_COST} 片水晶碎片）。`);
}
export const elemText=e=>Object.entries(e||{}).filter(([,v])=>v>0).map(([k,v])=>ELEM_NAMES[k]+v).join(' ')||'無';
export function resetBp(p,mate=0){
 const c=mate?p[MK(+mate)]:p;if(!c)return no('');const cost=resetBpCost(c);if(p.gold<cost)return no(`錢不夠：要 ${cost} 金。`);
 const run=()=>{const pts=Object.values(p.bp).reduce((n,v)=>n+Math.floor(v/100),0);if(!pts)return no('沒有配過的點數。');
  for(const k of Object.keys(p.bp))p.bp[k]=0;p.freeBp+=pts;const s=P.stats(p);p.hp=Math.max(1,Math.min(p.hp,s.maxHp));p.mp=Math.min(p.mp,s.maxMp);return yes(`${p.name}的 ${pts} 點 BP 全部收回，可以重新配點。`);};
 const r=mate?withMate(p,run,+mate):run();if(r.ok)p.gold-=cost;return r;
}
// 讓夥伴離開：身上的裝備收回道具欄（放不下的就跟著走了）
export function dropMate(p,k=1){const m=p[MK(k)];if(!m)return no('');const back=[];for(const id of Object.values(m.equip||{}))if(id&&P.addItem(p,id))back.push(ITEMS[id].name);
 p[MK(k)]=null;tidy(p);return yes(`${m.name}離開了。`+(back.length?`收回${back.join('、')}。`:''));}
export const mateUid=i=>i===1?'m':'m'+i;
export const mateUnit=(p,i=1)=>withMate(p,()=>({...myUnit(p),uid:mateUid(i),ai:true,slot:i}),i);
// 出門的夥伴：等級開放的那幾位（生命 0 的不出門）
export const goingMates=p=>mateIds(p).filter(i=>i<=mateSlots(p)&&p[MK(i)].hp>0);
// 借來的角色（events.mjs 借將）：有夥伴、隊伍還沒滿 5 人時多帶一位，電腦代打
export const guestGoing=p=>!!(p.guest?.left>0&&p.mate&&1+goingMates(p).length<PARTY_MAX);
export const partyUnits=p=>{const l=[myUnit(p),...goingMates(p).map(i=>mateUnit(p,i))];
 if(guestGoing(p)){const u=fullUnit(p.guest.f);l.push({...u,uid:'g',ai:true,slot:l.length,row:rowOf(u,p.guest.f.row),guest:true});}
 // 寵物（Leo 2026-10-27）：帶頭的和出門的夥伴各帶一隻出戰的寵物，站前排、電腦自己打；主人那回合只行動一次（core/battle.mjs actionsOf）
 const pets=[[0,'p'],...goingMates(p).map(i=>[i,mateUid(i)])].map(([i,owner])=>withMate(p,()=>{const x=P.petOutOf(p);return x&&x.hp>0?{...petUnitOf(x,owner),uid:'pet'+(owner==='p'?'':owner),row:'front',slot:10+l.length+i}:null;},i)).filter(Boolean);
 return [...l,...pets];};
export const humans=p=>partyUnits(p).filter(u=>u.kind!=='pet');
export {petStats,gradeSum,PET_MAX,PET_SLOTS,petLearnLv,captureRate};
export const petLearnPrice=(x,id)=>PET_SKILL_SHOP[id]*petLearnLv(x);
export const petOut=p=>P.petOutOf(p);
// 收服的冒險者（Leo 2026-10-27：不抓魔物，抓敵對冒險者；規則用寵物那套，寵物沒有職業）：檔次看「品種」＝哪一位武將（原作寵物各品種有自己的檔次）
// ◎ 基礎檔次照武將原本的兵器類型分五種體型，再用名字湊出每位自己的偏向（兩項各 +2／−2），合計 118～124；抓到時每項再 ±2 浮動
const ARCH_GRADE={blade:[32,34,24,18,12],halberd:[30,36,26,16,12],spear:[28,30,24,26,12],sword:[28,30,22,28,12],bow:[22,26,18,36,14]};
const hashOf=t=>{let h=7;for(const ch of t)h=(h*31+ch.charCodeAt(0))>>>0;return h;};
export const genGrade=id=>{const g=GENERAL_BY_ID[id],base=ARCH_GRADE[g?.weapon]||ARCH_GRADE.sword,h=hashOf(id),a=h%5,b=(a+1+(h>>3)%4)%5;return base.map((v,i)=>v+(i===a?2:i===b?-2:0));};
export const gradeMax=x=>(x.mon?MONSTERS[x.mon].grade:genGrade(x.look)).map(g=>g+2);
// 寵物技能（照原作寵物技能大師的招，價錢 ◎）：攻擊系、四屬性魔法、回復、狀態魔法、反擊、明鏡止水、吸血
export const PET_SKILL_SHOP={combo:300,allin:300,blade:500,counter:500,meditate:300,earth1:400,water1:400,fire1:400,wind1:400,heal:600,poison1:400,sleep1:500,confuse1:500,drain:600};
export const petSkills=x=>x.mon?[...(MONSTERS[x.mon].skills||[]).map(([id,L])=>({id,lv:L,innate:true})),...(x.learned||[])]:(x.learned||[]);
export function petUnitOf(x,owner='p'){
 if(x.mon)return petUnit(x,owner);
 const s=petStats(x);
 return {uid:'pet',pid:x.uid,kind:'pet',owner,name:x.name,art:x.look,h:92,lv:x.lv,race:'human',elem:x.elem||{},luck:0,
  maxHp:s.maxHp,hp:Math.min(x.hp,s.maxHp),maxMp:s.maxMp,mp:Math.min(x.mp,s.maxMp),atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0,
  skills:petSkills(x).map(({id,lv})=>({id,lv})),row:'front',slot:0};
}
export function addAdv(p,c,rng){
 p.pets||=[];if(p.pets.length>=PET_MAX)return null;const look=GENERAL_BY_ID[c.look]?c.look:'liaohua',base=genGrade(look);
 const x={uid:'pet'+(++p.petSeq),look,name:GENERAL_BY_ID[c.look]?.name||c.name||'冒險者',lv:c.lv,exp:expFor(c.lv),grade:base.map(g=>Math.max(1,g+rng.int(-2,2))),elem:c.elem||{},learned:[]};
 const s=petStats(x);x.hp=s.maxHp;x.mp=s.maxMp;p.pets.push(x);if(!p.petOut)p.petOut=x.uid;return x;
}
export function petLearn(p,uid,id){
 const x=(p.pets||[]).find(q=>q.uid===uid);if(!x||!PET_SKILL_SHOP[id])return no('');const have=petSkills(x);
 if(have.some(s=>s.id===id))return no('已經會了。');if(have.length>=PET_SLOTS)return no(`技能欄只有 ${PET_SLOTS} 格，先忘掉一招。`);
 const price=petLearnPrice(x,id);if(p.gold<price)return no(`錢不夠：要 ${price} 金。`);
 p.gold-=price;(x.learned||=[]).push({id,lv:petLearnLv(x)});return yes(`${x.name}學會了${SKILLS[id].name} Lv${petLearnLv(x)}。`);
}
export function petForget(p,uid,id){const x=(p.pets||[]).find(q=>q.uid===uid),i=x?.learned?.findIndex(s=>s.id===id);if(i==null||i<0)return no('天生的技能忘不掉。');x.learned.splice(i,1);return yes(`${x.name}忘掉了${SKILLS[id].name}。`);}
export const CATCH_AT=45; // ◎ 自動捕捉：成功率到 45% 才出手（差不多是打到剩一半血）
export const PET_HELP=['10 級起練功、地下城會遇到敵對冒險隊。戰鬥中選中其中一人按「捕捉」就能收服：血越少越好抓、等級比你高越難，頭目抓不到。身上最多 5 位。','收服的人沒有職業，照「檔次」自己成長，不用配點。體力、力量、強度、速度、魔法五項檔次看是哪一位武將（每位有自己的底子），抓到時各在上下 2 之間浮動，五項都到最高就是「滿檔」；同一位多抓幾次比檔次，留好的。','帶一位出戰時，主人每回合行動一次、他自己行動一次；沒帶就行動兩次。他站前排幫忙擋，打贏跟主人一樣拿經驗，受傷到醫院一起補。','技能全部用學的（「改名／學技能」），技能欄 4 格，一學就是照他當時等級的 Lv，之後不變。擂台不帶。'];
export const renamePet=(p,uid,name)=>{const x=(p.pets||[]).find(q=>q.uid===uid);name=(name||'').trim();if(!x)return no('');if(!name||name.length>8)return no('名字 1～8 個字。');x.name=name;return yes(`改名叫${name}了。`);};
export const PET_HELP_OLD=['戰鬥中按「捕捉」抓魔物：血越少越好抓、等級比你高越難抓，頭目和冒險者抓不到。身上最多 5 隻。','寵物照「檔次」自己成長，不用配點。抓到時體力、力量、強度、速度、魔法五項檔次各在這種魔物原本的上下 2 之間浮動，五項都到最高就是「滿檔」；同一種魔物多抓幾隻比檔次，留好的。','帶寵物出戰時，主人每回合行動一次、寵物自己行動一次；沒帶寵物就行動兩次。','寵物站前排幫忙擋，打贏跟主人一樣拿經驗；受傷到醫院一起補。','技能：天生的招式加上在「寵物」頁學的，技能欄 4 格；擂台不帶寵物。'];
// rivals：(等級清單, rng) → 一隊敵對冒險者（dungeon.mjs rivalParty）；10 級起有機會遇到，兩隻以上才成隊
export const RIVAL_PCT=lv=>lv<10?0:Math.min(40,10+lv); // ◎ 遇到敵對冒險隊的機率 %
export const RIVAL_EXP=.5; // ◎ 打倒冒險者的經驗多五成（他們比魔物難打）
export function addRivals(b,fs){const n={front:0,back:0};fs.forEach((f,i)=>{const u=fullUnit(f),row=rowOf(u,f.row);b.units.push({...u,uid:'e'+i,side:'enemy',ai:true,rival:true,mon:null,job:f.job,row,slot:n[row]++,alive:true,defending:false,skip:0,down:null,st:null});});b.team=fs[0]?.team||'';}
export function startHunt(p,spot,seed,rivals=null){
 const rng=makeRng(seed),party=partyUnits(p),n=party.filter(u=>u.kind!=='pet').length,{enemies,floor,lvRange}=encounter(spot,rng,p.lv,n-1);
 const rival=rivals&&enemies.length>=2&&rng.chance(RIVAL_PCT(p.lv));
 const b=createBattle({party,enemies:rival?[]:enemies,seed:rng.int(1,2**31),canEscape:true,captureRoom:P.petRoom(p)});
 if(rival)addRivals(b,rivals(enemies.slice(0,n+1).map(e=>e[1]),rng));
 mudBattle(b);b.spot=spot;b.floor=floor;return b;
}
// 醫院：身邊的人一起算
export const restCost=(p,what)=>P.restCost(p,what)+mateIds(p).reduce((n,i)=>n+withMate(p,()=>P.restCost(p,what),i),0);
export const treatCost=p=>P.treatAllCost(p)+mateIds(p).reduce((n,i)=>n+withMate(p,()=>P.treatAllCost(p),i),0);
const both=(p,fn)=>{const a=fn(),rs=mateIds(p).map(i=>[p[MK(i)].name,withMate(p,fn,i)]);const ok=[a,...rs.map(x=>x[1])].some(r=>r.ok);
 return ok?yes([a.ok&&a.msg,...rs.map(([n,r])=>r.ok&&r.msg&&`${n}：${r.msg}`)].filter(Boolean).join(' ')):a;};
// 戰鬥外喝藥（地下城兩場之間也能用；i＝夥伴，道具欄共用）
export const usePotion=(p,id,i=0)=>i?withMate(p,()=>P.useItemOutside(p,id),i):P.useItemOutside(p,id);
export const rest=(p,what)=>both(p,()=>P.rest(p,what));
export const treat=p=>both(p,()=>P.treatAll(p));
// 練功結束：照原作算經驗、掉落、技能經驗、聲望、受傷；輸了被抬回醫院剩 1 點生命
// 練功變快（Leo 2026-10-26 給的點：20 級 ×1.3、30 ×1.6、40 ×1.8、50 ×2、80 ×2.5，中間照比例；10 級前 ×1，10～20 級也照比例往上（Leo 2026-10-27：13 級就練不動））；照拿經驗那個人的等級
const EXP_PTS=[[10,1],[20,1.3],[30,1.6],[40,1.8],[50,2],[80,2.5]];
export function expMult(lv){if(lv<10)return 1;for(let i=1;i<EXP_PTS.length;i++){const [a,x]=EXP_PTS[i-1],[b,y]=EXP_PTS[i];if(lv<=b)return x+(y-x)*(lv-a)/(b-a);}return 2.5;}
const gain=(p,n)=>{n=Math.round(n*expMult(p.lv));return [P.gainExp(p,n),n];};
// 經驗：照每隻的等級；敵對冒險者多 RIVAL_EXP
const expOf=(b,lv)=>Math.round(foes(b).filter(e=>!e.captured).reduce((n,e)=>n+expFrom(e.lv,lv)*(e.rival?1+RIVAL_EXP:1),0));
export function finishHunt(p,b){
 const me=allies(b)[0],mus=MATE_IDS.map(i=>[i,b.units.find(u=>u.uid===mateUid(i))]).filter(([,u])=>u),out={lines:[]};
 p.hp=Math.max(1,me.hp);p.mp=me.mp;
 const hurt=P.injureParty(p,[me]);for(const [,n] of hurt)out.lines.push(`你受了傷（受傷程度 ${n}），攻擊、防禦都會變差，到醫院治傷。`);
 for(const [i,mu] of mus)if(p[MK(i)])withMate(p,()=>{p.hp=Math.max(1,mu.hp);p.mp=mu.mp;for(const [,n] of P.injureParty(p,[mu]))out.lines.push(`${p.name}受了傷（受傷程度 ${n}）。`);
  if(b.over!=='win'||!mu.alive)return;
  const [ups]=gain(p,expOf(b,p.lv));if(ups.length)out.lines.push(`${p.name}升到 ${p.lv} 級！（換他帶頭才能配點）`);
  for(const s of mu.skills)if(s.gain){const up=P.addSkillExp(p,s.id,s.gain);if(up)out.lines.push(`${p.name}的${SKILLS[s.id].name}升到 Lv${up}！`);}
 },i);
 // 寵物：生命魔力帶回去、打贏照自己的等級拿經驗（跟主人一樣乘 expMult）；抓到的加進帶頭的寵物欄
 for(const [i,owner] of [[0,'p'],...goingMates(p).map(j=>[j,mateUid(j)])]){const pu=b.units.find(u=>u.uid==='pet'+(owner==='p'?'':owner));if(!pu)continue;
  withMate(p,()=>{P.syncParty(p,[pu]);const x=(p.pets||[]).find(q=>q.uid===pu.pid);if(!x||b.over!=='win'||!pu.alive)return;
   const n=Math.round(expOf(b,x.lv)*expMult(x.lv));if(petGainExp(x,n))out.lines.push(`${x.name}升到 ${x.lv} 級！`);},i);}
 if(b.captured?.length){const rng=makeRng((b.rngState^0x5bd1e995)>>>0);for(const c of b.captured){const x=c.mon?P.addPet(p,c.mon,c.lv,rng):addAdv(p,c,rng);if(x)out.lines.push(`收服了${x.name}（Lv${x.lv}）！到「角色→收服」看看檔次。`);}}
 if(b.over==='lose'){out.lines.unshift(mus.length?'全員倒下……被人抬回法蘭城的醫院。':'你倒下了……被人抬回法蘭城的醫院。');return out;}
 if(b.over!=='win')return out;
 const r=rewards(b,p);r.exp=expOf(b,p.lv);const [ups,ex]=gain(p,r.exp);out.lines.push(`得到經驗 ${ex}。`);
 if(ups.length)out.lines.push(`升到 ${p.lv} 級！可以分配 ${p.freeBp} 點 BP（狀態頁）。`);
 const lost=[];for(const id of r.items)if(!P.addItem(p,id))lost.push(ITEMS[id].name);
 if(r.items.length)out.lines.push(`撿到${r.items.map(id=>ITEMS[id].name).join('、')}。`+(lost.length?`（道具欄滿了，${lost.join('、')}丟在地上）`:''));
 for(const [id,n] of Object.entries(r.skillGain)){const up=P.addSkillExp(p,id,n);if(up)out.lines.push(`${SKILLS[id].name}升到 Lv${up}！`);}
 const rep=P.gainRep(p,r.rep);if(rep)out.lines.push(`聲望 +${rep}。`);
 return out;
}

// ---------- 擂台 ----------
export const BOUT_ROUNDS=30;
// 別人看得到、拿來打的那一份：只有戰鬥用得到的欄位（道具欄、錢、任務不給看）
export function publicOf(p){
 const keep={name:p.name,look:p.look,lv:p.lv,bp:p.bp,elem:p.elem,luck:p.luck,job:p.job,rank:p.rank,skills:p.skills.map(s=>({id:s.id,lv:s.lv})),equip:p.equip,row:p.row||''};
 return {v:2,name:p.name,look:p.look,lv:p.lv,job:p.job,rank:p.rank,w:p.w||0,l:p.l||0,hero:JSON.stringify(keep),t:Date.now(),
  // 活動用（events.mjs）：世界王傷害、賽季積分（這週、上週）、稱號、借將紀錄
  wb:p.wb?{wk:p.wb.wk,dmg:p.wb.dmg}:null,wbp:p.wbPrev?{wk:p.wbPrev.wk,dmg:p.wbPrev.dmg}:null,
  s:p.season?{wk:p.season.wk,pts:p.season.pts}:null,sp:p.seasonPrev?{wk:p.seasonPrev.wk,pts:p.seasonPrev.pts}:null,title:p.title||'',bor:(p.borLog||[]).slice(-10)};
}
// 讀別人的公開資料，壞掉或是舊版（武俠版）的就跳過
export function fighterFrom(doc){
 if(!doc||doc.v!==2)return null;
 try{const f=JSON.parse(String(doc.hero));if(!f?.bp||!JOBS[f.job]||!GENERAL_BY_ID[f.look])return null;
  if(f.job==='sorcerer')f.job='priest';f.skills=(f.skills||[]).filter(s=>SKILLS[s.id]);for(const k of Object.keys(f.equip||{}))if(f.equip[k]&&!ITEMS[f.equip[k]])f.equip[k]=null;f.bag=[];f.inj=0;return f;}catch{return null;}
}
export const fullUnit=f=>{const u=P.battleUnit({...f,hp:0,mp:0,bag:[]});u.hp=u.maxHp;u.mp=u.maxMp;return u;};
export function startBout(p,foe,seed){
 const me0=fullUnit(p),me={...me0,row:rowOf(me0,p.row),slot:0};
 const b=createBattle({party:[me],enemies:[],seed,canEscape:false});b.pvp=true;mudBattle(b);
 const fu=fullUnit(foe);b.units.push({...fu,uid:'e0',side:'enemy',ai:true,row:rowOf(fu,foe.row),slot:0,alive:true,defending:false,skip:0,down:null,st:null});
 return mudBattle(b);
}
// 30 回合到了還沒分勝負：剩下的生命比例高的贏（◎）
export function boutTimeout(b){
 if(b.over||b.round<BOUT_ROUNDS)return null;
 const r=u=>u.hp/u.maxHp,me=allies(b)[0],foe=foes(b)[0];
 b.over=r(me)>r(foe)?'win':r(me)<r(foe)?'lose':'draw';return b.over;
}
// 擂台打完：只記勝負。用掉的藥照算（藥是真的喝掉了）
export function finishBout(p,b){if(b.over==='win')p.w=(p.w||0)+1;else if(b.over==='lose')p.l=(p.l||0)+1;}

// ---------- 擂台的常駐好手 ◎（三國名將；等級、職業、配點、配裝都是自訂的，讓擂台不會空著） ----------
// [等級, 職業, 武將]
const NPC=[[2,'sword','liaohua'],[4,'mage','xunyou'],[6,'axe','xuchu'],[8,'priest','huatuo'],[10,'bow','huangzhong'],[13,'fighter','dianwei'],[16,'spear','zhaoyun'],[20,'priest','jiaxu'],[25,'assassin','diaochan'],[30,'wizard','zhouyu'],[35,'axe','guanyu'],[40,'spear','lubu']];
const MAGE_JOBS=new Set(['mage','wizard','sorcerer','priest']);
// 配點比例（體力、力量、強度、速度、魔法）
const BUILD={phys:[.3,.5,.05,.15,0],magic:[.35,0,.05,.1,.5]};
function spendBp(lv,ratio){
 const total=totalBpAt(lv),cap=singleCapAt(lv),bp={};let left=total;
 BP_KEYS.forEach((k,i)=>{const n=Math.min(cap,Math.floor(total*ratio[i]));bp[k]=n;left-=n;});
 for(const k of ['vit','qui','tgh','str','mgc'])while(left>0&&bp[k]<cap){bp[k]++;left--;}
 return bp;
}
export const npcRivals=()=>NPC.map(([lv,job,gid],i)=>{const f=buildFighter(lv,job,gid,GENERAL_BY_ID[gid].name,[{fire:10},{wind:10},{earth:10},{water:10}][i%4],777+i);return {key:'npc:'+i,npc:true,...publicOf(f),fighter:f};});
// 電腦角色（擂台常駐好手、地下城的王）：照等級配點、就職、學本行技能、穿得上的最好裝備
// kit：指定這個人會的技能（地下城的王各有一套）；rank：職階（王照等級晉級：20、50、70 級）
export function buildFighter(lv,job,gid,name,elem,seed,kit=null,rank=0,ratio=null,gearLvIn=null){
  const magic=MAGE_JOBS.has(job),bp=spendBp(lv,ratio||BUILD[magic?'magic':'phys']); // ratio：指定配點比例（王的打法）
  // 創角先放 30 點（照比例），升級後的點數直接補上
  const p=newHero({name:'王',look:gid,bp:{vit:10,str:magic?0:15,tgh:0,qui:5,mgc:magic?15:0},elem,seed}).player;
  p.name=name; // 電腦角色的名字可以超過創角的 8 字上限（例：Kingneptoon）
  p.lv=lv;p.exp=expFor(lv);for(const k of BP_KEYS)p.bp[k]=bp[k]*100;p.freeBp=0;
  joinJob(p,job);p.gold=0;
  // 本行技能：等級約每 5 級升一級，不超過見習的上限
  p.rank=rank;
  for(const id of kit||JOBS[job].main.filter(id=>!SOLO_USELESS.has(SKILLS[id].kind)).slice(0,3))if(P.capOf(p,id)>0)p.skills.push({id,lv:Math.max(1,Math.min(P.capOf(p,id),1+Math.floor(lv/6))),exp:0});
  if(job==='mage'&&!kit)p.skills=p.skills.filter(s=>s.id.endsWith('1')).slice(0,2);
  // 裝備：這個職業穿得上、等級跟得上的最好那件（水龍系列不算）
  const gearLv=gearLvIn||(lv<8?1:lv<18?2:lv<30?3:4); // gearLvIn：指定裝備等級（敵對冒險隊照等級穿更好的）
  for(const slot of SLOTS){
   const pick=Object.keys(ITEMS).filter(id=>{const it=ITEMS[id];return it.slot===slot&&(slot!=='weapon'||JOBS[job].weapons.includes(it.type))&&!it.cheap&&!it.dragon&&!it.noAuto&&it.lv<=gearLv&&it.lv<=gearCap(job,0,it)&&gearCap(job,0,it)>0;})
    .sort((a,b)=>ITEMS[b].lv-ITEMS[a].lv||ITEMS[b].price-ITEMS[a].price)[0];
   if(pick)p.equip[slot]=pick;
  }
  return p;
}

// ---------- 戰鬥事件 → 文字 ----------
import {STATUS_NAMES} from '../data/skills.mjs';
export function narrate(b,e){
 const n=id=>b.units.find(u=>u.uid===id)?.name||'？';
 switch(e.t){
  case 'round':return {c:'sys',t:`── 第 ${e.n} 回合 ──`};
  case 'act':return e.kind==='skill'?{c:'skill',t:`${n(e.a)}使出${e.name} Lv${e.lv}！`}:e.kind==='defend'?{c:'sys',t:`${n(e.a)}擺出防禦架勢。`}:e.kind==='item'?{c:'heal',t:`${n(e.a)}使用${e.name}。`}:e.confused?{c:'dot',t:`${n(e.a)}混亂中亂打一通！`}:null;
  case 'miss':return {c:'miss',t:`${n(e.d)}閃開了${n(e.a)}的攻擊。`};
  case 'hit':return {c:e.crit?'crit':'hit',t:e.kill?`一擊斃命！${n(e.d)}倒地。`:e.elem?`${n(e.d)}被${ELEM_NAMES[e.elem]}屬性魔法打中，受到 ${e.dmg} 傷害。`
   :`${n(e.a)}${e.counter?'反擊':'打中'}${n(e.d)}，${e.crit?'必殺一擊！':''}造成 ${e.dmg} 傷害。`};
  case 'counter':return {c:'skill',t:`${n(e.a)}趁勢反擊！`};
  case 'cover':return {c:'sys',t:`${n(e.a)}擋在${n(e.d)}前面。`};
  case 'heal':return {c:'heal',t:`${n(e.d)}回復 ${e.n} 生命。`};
  case 'mp':return {c:'heal',t:`${n(e.d)}回復 ${e.n} 魔力。`};
  case 'mpLoss':return {c:'hit',t:`${n(e.d)}心神大亂，被削掉 ${e.n} 魔力。`};
  case 'die':return {c:'lose',t:`${n(e.d)}倒下了。`};
  case 'wake':return {c:'sys',t:`${n(e.d)}被打醒了。`};
  case 'status':return e.ok?{c:'dot',t:`${n(e.d)}${STATUS_NAMES[e.st]}了！`}:{c:'miss',t:`${n(e.d)}沒有${STATUS_NAMES[e.st]}。`};
  case 'stuck':return {c:'dot',t:`${n(e.a)}${STATUS_NAMES[e.st]}中，不能行動。`};
  case 'poison':return {c:'dot',t:`${n(e.d)}毒發，受到 ${e.dmg} 傷害。`};
  case 'recoil':return {c:'dot',t:`${n(e.d)}受到反噬，損失 ${e.dmg} 生命。`};
  case 'recover':return {c:'sys',t:`${n(e.d)}的${STATUS_NAMES[e.st]}解除了。`};
  case 'cure':return {c:'heal',t:e.ok?`${n(e.d)}的異常狀態解除了。`:`${n(e.d)}沒有異常狀態。`};
  case 'revive':return {c:'heal',t:`${n(e.d)}站了起來！`};
  case 'escape':return e.ok?{c:'sys',t:'逃跑成功。'}:{c:'miss',t:'逃跑失敗！'};
  case 'capture':return e.ok?{c:'win',t:`收服了${n(e.d)}！`}:e.full?{c:'sys',t:`已經帶了 ${PET_MAX} 位，收服不了。`}:{c:'miss',t:`${n(e.d)}掙脫了。`};
  case 'msg':return {c:'sys',t:e.text};
  case 'end':return null;
  default:return null;
 }
}
export {resolveRound,allies,foes,actionsOf};

// ---------- 換裝 ----------
// 裝備分數：等級優先，同等級比數值（生命、魔力算一半）
const gearScore=id=>{const it=ITEMS[id];return it.lv*1000+['atk','def','agi','spr','matk','rec','crit','counter','hit','dodge','mres'].reduce((s,k)=>s+(it[k]||0),0)+((it.hp||0)+(it.mp||0))/2;};
// 背包裡這一格穿得上的裝備（武器只挑跟手上同一類的，免得換了武器技能不能用）
export function gearChoices(p,slot){
 const cur=p.equip[slot]&&ITEMS[p.equip[slot]];
 return [...new Set(p.bag.map(x=>x.id))].filter(id=>ITEMS[id].slot===slot&&P.canEquip(p,id).ok&&!(slot==='weapon'&&(cur?ITEMS[id].type!==cur.type:!JOBS[p.job].weapons.includes(ITEMS[id].type)))).sort((a,b)=>gearScore(b)-gearScore(a));
}
// 一鍵換最好的：每一格挑分數最高的，比身上的好才換
export function equipBest(p){
 const done=[];
 for(const slot of SLOTS){const best=gearChoices(p,slot)[0],cur=p.equip[slot];if(best&&(!cur||gearScore(best)>gearScore(cur))&&P.equip(p,best).ok)done.push(ITEMS[best].name);}
 return done.length?yes(`換上了${done.join('、')}。`):no('身上已經是最好的了。');
}
