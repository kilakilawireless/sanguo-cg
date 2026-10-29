// 紙娃娃（Leo 2026-10-29「擦掉立繪兵器，真的換」）：武將立繪上畫死的兵器擦掉（assets/mud/doll/，工具在 scripts/doll/），
// 戰鬥中照身上那把武器（battleUnit 的 weaponId，沒有就用 weaponType 的國民款）在手的位置疊上去。
// 每把武器長得不一樣（Leo 2026-10-29）：scripts/doll/weapons.py 畫的 196 把，在 assets/mud/wpn/sheet.png，位置表 wpn-data.mjs。
// 先試做 6 位；沒有擦過的武將、收服的（沒裝備）照舊用原圖。
import {WPN_ART} from './wpn-data.mjs';
export const SHEET='./assets/mud/wpn/sheet.png';
export const artOf=(id,type)=>WPN_ART[id]||WPN_ART[type+'N'];
const SHORT={sword:1,dagger:1,axe:1},SIZE=1.2; // 兵器畫大一點，跟原圖的兵器差不多粗
// 每張圖：g＝手（圖上像素；bg＝弓另外握的地方）、a＝長兵器（槍、杖）指的方向（弧度，0＝往前）、l＝畫在身後 b／身前 f；sa、sl＝短兵器（劍、小刀、斧）的；弓一律直放、往前瞄
export const POSES={
 guanyu:{g:[120,228],a:-1.2,l:'b',sa:-.9,sl:'b'},
 guanyu_atk:{g:[212,155],a:.25,l:'b',sa:-1,sl:'b'},
 zhaoyun:{g:[124,178],a:-1.4,l:'b',sa:-1,sl:'b'},
 zhaoyun_atk:{g:[200,142],a:.08,l:'b',sa:.08,sl:'b'},
 lubu:{g:[178,230],a:-1.3,l:'b',sa:-1,sl:'b'},
 lubu_atk:{g:[231,172],a:.3,l:'b',sa:-.9,sl:'b'},
 huangzhong:{g:[120,156],a:-1.25,l:'b',sa:-.9,sl:'b',bg:[142,108]},
 huangzhong_atk:{g:[158,130],a:.1,l:'b',sa:-.5,sl:'b',bl:'f'},
 zhouyu:{g:[66,188],a:-.63,l:'f',sa:-.63,sl:'f'},
 zhouyu_atk:{g:[160,168],a:.43,l:'f',sa:.43,sl:'f'},
 diaochan:{g:[136,165],a:-.89,l:'f',sa:-.89,sl:'f'},
 diaochan_atk:{g:[182,172],a:.35,l:'b',sa:.5,sl:'b'},
};
export const hasDoll=id=>!!POSES[id];
// 這個單位要不要換成紙娃娃：有擦過的圖、而且是有裝備欄的（weaponType 有值或 null＝空手；收服的沒有這欄）
export const useDoll=u=>hasDoll(u.art)&&u.weaponType!==undefined&&u.kind!=='pet';
// 畫兵器：id＝哪一把（找不到用 type 的國民款），ctx 已經在立繪的座標系（圖的左上角＝(left,top)、每像素 s），layer＝'b' 或 'f'，只畫這一層的
export function drawWeapon(ctx,img,pose,type,id,left,top,s,layer){
 const P=POSES[pose],W=artOf(id,type);if(!P||!W||!img||!img.complete||!img.naturalWidth)return;
 const short=SHORT[type],bow=type==='bow',l=bow?(P.bl||'f'):short?P.sl:P.l;if(l!==layer)return;
 const a=bow?0:short?P.sa:P.a;
 const g=bow&&P.bg||P.g;ctx.save();ctx.translate(left+g[0]*s,top+g[1]*s);ctx.rotate(a);ctx.scale(s*SIZE,s*SIZE);ctx.imageSmoothingEnabled=false;
 if(W[6]){ctx.shadowColor=W[6];ctx.shadowBlur=10*s;} // 特殊武器微微發光
 ctx.drawImage(img,W[0],W[1],W[2],W[3],-W[4],-W[5],W[2],W[3]);ctx.restore();
}
