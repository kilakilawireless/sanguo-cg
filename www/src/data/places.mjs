// 地點。原作是在大地圖走路，本作改成點了就到；野外與洞窟用「模擬行走」，6～10 秒隨機遇敵（Leo 2026-10-18）。
// dungeon 有樓層：走路累積探索度，滿 100% 找到往下的樓梯。
export const PLACES={
 luoyang:{name:'法蘭城',kind:'town',scene:'town',x:.55,y:.42,desc:'法蘭王國的首都。被召喚到這個世界的冒險者都從這裡出發。'},
 changan:{name:'維諾亞村',kind:'town',scene:'town',x:0.14,y:0.62,needFlag:'hangu',desc:'索奇亞大陸上的村子。穿過海底洞窟才到得了。'},
 suburb:{name:'芙蕾雅',kind:'field',scene:'forest',x:0.46,y:0.6,lv:[1,3],groups:[1,3],
  mons:[['bat',4],['wolf',3],['bee',3]],gather:{lumber:['pine','oak','herb','ginseng'],mining:['copper'],hunting:['meat','hide','marten']},desc:'法蘭城外的原野。魔物常在這裡出沒。'},
 trial:{name:'試煉洞窟',kind:'dungeon',scene:'cave',x:0.76,y:0.62,need:'trialPass',floors:6,lv:[3,7],groups:[1,4],
  floorMons:f=>f<=2?[['rat',4],['bat',3]]:f<=4?[['rat',3],['bronze',2],['bat',2]]:[['bronze',4],['rat',2]],
  gather:{mining:['copper','ironOre','silver']},hall:6,desc:'法蘭城外的舊礦坑。六樓大廳的試煉官會替你寫推薦信。'},
 camp:{name:'盜賊的巢穴',kind:'dungeon',scene:'courtyard',x:.78,y:.32,needJob:true,floors:3,lv:[8,14],groups:[3,6],
  floorMons:f=>[['thief',4],['lancer',3],['brute',f>=2?3:1]],boss:{at:3,group:[['chief',15],['thief',12],['thief',12],['lancer',12],['lancer',12]]},flag:'campCleared',gather:{lumber:['oak','cypress','herb','ginseng'],mining:['ironOre']},
  desc:'城北的盜賊窩。要先就職才能來。'},
 forest:{name:'樹精之森',kind:'dungeon',scene:'forest',x:0.3,y:0.25,needJob:true,needLv:20,floors:3,lv:[18,24],groups:[3,7],
  floorMons:()=>[['sapling',5],['wolf',2],['bee',2]],boss:{at:3,group:[['treant',26],['sapling',22],['sapling',22],['sapling',22]]},flag:'treant',gather:{lumber:['pine','oak','cypress','ebony','herb','ginseng','lingzhi'],hunting:['hide','marten','antler','tigerSkin'],mining:['silver','goldOre']},reward:'treantSap',
  desc:'晉級正職的試煉「樹精長老的末日」。要就職並達到 20 級。'},
 // 第二張地圖：正職以後。打倒海底洞窟的黑騎士團長才能去維諾亞村。地名照原作，洞窟裡的劇情是自訂的（◎）
 hangu:{name:'莎蓮娜海底洞窟',kind:'dungeon',scene:'courtyard',x:0.36,y:0.78,home:'luoyang',needRank:1,floors:4,lv:[24,32],groups:[2,5],
  floorMons:f=>[['cavalry',4],['qiang',3],['redWolf',f<=2?3:1]],boss:{at:4,group:[['huaxiong',34],['cavalry',30],['cavalry',30],['qiang',30]]},flag:'hangu',
  gather:{mining:['ironOre','silver'],hunting:['hide','marten']},desc:'法蘭島通往索奇亞大陸的海底洞窟，被黑騎士團占住了。'},
 lishan:{name:'古代王墓',kind:'dungeon',scene:'cave',x:0.18,y:0.93,home:'changan',needFlag:'hangu',floors:5,lv:[32,42],groups:[2,6],
  floorMons:f=>[['figurine',4],['goldMan',f>=3?3:1],['ghost',f>=2?3:1]],boss:{at:5,group:[['tombLord',45],['goldMan',41],['goldMan',41],['ghost',41],['ghost',41]]},flag:'lishan',
  gather:{mining:['silver','goldOre'],lumber:['cypress','herb','ginseng']},desc:'維諾亞村附近的古代王墓。詛咒讓人偶和巨像都動了起來。'},
 beast:{name:'神獸之谷',kind:'dungeon',scene:'forest',x:0.15,y:0.1,home:'changan',needFlag:'hangu',needRank:1,needLv:45,floors:3,lv:[44,52],groups:[2,5],
  floorMons:()=>[['tiger',4],['lynx',3],['redWolf',2]],boss:{at:3,group:[['whiteTiger',55],['tiger',51],['tiger',51],['lynx',51],['lynx',51]]},flag:'beast',reward:'tigerFang',
  gather:{hunting:['marten','antler','tigerSkin'],lumber:['ebony','lingzhi']},desc:'晉級王宮職的試煉「咆哮的神獸」。神獸守在谷底。要正職、45 級。'},
};
export const PLACE_ORDER=['luoyang','suburb','trial','camp','forest','hangu','changan','lishan','beast'];
// 地圖上的路
export const ROADS=[['luoyang','suburb'],['luoyang','trial'],['luoyang','camp'],['luoyang','forest'],['luoyang','hangu'],['hangu','changan'],['changan','lishan'],['changan','beast']];
export const TOWNS=['luoyang','changan'];
