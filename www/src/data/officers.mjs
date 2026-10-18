// 傭兵隊友：原作是五人組隊打怪，單機版由酒吧的傭兵補滿（◎ 傭兵的名字與台詞是自訂的）。
// w 是升級時 BP 的分配比例（體力、力量、強度、速度、魔法），每級一樣 4 點，照人物算法換算。
// fee 是招募金（◎ 自訂）；need 是招募條件。
export const OFFICERS={
 dianwei:{name:'蓋爾',art:'shaolinMonk',job:'axe',weapon:'axe',elem:{earth:8,water:2},w:[.35,.4,.25,0,0],fee:0,
  skills:['blade'],front:true,intro:'「我蓋爾力氣大、吃得多，跟著你混口飯吃，打起架來絕不含糊！」'},
 huatuo:{name:'羅蘭',art:'yunzhonghe',job:'priest',weapon:'staff',elem:{water:6,wind:4},w:[.35,0,.15,.1,.4],fee:300,
  skills:['heal','revive'],later:[['cure',6],['heal2',15]],front:false,intro:'「魔物越來越多，傷者也越來越多。我跟你走，路上替大家補血。」'},
 taishici:{name:'艾倫',art:'palaceGuard',job:'bow',weapon:'bow',elem:{wind:7,fire:3},w:[.3,.35,.1,.25,0],fee:500,need:'job',
  skills:['volley'],front:false,intro:'「我想當上王宮弓箭手！在那之前，就先跟著你磨練吧。」'},
 // 維諾亞村酒吧（town）：打倒黑騎士團長、到了維諾亞村才能招募
 machao:{name:'克勞斯',art:'shanyue-mounted',job:'spear',weapon:'spear',elem:{fire:5,wind:5},w:[.3,.4,.15,.15,0],fee:2000,need:'job',town:'changan',
  skills:['combo','blade'],later:[['allin',30]],front:true,intro:'「我是被黑騎士團趕出來的騎士克勞斯。你打倒了他們的團長？那我跟定你了。」'},
 caiwenji:{name:'莉莉安',art:'lengqingshuang',job:'sorcerer',weapon:'staff',elem:{water:6,wind:4},w:[.3,0,.1,.15,.45],fee:1500,need:'job',town:'changan',
  skills:['water1','sleep1','confuse1'],later:[['heal',26],['water2',30],['stone1',34]],front:false,intro:'「我是咒術師莉莉安。讓敵人睡、讓敵人亂，交給我就好，帶我一起走吧。」'},
 zuoci:{name:'梅林',art:'wudangTaoist',job:'mage',weapon:'staff',elem:{fire:6,wind:4},w:[.3,0,.1,.15,.45],fee:800,need:'job',
  skills:['fire1','wind1'],later:[['fire2',12],['wind2',16]],front:false,intro:'「我是魔術師梅林。想看看被召喚來的冒險者能走多遠。」'},
};
// later：到了這個等級才會的招（◎）
export const OFFICER_ORDER=['dianwei','huatuo','taishici','zuoci','machao','caiwenji'];
export const PARTY_MAX=4; // 加上主角共五人
