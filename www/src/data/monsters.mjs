// 怪物：檔次（grade）照原作寵物算法——Lv1 每項 BP＝檔次×0.2，每升一級再加檔次×GROWTH%（◎ 近似值）。
// art 是群俠江湖的動作圖。race 種族、elem 屬性（地水火風合計 10）。skills 是會用的招式與機率。
export const MONSTERS={
 bat:{name:'迷你蝙蝠',art:'batSwarm',race:'flying',elem:{wind:6,earth:4},grade:[18,22,14,46,20],h:70},
 wolf:{name:'野狼',art:'desertWolf',race:'beast',elem:{earth:10},grade:[26,40,20,30,4],h:70},
 bee:{name:'巨蜂',art:'jadeBees',race:'insect',elem:{fire:5,wind:5},grade:[16,30,14,50,10],h:70,skills:[['poison1',1,20]]},
 rat:{name:'大地鼠',art:'mechRat',race:'metal',elem:{water:10},grade:[30,30,40,16,4],h:60},
 bronze:{name:'石像怪',art:'bronzeMan',race:'metal',elem:{earth:10},grade:[40,30,50,8,2],h:100},
 thief:{name:'盜賊',art:'hfBlade',race:'human',elem:{fire:5,wind:5},grade:[28,34,24,26,8],h:92},
 lancer:{name:'盜賊槍兵',art:'hfSpear',race:'human',elem:{fire:10},grade:[26,36,28,22,8],h:92},
 brute:{name:'盜賊打手',art:'evilThug',race:'human',elem:{earth:7,fire:3},grade:[36,42,26,14,2],h:96},
 sapling:{name:'樹精',art:'muren',race:'plant',elem:{earth:5,water:5},grade:[30,26,30,14,20],h:84,skills:[['water1',2,25],['sleep1',1,12]]},
 // 海底洞窟、古代王墓、神獸之谷（第二張地圖）。tint 是畫面濾鏡，拿現成的圖染色當新怪（◎）
 cavalry:{name:'黑騎士',art:'tiqiCavalry',race:'human',elem:{fire:6,wind:4},grade:[24,32,22,26,4],h:110,skills:[['combo',3,20]]},
 qiang:{name:'蠻族騎兵',art:'tuobaduo',race:'human',elem:{wind:10},grade:[22,28,20,30,8],h:110,skills:[['volley',3,25]]},
 redWolf:{name:'火焰狼',art:'desertWolf',tint:'hue-rotate(-25deg) saturate(2.2)',race:'beast',elem:{fire:10},grade:[26,38,18,30,2],h:78},
 figurine:{name:'詛咒人偶',art:'qianmianOu',race:'metal',elem:{earth:8,water:2},grade:[28,28,36,10,6],h:96},
 goldMan:{name:'黃金巨像',art:'goldMan',race:'metal',elem:{earth:10},grade:[32,28,40,6,4],h:104,skills:[['earth2',2,15]]},
 ghost:{name:'幽靈',art:'tombBell',race:'undead',elem:{water:6,wind:4},grade:[22,16,18,24,34],h:92,skills:[['confuse1',3,20],['water2',2,25]]},
 tiger:{name:'劍齒虎',art:'desertWolf',tint:'sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.1)',race:'beast',elem:{earth:5,wind:5},grade:[26,36,22,24,2],h:96},
 lynx:{name:'影豹',art:'desertWolf',tint:'hue-rotate(200deg) saturate(1.6) brightness(.8)',race:'beast',elem:{water:5,wind:5},grade:[24,34,20,30,8],h:84,skills:[['sleep1',3,15]]},
 // 頭目
 chief:{name:'盜賊頭目',art:'hfChief',race:'human',elem:{fire:10},grade:[60,52,40,30,18],h:104,boss:true,skills:[['combo',3,35]]},
 huaxiong:{name:'黑騎士團長',art:'jinmian',race:'human',elem:{fire:10},grade:[64,54,42,28,12],h:112,boss:true,skills:[['allin',4,30],['combo',4,25]]},
 tombLord:{name:'亡靈王',art:'shouguanLao',race:'undead',elem:{earth:6,water:4},grade:[72,38,50,22,30],h:110,boss:true,skills:[['stone1',4,20],['earth3',3,25],['poison1',4,15]]},
 whiteTiger:{name:'咆哮的神獸',art:'desertWolf',tint:'grayscale(1) brightness(1.7) contrast(1.1)',race:'beast',elem:{wind:10},grade:[84,64,46,38,22],h:140,boss:true,skills:[['wind3',4,30],['confuse1',4,15],['combo',5,20]]},
 treant:{name:'樹精長老',art:'muren',race:'plant',elem:{earth:6,water:4},grade:[80,46,56,16,40],h:130,boss:true,skills:[['earth2',2,30],['stone1',2,15],['water1',3,20]]},
};
export const GROWTH=4; // ◎ 每級成長＝檔次×0.04（原作寵物的近似值）
export const monsterBp=(id,lv)=>gradeBp(MONSTERS[id].grade,lv);
export function gradeBp(g,lv){
 const keys=['vit','str','tgh','qui','mgc'],bp={};
 keys.forEach((k,i)=>bp[k]=Math.round(g[i]*(20+GROWTH*(lv-1))));// 單位：點×100
 return bp;
}
// 掉落：魔石照等級分大小（◎），偶爾掉回復藥
export const crystalOf=lv=>lv>=40?'crystalXXL':lv>=25?'crystalXL':lv>=15?'crystalL':lv>=6?'crystalM':'crystalS';
export function dropsFor(id,lv,rng){
 const out=[];
 if(rng.chance(MONSTERS[id].boss?100:75))out.push(crystalOf(lv));
 if(rng.chance(MONSTERS[id].boss?60:6))out.push(lv>=15?'potion2':'potion');
 return out;
}
