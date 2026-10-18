// 動作格子資料的精簡格式（省發布包大小，Leo 2026-10-12）：每格從一整個物件改成一列數字，
// [圖檔序號, rect x,y,w,h, anchor x,y, box x,y,w,h, 兵器 0 或 [x,y,angle,length], standingHeight, barExpected]，後兩個沒有就省略。
// scripts/split-motions.mjs 用 packMotion 寫檔，motion.mjs 下載後用 unpackMotion 還原成原本的樣子。
export function packMotion(d){
 if(!d.facings)return d;
 const files=[],at=f=>{let i=files.indexOf(f);if(i<0)i=files.push(f)-1;return i;};
 const facings=Object.fromEntries(Object.entries(d.facings).map(([k,f])=>[k,{actionFrames:Object.fromEntries(Object.entries(f.actionFrames).map(([a,l])=>[a,l.map(fr=>{
  const {rect:r,anchor:n,box:b,weapon:w}=fr,row=[at(fr.file),r.x,r.y,r.w,r.h,n.x,n.y,b.x,b.y,b.w,b.h,w?[w.x,w.y,w.angle,w.length]:0];
  if(fr.standingHeight!==undefined||fr.barExpected!==undefined)row.push(fr.standingHeight??null);
  if(fr.barExpected!==undefined)row.push(fr.barExpected);
  return row;})]))}]));
 return {v:2,files,facings};
}
export function unpackMotion(d){
 if(d.v!==2)return d;
 const facings=Object.fromEntries(Object.entries(d.facings).map(([k,f])=>[k,{actionFrames:Object.fromEntries(Object.entries(f.actionFrames).map(([a,l])=>[a,l.map(([fi,rx,ry,rw,rh,ax,ay,bx,by,bw,bh,w,sh,be])=>{
  const fr={file:d.files[fi],rect:{x:rx,y:ry,w:rw,h:rh},anchor:{x:ax,y:ay},box:{x:bx,y:by,w:bw,h:bh},weapon:w?{x:w[0],y:w[1],angle:w[2],length:w[3]}:null};
  if(sh!==undefined&&sh!==null)fr.standingHeight=sh;if(be!==undefined)fr.barExpected=be;
  return fr;})]))}]));
 return {facings};
}
