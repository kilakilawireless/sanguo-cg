// 怪物：檔次（grade）照原作寵物算法——Lv1 每項 BP＝檔次×0.2，每升一級再加檔次×GROWTH%（◎ 近似值）。
// art 是群俠江湖的動作圖。race 種族、elem 屬性（地水火風合計 10）。skills 是會用的招式與機率。
export const MONSTERS={
 bat:{name:'小蝙蝠',art:'batSwarm',race:'flying',elem:{wind:6,earth:4},grade:[18,22,14,46,20],h:70},
 wolf:{name:'山狼',art:'desertWolf',race:'beast',elem:{earth:10},grade:[26,40,20,30,4],h:70},
 bee:{name:'毒蜂',art:'jadeBees',race:'insect',elem:{fire:5,wind:5},grade:[16,30,14,50,10],h:70},
 rat:{name:'機關鼠',art:'mechRat',race:'metal',elem:{water:10},grade:[30,30,40,16,4],h:60},
 bronze:{name:'銅人',art:'bronzeMan',race:'metal',elem:{earth:10},grade:[40,30,50,8,2],h:100},
 thief:{name:'黃巾小賊',art:'hfBlade',race:'human',elem:{fire:5,wind:5},grade:[28,34,24,26,8],h:92},
 lancer:{name:'黃巾槍兵',art:'hfSpear',race:'human',elem:{fire:10},grade:[26,36,28,22,8],h:92},
 brute:{name:'黃巾力士',art:'evilThug',race:'human',elem:{earth:7,fire:3},grade:[36,42,26,14,2],h:96},
 sapling:{name:'小樹精',art:'muren',race:'plant',elem:{earth:5,water:5},grade:[30,26,30,14,20],h:84,skills:[['water1',2,30]]},
 // 頭目
 chief:{name:'黃巾頭目',art:'hfChief',race:'human',elem:{fire:10},grade:[60,52,40,30,18],h:104,boss:true,skills:[['combo',3,35]]},
 treant:{name:'長老樹精',art:'muren',race:'plant',elem:{earth:6,water:4},grade:[80,46,56,16,40],h:130,boss:true,skills:[['earth1',3,40],['water1',3,20]]},
};
const GROWTH=1.5; // ◎ 每級成長＝檔次×0.025（原作寵物約 0.04，但試玩版還沒有寵物與武將隊友，先調低）
export function monsterBp(id,lv){
 const g=MONSTERS[id].grade,keys=['vit','str','tgh','qui','mgc'],bp={};
 keys.forEach((k,i)=>bp[k]=Math.round(g[i]*(20+GROWTH*(lv-1))));// 單位：點×100
 return bp;
}
// 掉落：魔石照等級分大小（◎），偶爾掉金創藥
export function dropsFor(id,lv,rng){
 const out=[];
 if(rng.chance(MONSTERS[id].boss?100:75))out.push(lv>=20?'crystalL':lv>=8?'crystalM':'crystalS');
 if(rng.chance(MONSTERS[id].boss?60:6))out.push(lv>=15?'potion2':'potion');
 return out;
}
