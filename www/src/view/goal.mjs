// 城裡的目標提示（地名旁邊那一行）：只看存檔資料、不碰畫面，所以可以直接在 node 測試（test/goal.test.mjs）。
import * as P from '../core/player.mjs';
import {JOBS,GATHER_JOBS,MEDIC_JOBS,RANK_SKILL} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS} from '../data/items.mjs';
import {OFFICERS,OFFICER_ORDER} from '../data/officers.mjs';

function promoteGoal(p){
 const c=P.promoteCheck(p),miss=c.rows.filter(r=>!r[1]);
 if(!miss.length)return `晉級條件都達到了，回導師那裡晉級為${c.name}。`;
 return `晉級${c.name}還差：${miss.map(r=>`${r[0]}（${r[2]}）`).join('、')}。`+(miss.some(r=>r[0].startsWith('聲望'))?'聲望靠打怪、採集、製造累積。':'');
}
// 傳教士這種靠技能等級晉級的戰鬥職：練功提示後面補一句技能還差幾級
export function goal(p){
 const g=baseGoal(p),j=JOBS[p.job];
 if(p.job==='none'||j.gather||j.promoteBy==='level'||p.rank>=2||g.startsWith('晉級')||g.startsWith('到')&&g.includes('學技能'))return g;
 const s=p.skills.find(x=>x.id===j.promoteBy),need=RANK_SKILL[p.rank+1];
 return (s?.lv||0)<need?g+`晉級要${SKILLS[j.promoteBy].name} ${need} 級（現在 ${s?.lv||0}），戰鬥中多用（1 級經驗一樣）。`:g;
}
function baseGoal(p){
 if(!p.party.length&&!Object.keys(p.officers).length)return '先到酒吧找傭兵蓋爾，他願意免費跟你同行。之後還能招募羅蘭、艾倫、梅林，湊滿五人隊伍。';
 if(p.job==='none'){
  if(Object.values(JOBS).some(j=>j.letter&&P.countItem(p,j.letter)))return '帶著推薦信去找那個職業的導師就職。';
  if(P.countItem(p,'trialPass'))return p.equip.weapon?'武器裝好了。試煉洞窟要一層層往下走，到 6 樓找試煉官，他會看你手上的武器寫推薦信。':'先到商店街的武器店買想學的那種武器裝上，再到試煉洞窟 6 樓找試煉官拿推薦信。想當傳教士的話，直接去魔法公會找神父答題。';
  if(P.countItem(p,'painkiller'))return '把止痛藥交給職業公會裡受傷的士兵。';
  return '到醫院買止痛藥，交給職業公會裡受傷的士兵，換試煉洞窟的通行證。';
 }
 if(JOBS[p.job].gather&&p.rank<2){
  // 生產職：主技能還沒學就先指去導師那裡；學了就說怎麼練（晉級看技能等級）
  const j=JOBS[p.job],sk=j.main[0],s=p.skills.find(x=>x.id===sk);
  if(!s)return `先到${j.hall}找${j.mentor}學${SKILLS[sk].name}。`;
  const how=GATHER_JOBS.includes(p.job)?`出城到野外按「採集」練${SKILLS[sk].name}。`:MEDIC_JOBS.includes(p.job)?`打開狀態→技能，對受傷的人用${SKILLS[sk].name}練等級。`:`在工房按「製造」做東西練${SKILLS[sk].name}，材料要自己採集或打怪掉。`;
  const g=promoteGoal(p);return g.startsWith('晉級條件都達到了')?g:how+g;
 }
 // 剛就職還沒學職業技能：提醒回導師那裡學
 if(JOBS[p.job].mentor&&!p.skills.some(x=>SKILLS[x.id]?.teacher===p.job)&&Object.values(SKILLS).some(k=>k.teacher===p.job))return `到${['工房','醫院'].includes(JOBS[p.job].hall)?JOBS[p.job].hall:['mage','sorcerer','wizard','priest'].includes(p.job)?'魔法公會':'職業公會'}找${JOBS[p.job].mentor}學技能（要花錢），打起來輕鬆很多。`; // 採集職靠技能等級晉級，不用晉級任務
 // 錢不夠補滿又帶著魔法傭兵：提醒換物理傭兵比較省（試算：魔術師帶物理傭兵撐得住，帶魔法傭兵 33 級後入不敷出）
 // 只有酒吧裡有招過（或免費）的物理傭兵可換時才建議（經濟試算：前期物理傭兵不夠，少帶一人反而更常全滅）
 const caster=p.party.find(id=>['mage','sorcerer'].includes(OFFICERS[id]?.job)),sub=caster&&OFFICER_ORDER.find(id=>!p.party.includes(id)&&!['mage','sorcerer','priest'].includes(OFFICERS[id].job)&&(OFFICERS[id].town||'luoyang')===p.place&&(p.officers[id]||!OFFICERS[id].fee));
 if(sub&&p.gold<P.restCost(p))return `錢不夠補滿時可以只補生命。${OFFICERS[caster].name}會用魔法，補魔最花錢，手頭緊可以換${OFFICERS[sub].name}這種物理傭兵。`;
 if(p.rank===0){
  if(p.flags.treant)return promoteGoal(p);
  if(p.lv>=20)return '去樹精之森打倒樹精長老，完成晉級任務「樹精長老的末日」。';
  // 隊伍還沒湊滿：5 級起提醒到酒吧招人（羅蘭會補血）
  if(p.lv>=5&&p.party.length<2)return '到酒吧多招幾個傭兵，羅蘭會補血、艾倫會射箭，隊伍越完整越不容易全滅。';
  // 照等級指練功點（照 pace.mjs 的路線）；還拿著國民裝備就順便提醒賣魔石存錢換 1 級裝備
  const where=p.lv<5?'先在芙蕾雅練到 5 級左右，再去試煉洞窟。':p.lv<10?'到試煉洞窟往下走，越下面怪越強，練到 10 級。':'到盜賊的巢穴歷練（8～14 級的怪）。20 級才能進樹精之森，打倒樹精長老就能晉級正職。';
  if((p.job==='fighter'?['body']:['weapon','body']).some(s=>ITEMS[p.equip[s]]?.cheap||!p.equip[s])&&p.lv>=3)return where+'魔石拿去道具店賣，存到 1500 金就能換 1 級武器或盔甲。';
  return where;
 }
 if(p.rank===1){
  if(p.flags.beast)return promoteGoal(p);
  if(!p.flags.hangu)return p.lv<24?'在樹精之森練到 24 級左右，再去莎蓮娜海底洞窟。黑騎士團長擋住了往維諾亞村的路。':'去海底洞窟打倒黑騎士團長，打通往維諾亞村的路。';
  if(p.lv<45){const hire=['machao','caiwenji'].filter(id=>!p.officers[id]).map(id=>OFFICERS[id].name);
   return (p.lv<32?'莎蓮娜海底洞窟練到 32 級左右，再去古代王墓（32～42 級的怪）。':'在古代王墓練到 45 級，再去神獸之谷挑戰咆哮的神獸。')+(hire.length?`維諾亞村的酒吧可以招募${hire.join('、')}。`:'');}
  return '去神獸之谷打倒咆哮的神獸，完成晉級任務。';
 }
 return '恭喜晉級王宮職！後面的晉級任務之後開放。';
}
