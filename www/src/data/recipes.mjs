// 製造配方（原作的鑄劍、造斧、造槍、造弓、造杖、製鎧、裁縫）：技能等級要 ≥ 裝備等級才做得出來。
// ◎ 原作要先把礦石加工成金屬條，本作省略，直接用礦石；材料數量、耗魔、經驗都是自訂。
import {ITEMS} from './items.mjs';
const METAL=[,'copper','ironOre','silver','goldOre'],WOOD=[,'pine','oak','cypress','sandal'],LEATHER=[,'hide','hide','marten','tigerSkin'];
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
export const RECIPES=Object.fromEntries(Object.entries(ITEMS).filter(([,it])=>it.slot).map(([id,it])=>[id,{skill:CRAFT_SKILL_OF(it),lv:it.lv,mats:mats(it),mp:10*it.lv}]));
export const CRAFT_EXP=lv=>300*lv;
