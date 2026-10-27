// 製造配方（原作的鑄劍、造斧、造槍、造弓、造杖、製鎧、裁縫）：技能等級要 ≥ 裝備等級才做得出來。
// 短刀還沒有對應的製造職業（原作造小刀工），先只能在武器店買。
// ◎ 原作要先把礦石加工成金屬條，本作省略，直接用礦石；材料數量、經驗是自訂。
import {ITEMS} from './items.mjs';
const METAL=[,'copper','ironOre','silver','goldOre','platinum'],WOOD=[,'pine','oak','cypress','ebony','ancientWood'],LEATHER=[,'hide','hide','marten','tigerSkin','wyvernHide'];
export const CRAFT_SKILL_OF=it=>it.slot==='weapon'?{sword:'craftSword',axe:'craftAxe',spear:'craftSpear',bow:'craftBow',staff:'craftStaff'}[it.type]:it.armor==='heavy'?'craftMail':'craftCloth';
function mats(it){
 const L=it.lv,n=4+2*L;
 if(it.slot==='weapon'){
  if(it.type==='bow')return [[WOOD[L],n],[LEATHER[L],1]];
  if(it.type==='staff')return [[WOOD[L],n],[METAL[L],1]];
  return [[METAL[L],n],[WOOD[L],1]];
 }
 if(it.armor==='heavy')return [[METAL[L],n],[LEATHER[L],1]];
 return it.armor==='robe'?[[LEATHER[L],n-1],[WOOD[L],1]]:[[LEATHER[L],n]];
}
export const RECIPES={...Object.fromEntries(Object.entries(ITEMS).filter(([,it])=>it.slot&&!it.cheap&&CRAFT_SKILL_OF(it)).map(([id,it])=>[id,{skill:CRAFT_SKILL_OF(it),lv:it.lv,mats:mats(it)}])),
 // 藥劑師（製藥）與廚師（料理）
 potion:{skill:'medicine',lv:1,mats:[['herb',2]]},
 potion2:{skill:'medicine',lv:2,mats:[['herb',2],['ginseng',2]]},
 potion3:{skill:'medicine',lv:3,mats:[['ginseng',3],['antler',1]]},
 potion4:{skill:'medicine',lv:4,mats:[['lingzhi',2],['antler',2]]},
 roast:{skill:'cookery',lv:1,mats:[['meat',2]]},
 meatBun:{skill:'cookery',lv:2,mats:[['meat',3],['herb',1]]},
 hotpot:{skill:'cookery',lv:3,mats:[['meat',4],['ginseng',1]]},
 feast:{skill:'cookery',lv:4,mats:[['meat',6],['lingzhi',1]]},
};
export const CRAFT_EXP=lv=>300*lv;
// 製作耗魔照原作：物品等級×(20−技能等級+1)−1，技能練得越高越省魔
export const CRAFT_MP=(lv,skillLv)=>lv*(21-skillLv)-1;
