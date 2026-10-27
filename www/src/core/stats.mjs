// 能力值：原作的五項 BP 換算成七項衍生值。係數見企劃書「原作研究一」（魔力百科〈成長BP的深入理解〉）。
// 內部和原作伺服器一樣用「BP×100」的整數存，畫面再除以 100。
export const BP_KEYS=['vit','str','tgh','qui','mgc'];
export const BP_NAMES={vit:'體力',str:'力量',tgh:'強度',qui:'速度',mgc:'魔法'};
export const STAT_NAMES={hp:'生命',mp:'魔力',atk:'攻擊',def:'防禦',agi:'敏捷',spr:'精神',rec:'回復'};
const BASE={hp:20,mp:20,atk:20,def:20,agi:20,spr:100,rec:100};
// 每 1 點 BP 的換算（人物）。寵物與怪物只有攻、防兩欄不同（PET_ATKDEF）。
export const COEF={
 vit:{hp:8,mp:1,atk:.1,def:.1,agi:.1,spr:-.3,rec:.8},
 str:{hp:2,mp:2,atk:2,def:.2,agi:.2,spr:-.1,rec:-.1},
 tgh:{hp:3,mp:2,atk:.2,def:2,agi:.2,spr:.2,rec:-.1},
 qui:{hp:3,mp:2,atk:.2,def:.2,agi:2,spr:-.1,rec:.2},
 mgc:{hp:1,mp:10,atk:.1,def:.1,agi:.1,spr:.8,rec:-.3},
};
const PET_ATKDEF={vit:[.2,.2],str:[2.7,.3],tgh:[.3,2.7],qui:[.3,.3],mgc:[.2,.2]};
// 人物 BP 的加成倍數（只乘正的係數；寵物、怪物不吃）。本作全是 1；文字版在 mud/rules.mjs 改（強度 ×1.3，Leo 2026-10-27）
export const BP_MULT={vit:1,str:1,tgh:1,qui:1,mgc:1};

// bp：{vit,str,tgh,qui,mgc}，單位是「點×100」。pet=true 用寵物攻防係數。
export function derive(bp,pet=false){
 const out={...BASE};
 for(const k of BP_KEYS){
  const v=(bp[k]||0)/100,c=COEF[k],m=pet?1:BP_MULT[k];
  for(const s in c)out[s]+=v*c[s]*(c[s]>0?m:1);
  if(pet){out.atk+=v*(PET_ATKDEF[k][0]-c.atk);out.def+=v*(PET_ATKDEF[k][1]-c.def);}
 }
 for(const s in out)out[s]=Math.floor(out[s]); // 面板捨去小數
 return out;
}

// 創角 30 點、每級 4 點；單項不得超過總點數一半：上限 = (等級−1)×2+15。
export const CREATE_BP=30,BP_PER_LEVEL=4,MAX_LEVEL=120;
export const totalBpAt=lv=>CREATE_BP+BP_PER_LEVEL*(lv-1);
export const singleCapAt=lv=>(lv-1)*2+15;

// 升到第 lv 級所需累積經驗 = lv⁴（Lv1 為 0）。
export const expFor=lv=>lv<=1?0:lv**4;

// 屬性：地水火風各 0~10，合計 10，只能是循環中相鄰的兩種（地-水-火-風-地）。
export const ELEMS=['earth','water','fire','wind'];
export const ELEM_NAMES={earth:'地',water:'水',fire:'火',wind:'風'};
export function validElement(e){
 const v=ELEMS.map(k=>e[k]||0);if(v.some(x=>x<0||x>10)||v.reduce((a,b)=>a+b,0)!==10)return false;
 const on=v.map(x=>x>0);if(on.filter(Boolean).length>2)return false;
 if(on.filter(Boolean).length===2){const i=on.indexOf(true),j=on.lastIndexOf(true);if(!(j-i===1||(i===0&&j===3)))return false;}
 return true;
}
