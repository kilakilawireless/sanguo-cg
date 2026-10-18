// 敵方行動：照設定機率放招（魔力夠才放），不然普攻隨機一名我方。
import {SKILLS} from '../data/skills.mjs';
export function chooseEnemyAction(b,u,rng){
 for(const s of u.skills||[])if(rng.chance(s.pct)&&u.mp>=SKILLS[s.id].mp(s.lv))return {kind:'skill',skill:s.id,target:null};
 return {kind:'attack',target:null};
}
