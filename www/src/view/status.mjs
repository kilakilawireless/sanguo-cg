// 狀態視窗：能力與配點、裝備、道具、技能、聲望。
import {h,modal,toast,bar,ask,injTag,choose} from './ui.mjs';
import {injuryOf} from '../core/injury.mjs';
import {G,save,repTitle} from '../game.mjs';
import {FIST_ATK,careTargets,useFieldSkill,stats,allocBp,jobTitle,equip,unequip,useItemOutside,canEquip,capOf,forgetSkill,BAG_SIZE} from '../core/player.mjs';
import {BP_KEYS,BP_NAMES,STAT_NAMES,ELEMS,ELEM_NAMES,singleCapAt,expFor} from '../core/stats.mjs';
import {ITEMS,SLOTS,SLOT_NAMES,WEAPON_TYPE_NAMES} from '../data/items.mjs';
// 盾、飾品只有文字版做得出來：主遊戲沒有這類道具時不列空格（第 67 輪）
const HAS_SLOT=new Set(Object.values(ITEMS).map(it=>it.slot).filter(Boolean));
import {SKILLS,SKILL_EXP,SKILL_SLOTS} from '../data/skills.mjs';
import {JOBS} from '../data/jobs.mjs';
import {OFFICERS} from '../data/officers.mjs';
import {officerStats,officerUnit} from '../core/officer.mjs';
import {partyOf,setPetOut,releasePet} from '../core/player.mjs';
import {petStats,gradeSum,PET_MAX,petSkills} from '../core/pet.mjs';
import {MONSTERS} from '../data/monsters.mjs';

export function itemLine(id){const it=ITEMS[id],b=[];
 if(it.slot){b.push(`${it.lv}級`);if(it.type)b.push(WEAPON_TYPE_NAMES[it.type]);if(it.armor)b.push({heavy:'鎧',light:'衣',robe:'袍'}[it.armor]);
  for(const k of ['atk','def','agi','spr','matk'])if(it[k])b.push(`${{atk:'攻',def:'防',agi:'敏',spr:'精',matk:'魔攻'}[k]}${it[k]>0?'+':''}${it[k]}`);if(it.ranged)b.push('遠距');}
 else if(it.desc)b.push(it.desc);
 return b.join(' ');}

