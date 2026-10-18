// 支線任務：城裡居民的委託（收材料或討伐），完成給錢、經驗、道具。每個任務只能做一次。◎ 內容與報酬都是自訂。
// need：{item,n} 交材料（交付時扣掉）；{kill,n} 接下任務後打倒的數量
export const QUESTS={
 hide:{town:'luoyang',giver:'張機',art:'suxin',name:'醫館缺獸皮',minLv:1,need:{item:'hide',n:5},reward:{gold:300,exp:150},
  text:'「冬天快到了，醫館的病人缺被子。能幫我弄 5 張獸皮嗎？洛陽郊外打獵就有。」',done:'「這下病人不會凍著了，謝謝你。」'},
 bats:{town:'luoyang',giver:'公會書記',art:'commonerM',name:'郊外的蝙蝠',minLv:1,need:{kill:'bat',n:10},reward:{gold:200,exp:120,item:['potion',3]},
  text:'「郊外的蝙蝠越來越多，商隊都不敢走了。去打倒 10 隻吧。」',done:'「商隊又能上路了。這些藥你拿著。」'},
 copper:{town:'luoyang',giver:'糜竺的夥計',art:'aheng',name:'收銅礦',minLv:3,need:{item:'copper',n:10},reward:{gold:450,exp:300},
  text:'「我家主人要鑄錢，缺銅。試煉洞窟裡挖得到銅礦，幫我帶 10 塊來。」',done:'「主人一定很高興。這是工錢。」'},
 thieves:{town:'luoyang',giver:'受傷的士兵',art:'palaceGuard',name:'黃巾的餘黨',minLv:8,need:{kill:'thief',n:15},reward:{gold:900,exp:2500},
  text:'「我就是被黃巾小賊砍傷的……黃巾營寨的賊兵還很多，替我打倒 15 個小賊吧。」',done:'「痛快！這是我攢下的一點錢。」'},
 ginseng:{town:'luoyang',giver:'張機',art:'suxin',name:'人參入藥',minLv:10,need:{item:'ginseng',n:5},reward:{gold:300,exp:1500,item:['potion2',5]},
  text:'「我想試做大金創藥，缺人參。伐木的時候偶爾採得到，帶 5 株來吧。」',done:'「成了！這幾瓶大金創藥送你。」'},
 lingzhi:{town:'changan',giver:'吉平',art:'suxin',name:'靈芝仙草',minLv:30,need:{item:'lingzhi',n:2},reward:{gold:3000,exp:20000},
  text:'「聽說神獸之谷長著靈芝。帶 2 株給我，我想救一個快不行的病人。」',done:'「人有救了……你積了大德。」'},
 cavalry:{town:'changan',giver:'酒保',art:'commonerF',name:'西涼鐵騎',minLv:26,need:{kill:'cavalry',n:20},reward:{gold:4000,exp:40000},
  text:'「西涼鐵騎天天在函谷關一帶搶糧，客人都不來了。打倒 20 騎，我請你喝一年的酒……不對，給你錢。」',done:'「好樣的！這是大家湊的賞金。」'},
 figurine:{town:'changan',giver:'酒保',art:'commonerF',name:'會走路的陶俑',minLv:32,need:{kill:'figurine',n:20},reward:{gold:6000,exp:80000},
  text:'「驪山陵的陶俑會走出來嚇人。打碎 20 個，讓大家安心。」',done:'「這下晚上睡得著了。賞金拿去。」'},
};
export const QUEST_ORDER=Object.keys(QUESTS);
