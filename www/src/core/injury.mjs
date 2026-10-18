// 受傷（原作）：戰鬥中被打到戰鬥不能就會受傷，受傷程度 0～100，分輕傷（白）、中傷（黃）、重傷（紫）、瀕死（紅）。
// 受傷會讓攻擊、防禦、敏捷、精神、回復下降，在醫館花錢治好；打倒再補血、過夜都不會好。
// ◎ 每次加多少、各級扣多少、治療費用都是自訂的值（原作查不到確切數字）。
export const INJURY=[
 {min:75,name:'瀕死',color:'#e0483c',down:.3},
 {min:50,name:'重傷',color:'#b46be0',down:.2},
 {min:25,name:'中傷',color:'#e0c040',down:.1},
 {min:1,name:'輕傷',color:'#e8e8e8',down:.05},
];
export const injuryOf=n=>n>0?INJURY.find(t=>n>=t.min):null;
const KEYS=['atk','def','agi','spr','rec','matk'];
// 把受傷的扣減套到戰鬥單位上（u.inj 是受傷程度）
export function applyInjury(u,inj){const t=injuryOf(inj||0);if(!t)return u;const o={...u,inj};for(const k of KEYS)if(o[k])o[k]=Math.max(1,Math.round(o[k]*(1-t.down)));return o;}
// 被打倒一次加 10～25（◎）；同一場倒好幾次就加好幾次
export const injuryGain=(rand=Math.random)=>10+Math.floor(rand()*16);
export const addInjury=(obj,downs,rand=Math.random)=>{let n=obj.inj||0;for(let i=0;i<downs;i++)n+=injuryGain(rand);obj.inj=Math.min(100,n);return obj.inj;};
// 醫館治傷費用（◎）：受傷程度 × (等級 + 10) ÷ 4
export const treatCost=(inj,lv)=>inj>0?Math.ceil(inj*(lv+10)/4):0;