export function openStatus(tab='stat',onChange){
 let cur=tab;
 const m=modal('狀態',(refresh)=>{
  const p=G.p,s=stats(p),done=()=>{save();refresh();onChange?.();};
  const tabs=h('div',{class:'tabs'},...[['stat','能力'],['equip','裝備'],['bag','道具'],['skill','技能'],['pet','寵物'],['party','隊伍']].map(([k,n])=>h('button',{class:cur===k?'on':'',onclick:()=>{cur=k;refresh();}},n)));
  let body;
  if(cur==='stat'){
   const cap=singleCapAt(p.lv);
   body=h('div',{class:'col'},
    h('div',{},h('b',{class:'gold'},p.name),` Lv${p.lv}　${jobTitle(p)}　稱號「${repTitle(p)}」`),
    injuryOf(p.inj)?h('div',{class:'small'},injTag(p.inj),` 受傷程度 ${p.inj}：戰鬥時攻擊、防禦、敏捷、精神、回復 −${Math.round(injuryOf(p.inj).down*100)}%，到醫院治傷。`):null,
    h('div',{class:'small muted'},`經驗 ${p.exp}／下一級 ${expFor(p.lv+1)}　聲望 ${p.job==='none'?'（遊民不累積）':p.rep}`),
    h('div',{class:'small'},'屬性：',ELEMS.filter(k=>p.elem[k]).map(k=>`${ELEM_NAMES[k]}${p.elem[k]}`).join(' ')),
    h('div',{},p.freeBp?h('span',{class:'green'},`可分配 ${p.freeBp} 點（單項上限 ${cap}）`):h('span',{class:'muted small'},`升級得 4 點自己分配，單項上限 ${cap}`)),
    ...BP_KEYS.map(k=>h('div',{class:'bp-row'},h('span',{},BP_NAMES[k]),h('b',{},p.bp[k]/100),h('span',{}),
      h('button',{disabled:!p.freeBp,onclick:()=>{const r=allocBp(p,k,1);if(!r.ok)toast(r.msg);done();}},'+1'),
      h('button',{disabled:p.freeBp<4,onclick:()=>{const r=allocBp(p,k,Math.min(p.freeBp,cap-p.bp[k]/100));if(!r.ok)toast(r.msg);done();}},'全'))),
    h('table',{class:'stat'},...[['hp',`${p.hp}/${s.maxHp}`],['mp',`${p.mp}/${s.maxMp}`],['atk',!p.equip.weapon&&p.job==='fighter'?`${s.atk+FIST_ATK(p.lv)}（空手）`:s.atk],['def',s.def],['agi',s.agi],['spr',s.spr],['rec',s.rec]].map(([k,v])=>h('tr',{},h('td',{},STAT_NAMES[k]),h('td',{},v))),
     s.matk?h('tr',{},h('td',{},'魔攻'),h('td',{},s.matk)):null));
  }else if(cur==='equip'){
   body=h('div',{class:'col'},...SLOTS.filter(sl=>p.equip[sl]||HAS_SLOT.has(sl)).map(sl=>{const id=p.equip[sl];return h('div',{class:'row'},h('span',{style:{width:'3em'}},SLOT_NAMES[sl]),h('span',{class:'grow'},id?ITEMS[id].name:h('span',{class:'muted'},'（無）'),id?h('div',{class:'small muted'},itemLine(id)):null),
     id?h('button',{onclick:()=>{const r=unequip(p,sl);toast(r.msg);done();}},'卸下'):null);}),
    h('div',{class:'small muted'},`${JOBS[p.job].name}能用：${p.job==='none'?'所有 1 級裝備':JOBS[p.job].weapons.map(w=>WEAPON_TYPE_NAMES[w]).join('、')}`),
    ...p.bag.filter(x=>ITEMS[x.id].slot).map(x=>{const ok=canEquip(p,x.id);return h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,h('div',{class:'small muted'},itemLine(x.id),ok.ok?'':`（${ok.msg}）`)),h('button',{disabled:!ok.ok,onclick:()=>{const r=equip(p,x.id);toast(r.msg);done();}},'裝備'));}));
  }else if(cur==='bag'){
   body=h('div',{class:'col'},h('div',{class:'small muted'},`道具欄 ${p.bag.length}/${BAG_SIZE}`),
    ...p.bag.map(x=>h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,x.n>1?` ×${x.n}`:'',h('div',{class:'small muted'},itemLine(x.id))),
     ITEMS[x.id].kind==='use'?h('button',{onclick:()=>{const r=useItemOutside(p,x.id);toast(r.msg);done();}},'使用'):null)));
  }else if(cur==='pet'){
   const RACE={human:'人形',beast:'野獸',plant:'植物',undead:'不死',dragon:'龍',flying:'飛行',insect:'昆蟲',special:'特殊',metal:'金屬',demon:'邪魔'};
   body=h('div',{class:'col'},h('div',{class:'small muted'},`寵物 ${p.pets.length}/${PET_MAX}。戰鬥中用「捕捉」抓怪物，血越少越好抓。帶寵物出戰時，你每回合行動一次，寵物也行動一次。`),
    ...p.pets.map(x=>{const t=petStats(x),out=p.petOut===x.uid,m=MONSTERS[x.mon];return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'gold grow'},`${x.name} Lv${x.lv}`,injTag(x.inj)),h('span',{class:'small muted'},`${RACE[m.race]}　檔次合計 ${gradeSum(x)}`),
      h('button',{class:out?'on':'',onclick:()=>{setPetOut(p,x.uid);done();}},out?'出戰中':'出戰'),
      h('button',{class:'small',onclick:async()=>{if(await ask(`放生${x.name}？放生後就找不回來了。`,'放生')){releasePet(p,x.uid);done();}}},'放生')),
     h('div',{class:'row small wrap'},h('span',{class:'nw'},'生命 ',bar(x.hp,t.maxHp,'#c8463a'),` ${x.hp}/${t.maxHp}`),h('span',{class:'nw'},'魔力 ',bar(x.mp,t.maxMp,'#4f9ee8'),` ${x.mp}/${t.maxMp}`)),
     h('div',{class:'small muted'},`攻擊 ${t.atk}　防禦 ${t.def}　敏捷 ${t.agi}　精神 ${t.spr}　回復 ${t.rec}`),
     petSkills(x).length?h('div',{class:'small'},'技能：',petSkills(x).map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、')):null);}));
  }else if(cur==='party'){
   const list=partyOf(p);
   const row=p.settings.row||'back';
   body=h('div',{class:'col'},h('div',{class:'row'},h('span',{class:'grow'},`你的站位：${row==='front'?'前排':'後排'}`),
     h('button',{onclick:()=>{p.settings.row=row==='front'?'back':'front';done();}},row==='front'?'改站後排':'改站前排')),
    h('div',{class:'small muted'},'寵物會站在你另一排的同一個位置。強力魔法打十字範圍，站位會影響誰被波及。'),
    list.length?null:h('div',{class:'muted'},'還沒有傭兵同行。到法蘭城的酒吧招募吧。'),
    ...list.map(o=>{const d=OFFICERS[o.id],t=officerStats(o.id,o.lv);return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'gold grow'},`${d.name} Lv${o.lv}`,injTag(o.inj)),h('span',{class:'small'},`見習${JOBS[d.job].name}`)),
     h('div',{class:'row small wrap'},h('span',{class:'nw'},'生命 ',bar(o.hp,t.maxHp,'#c8463a'),` ${o.hp}/${t.maxHp}`),h('span',{class:'nw'},'魔力 ',bar(o.mp,t.maxMp,'#4f9ee8'),` ${o.mp}/${t.maxMp}`)),
     h('div',{class:'small muted'},`攻擊 ${t.atk}　防禦 ${t.def}　敏捷 ${t.agi}　精神 ${t.spr}　回復 ${t.rec}${t.matk?`　魔攻 ${t.matk}`:''}`),
     h('div',{class:'small'},'技能：',officerUnit(o,0).skills.map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、')));}));
  }else{
   body=h('div',{class:'col'},h('div',{class:'small muted'},`技能欄 ${p.skills.length}/${SKILL_SLOTS}。技能在戰鬥中使用會累積經驗，到職階上限就不再成長。`),
    ...p.skills.map(sk=>{const d=SKILLS[sk.id],cap=capOf(p,sk.id),next=SKILL_EXP[sk.lv],use=Math.max(1,Math.min(sk.lv,cap));return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'grow gold'},`${d.name} Lv${sk.lv}`),h('span',{class:'small muted'},`上限 ${cap}　耗魔 ${d.mp(use)}`)),
     sk.lv>cap?h('div',{class:'small red'},cap?`現在的職業只能用到 Lv${cap}（等級沒掉）`:'現在的職業用不了（等級沒掉）'):null, // 轉職不降級（Leo 2026-10-29），戰鬥時壓到上限
     h('div',{class:'small'},d.desc(use)),
     h('div',{class:'row small'},sk.lv<cap&&next?['經驗 ',bar(sk.exp,next,'#d6a84a'),` ${sk.exp}/${next}`]:h('span',{class:'muted'},'已達上限'),h('span',{class:'grow'}),
      d.kind==='field'?h('button',{class:'small',disabled:p.mp<d.mp(sk.lv),onclick:async()=>{const ref=await choose(`${d.name}・對誰用`,careTargets(p).map(x=>({label:x.name,value:x.ref,note:`生命 ${x.o.hp}/${x.max}${x.o.inj?`　受傷 ${x.o.inj}`:''}`})));if(!ref)return;const r=useFieldSkill(p,sk.id,ref);toast(r.msg);done();}},'使用'):null,
      h('button',{class:'small',onclick:async()=>{if(await ask(`忘記${d.name}後，技能經驗會全部消失。`,'忘記')){forgetSkill(p,sk.id);done();}}},'忘記')));}));
  }
  return h('div',{class:'col'},tabs,body);
 },{onClose:onChange});
 return m;
}
