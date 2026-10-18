// 敵方行動：照設定機率放招（魔力夠才放），不然普攻隨機一名我方。
import {SKILLS} from '../data/skills.mjs';
export function chooseEnemyAction(b,u,rng){
 for(const s of u.skills||[])if(rng.chance(s.pct)&&u.mp>=SKILLS[s.id].mp(s.lv))return {kind:'skill',skill:s.id,target:null};
 return {kind:'attack',target:null};
}

// 武將：有補血的先救人（生命不到一半的隊友），有起死回生的先復活，術士放魔法，其他偶爾用招、平常普攻。
const ELEM_BEATS={earth:'water',water:'fire',fire:'wind',wind:'earth'};
export function chooseAllyAction(b,u,rng){
 const mine=b.units.filter(x=>x.side===u.side),foes=b.units.filter(x=>x.side!==u.side&&x.alive);
 const can=id=>{const s=u.skills.find(x=>x.id===id);return s&&u.mp>=SKILLS[id].mp(s.lv);};
 const dead=mine.filter(x=>!x.alive);if(dead.length&&can('revive'))return {kind:'skill',skill:'revive',target:dead[0].uid};
 const stuck=mine.find(x=>x.alive&&x!==u&&['sleep','stone','confuse'].includes(x.st?.k));if(stuck&&can('cure'))return {kind:'skill',skill:'cure',target:stuck.uid};
 const hurt=mine.filter(x=>x.alive&&x.hp<x.maxHp*.5).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp);
 if(hurt.length>=2)for(const id of ['heal3','heal2'])if(can(id))return {kind:'skill',skill:id,target:hurt[0].uid};
 if(hurt.length&&can('heal'))return {kind:'skill',skill:'heal',target:hurt[0].uid};
 // 方士：35% 機率對還沒中異常狀態的敵人下咒（優先頭目）
 const curse=u.skills.filter(s=>SKILLS[s.id].kind==='status'&&can(s.id)),clean=foes.filter(f=>!f.st).sort((a,c)=>(c.boss?1:0)-(a.boss?1:0));
 if(curse.length&&clean.length&&rng.chance(35))return {kind:'skill',skill:curse[Math.floor(rng.next()*curse.length)].id,target:clean[0].uid};
 // 敵人三隻以上先用範圍魔法
 const area=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&SKILLS[s.id].area&&can(s.id));
 if(area.length&&foes.length>=3)return {kind:'skill',skill:area[area.length-1].id,target:foes[Math.floor(rng.next()*foes.length)].uid};
 const magic=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&!SKILLS[s.id].area&&can(s.id));
 if(magic.length){
  // 挑剋得到的屬性打
  for(const s of magic){const t=foes.find(f=>(f.elem?.[ELEM_BEATS[SKILLS[s.id].elem]]||0)>=5);if(t)return {kind:'skill',skill:s.id,target:t.uid};}
  return {kind:'skill',skill:magic[Math.floor(rng.next()*magic.length)].id,target:null};
 }
 const phys=u.skills.filter(s=>SKILLS[s.id].kind==='phys'&&can(s.id));
 if(phys.length&&rng.chance(35))return {kind:'skill',skill:phys[0].id,target:null};
 return {kind:'attack',target:null};
}
