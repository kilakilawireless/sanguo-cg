// 可重播的亂數（mulberry32）。戰鬥用同一顆種子，1x 與 3x 結果完全一樣。
export function makeRng(seed=Date.now()>>>0){
 let s=seed>>>0;
 const next=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
 const r={
  next,
  int:(a,b)=>a+Math.floor(next()*(b-a+1)), // a..b 含兩端
  pick:arr=>arr[Math.floor(next()*arr.length)],
  chance:pct=>next()*100<pct,
  get seed(){return s;},
 };
 return r;
}
