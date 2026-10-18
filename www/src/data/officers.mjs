// 武將隊友：原作是五人組隊打怪，單機版由武將補滿（企劃書「三國化」）。
// w 是升級時 BP 的分配比例（體力、力量、強度、速度、魔法），每級一樣 4 點，照人物算法換算。
// fee 是招募金（◎ 自訂）；need 是招募條件。
export const OFFICERS={
 dianwei:{name:'典韋',art:'shaolinMonk',job:'axe',weapon:'axe',elem:{earth:8,water:2},w:[.35,.4,.25,0,0],fee:0,
  skills:['blade'],front:true,intro:'「我典韋力氣大、吃得多，跟著你混口飯吃，打起架來絕不含糊！」'},
 huatuo:{name:'華佗',art:'yunzhonghe',job:'priest',weapon:'staff',elem:{water:6,wind:4},w:[.35,0,.15,.1,.4],fee:300,
  skills:['heal','revive'],front:false,intro:'「天門裂開以後，傷者太多了。我跟你走，路上替大家治傷。」'},
 taishici:{name:'太史慈',art:'palaceGuard',job:'bow',weapon:'bow',elem:{wind:7,fire:3},w:[.3,.35,.1,.25,0],fee:500,need:'job',
  skills:['volley'],front:false,intro:'「大丈夫生於亂世，當帶三尺劍立不世之功！……不過我比較擅長射箭。」'},
 zuoci:{name:'左慈',art:'wudangTaoist',job:'mage',weapon:'staff',elem:{fire:6,wind:4},w:[.3,0,.1,.15,.45],fee:800,need:'job',
  skills:['fire1','wind1'],front:false,intro:'「貧道左慈，想看看異世之人能走多遠。」'},
};
export const OFFICER_ORDER=['dianwei','huatuo','taishici','zuoci'];
export const PARTY_MAX=4; // 加上主角共五人
