// 地點。原作是在大地圖走路，本作改成點了就到；野外與洞窟用「模擬行走」，6～10 秒隨機遇敵（Leo 2026-10-18）。
// dungeon 有樓層：走路累積探索度，滿 100% 找到往下的樓梯。
export const PLACES={
 luoyang:{name:'洛陽',kind:'town',scene:'town',x:.55,y:.42,desc:'東漢的京城。南華老仙召來的異世之人都從這裡出發。'},
 suburb:{name:'洛陽郊外',kind:'field',scene:'forest',x:.4,y:.55,lv:[1,3],groups:[1,3],
  mons:[['bat',4],['wolf',3],['bee',3]],gather:{lumber:['pine','oak','herb','ginseng'],mining:['copper'],hunting:['meat','hide','marten']},desc:'城外的林子。天門裂開後，異獸常在這裡出沒。'},
 trial:{name:'試煉洞窟',kind:'dungeon',scene:'cave',x:.68,y:.6,need:'trialPass',floors:6,lv:[3,7],groups:[1,4],
  floorMons:f=>f<=2?[['rat',4],['bat',3]]:f<=4?[['rat',3],['bronze',2],['bat',2]]:[['bronze',4],['rat',2]],
  gather:{mining:['copper','ironOre','silver']},hall:6,desc:'太學後山的舊礦坑。六樓大廳的試煉官會替你寫推薦信。'},
 camp:{name:'黃巾營寨',kind:'dungeon',scene:'courtyard',x:.78,y:.32,needJob:true,floors:3,lv:[8,14],groups:[3,6],
  floorMons:f=>[['thief',4],['lancer',3],['brute',f>=2?3:1]],boss:{at:3,group:[['chief',15],['thief',12],['thief',12],['lancer',12],['lancer',12]]},flag:'campCleared',gather:{lumber:['oak','cypress','herb','ginseng'],mining:['ironOre']},
  desc:'城北的黃巾賊營。要先就職才能來。'},
 forest:{name:'長老樹精之森',kind:'dungeon',scene:'forest',x:.25,y:.3,needJob:true,needLv:20,floors:3,lv:[18,24],groups:[3,7],
  floorMons:()=>[['sapling',5],['wolf',2],['bee',2]],boss:{at:3,group:[['treant',26],['sapling',22],['sapling',22],['sapling',22]]},flag:'treant',gather:{lumber:['pine','oak','cypress','sandal','herb','ginseng','lingzhi'],hunting:['hide','marten','antler','tigerSkin'],mining:['silver','goldOre']},reward:'treantSap',
  desc:'晉級正職的試煉「長老樹精的末日」。要就職並達到 20 級。'},
};
export const PLACE_ORDER=['luoyang','suburb','trial','camp','forest'];
