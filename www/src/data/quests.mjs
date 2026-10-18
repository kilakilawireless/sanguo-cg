// 支線任務：城裡居民的委託（收材料或討伐），完成給錢、經驗、道具。每個任務只能做一次。◎ 內容與報酬都是自訂。
// need：{item,n} 交材料（交付時扣掉）；{kill,n} 接下任務後打倒的數量
export const QUESTS={
 hide:{town:'luoyang',giver:'醫院的護士',art:'suxin',name:'醫院缺獸皮',minLv:1,need:{item:'hide',n:5},reward:{gold:300,exp:150},
  text:'「冬天快到了，醫院的病人缺被子。能幫我弄 5 張獸皮嗎？芙蕾雅打獵就有。」',done:'「這下病人不會凍著了，謝謝你。」'},
 bats:{town:'luoyang',giver:'公會書記',art:'commonerM',name:'郊外的蝙蝠',minLv:1,need:{kill:'bat',n:10},reward:{gold:200,exp:120,item:['potion',3]},
  text:'「郊外的蝙蝠越來越多，商隊都不敢走了。去打倒 10 隻吧。」',done:'「商隊又能上路了。這些藥你拿著。」'},
 copper:{town:'luoyang',giver:'道具店老闆',art:'aheng',name:'收銅礦',minLv:3,need:{item:'copper',n:10},reward:{gold:450,exp:300},
  text:'「武器店要打兵器，缺銅。試煉洞窟裡挖得到銅礦，幫我帶 10 塊來。」',done:'「這下貨源有著落了。這是工錢。」'},
 thieves:{town:'luoyang',giver:'受傷的士兵',art:'palaceGuard',name:'盜賊的餘黨',minLv:8,need:{kill:'thief',n:15},reward:{gold:900,exp:2500},
  text:'「我就是被盜賊砍傷的……盜賊的巢穴裡還有很多，替我打倒 15 個盜賊吧。」',done:'「痛快！這是我攢下的一點錢。」'},
 ginseng:{town:'luoyang',giver:'醫院的護士',art:'suxin',name:'鼠尾草入藥',minLv:10,need:{item:'ginseng',n:5},reward:{gold:300,exp:1500,item:['potion2',5]},
  text:'「我想試做高級回復藥，缺鼠尾草。伐木的時候偶爾採得到，帶 5 株來吧。」',done:'「成了！這幾瓶高級回復藥送你。」'},
 lingzhi:{town:'changan',giver:'維諾亞的醫生',art:'suxin',name:'百里香',minLv:30,need:{item:'lingzhi',n:2},reward:{gold:3000,exp:20000},
  text:'「聽說神獸之谷長著百里香。帶 2 株給我，我想救一個快不行的病人。」',done:'「人有救了……你積了大德。」'},
 cavalry:{town:'changan',giver:'酒保',art:'commonerF',name:'黑騎士',minLv:26,need:{kill:'cavalry',n:20},reward:{gold:4000,exp:40000},
  text:'「黑騎士天天在海底洞窟一帶搶糧，客人都不來了。打倒 20 個，我請你喝一年的酒……不對，給你錢。」',done:'「好樣的！這是大家湊的賞金。」'},
 figurine:{town:'changan',giver:'酒保',art:'commonerF',name:'會走路的人偶',minLv:32,need:{kill:'figurine',n:20},reward:{gold:6000,exp:80000},
  text:'「古代王墓的詛咒人偶會走出來嚇人。打碎 20 個，讓大家安心。」',done:'「這下晚上睡得著了。賞金拿去。」'},
};
export const QUEST_ORDER=Object.keys(QUESTS);
