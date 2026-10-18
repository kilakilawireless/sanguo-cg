// 由 scripts/sync-art.mjs 從群俠江湖複製，請勿手改。
// A10 effect sheets (art-requests/A10-ultimate-vfx.md; owner 2026-10-03: the producer draws them, the game handles timing, tint
// and scale). Sheets are copied from proposals/vfx-v1 to dist/assets/vfx. Each is 1536 wide, cells left to right then top to
// bottom; `ax`/`ay` is the anchor in cell pixels (centre for bursts, left middle for lines, the feet ring for auras and columns).
// Shipped sheets are half-size WebP copies (scripts/build-web-art.mjs); every number here is in master pixels and VFX_SCALE maps it.
// `tint` sheets are drawn white and take the caster's colour; `len` is a line's drawn length at scale 1. A sequence on two sheets
// lists both in `src` with `per` frames on each.
export const VFX_SCALE=.5,VFX_LINGER=.3;
export const VFX={
 V01:{src:'./assets/vfx/V01-hit-spark-light.webp',cw:256,ch:256,n:6,ax:128,ay:128,tint:true,fps:24},
 V02:{src:'./assets/vfx/V02-hit-spark-heavy.webp',cw:512,ch:512,n:6,ax:256,ay:256,tint:true,fps:20},
 V03:{src:'./assets/vfx/V03-slash-arc.webp',cw:256,ch:256,n:6,ax:128,ay:128,tint:true,fps:20},
 V04:{src:'./assets/vfx/V04-spinning-slash-ring.webp',cw:512,ch:512,n:6,ax:256,ay:256,tint:true,fps:16},
 V05:{src:'./assets/vfx/V05-linear-beam.webp',cw:512,ch:128,n:6,ax:32,ay:64,tint:true,fps:18,len:447},
 V06:{src:'./assets/vfx/V06-crescent-projectile.webp',cw:256,ch:256,n:4,ax:128,ay:128,tint:true,fps:16},
 V07:{src:'./assets/vfx/V07-fan-sweep.webp',cw:512,ch:512,n:6,ax:256,ay:256,tint:true,fps:16},
 V08:{src:'./assets/vfx/V08-ground-impact-cracks.webp',cw:512,ch:128,n:8,ax:256,ay:64,fps:16},
 V09:{src:'./assets/vfx/V09-healing-column.webp',cw:256,ch:256,n:8,ax:128,ay:222,fps:12},
 V10:{src:'./assets/vfx/V10-taiji-field.webp',cw:512,ch:128,n:8,ax:256,ay:66,fps:10},
 V11:{src:'./assets/vfx/V11-guhu-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V12:{src:'./assets/vfx/V12-kagezuki-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V13:{src:'./assets/vfx/V13-xiaoman-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V14:{src:'./assets/vfx/V14-yanfeng-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V15:{src:'./assets/vfx/V15-guqiangke-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V16:{src:'./assets/vfx/V16-qingxu-charge.webp',cw:256,ch:256,n:8,ax:128,ay:205,fps:12},
 V17:{src:['./assets/vfx/V17-1-azure-ink-dragon.webp','./assets/vfx/V17-2-azure-ink-dragon.webp'],per:6,cw:512,ch:512,n:12,ax:256,ay:440,fps:14},
 V18:{src:'./assets/vfx/V18-tiger-spirit.webp',cw:512,ch:512,n:6,ax:256,ay:256,fps:14},
 V19:{src:'./assets/vfx/V19-iai-cross-cut.webp',cw:512,ch:512,n:6,ax:256,ay:256,fps:16},
 V20:{src:'./assets/vfx/V20-shadow-moon-slash.webp',cw:256,ch:256,n:6,ax:128,ay:128,fps:16},
 V21:{src:'./assets/vfx/V21-moonfall.webp',cw:512,ch:512,n:6,ax:256,ay:373,fps:12},
 V22:{src:'./assets/vfx/V22-fire-dragon.webp',cw:512,ch:128,n:6,ax:32,ay:67,fps:14,len:300},
 V23:{src:'./assets/vfx/V23-heavenfire-pillar.webp',cw:512,ch:512,n:6,ax:256,ay:455,fps:12},
 V24:{src:'./assets/vfx/V24-triple-spear-flash.webp',cw:256,ch:256,n:8,ax:128,ay:128,fps:11},
 V25:{src:'./assets/vfx/V25-cloud-platform-bagua.webp',cw:512,ch:256,n:6,ax:256,ay:126,fps:8},
 V26:{src:'./assets/vfx/V26-purification-runes.webp',cw:256,ch:256,n:8,ax:128,ay:128,fps:12},
 V27:{src:'./assets/vfx/V27-liangyi-sword-field.webp',cw:512,ch:512,n:6,ax:256,ay:250,fps:10},
 V28:{src:'./assets/vfx/V28-joint-strike.webp',cw:512,ch:512,n:6,ax:256,ay:256,tint:true,fps:14}
};
// A joint attack (師徒合擊, ev.joint) adds the two-streak strike at each target on the last blow, in the master's colour.
export const JOINT_VFX={v:'V28',s:.5};
// Charge auras loop under the caster from the start of the cast until the blow lands.
export const CHARGE_VFX={pangle:'V14',guhu:'V11',yingyue:'V12',hero:'V13',yanfeng:'V14',guqiangke:'V15',qingxu:'V16'};
// Layers per ultimate. `at`: caster (feet), target (chest of each target), cell (feet of each target), line (caster to the farthest
// target), travel (flies to the first target before the blow). `s` scale at a 39 px tile; `each` replays on every hit of a multi-hit
// move (`last` keys a single play to the final hit); `land` is the frame that meets the hit (default 2); `under` draws below the
// figures; `delay` seconds after the hit. A move whose own sheet is still in production uses
// the shared sheets the A10 request names for them until it arrives. Every layer holds its last frame and fades over VFX_LINGER s. `low` keeps a line on the ground; `loop` cycles a field from
// the start of the cast until just after the last hit; `sy` squashes a round sheet onto the ground.
export const ULT_VFX={
 'guhu-u1':[{v:'V04',at:'caster',s:.46},{v:'V01',at:'target',s:.5}],
 'guhu-u2':[{v:'V06',at:'travel',s:.34},{v:'V05',at:'line',s:.42},{v:'V01',at:'target',s:.55}],
 'guhu-u3':[{v:'V18',at:'target',s:.32,land:3},{v:'V02',at:'target',s:.3}],
 'yingyue-u1':[{v:'V19',at:'target',s:.5,land:3}],
 'yingyue-u2':[{v:'V20',at:'target',s:.62}],
 'yingyue-u3':[{v:'V21',at:'caster',s:.58,land:3}],
 'hero-u1':[{v:'V17',at:'cell',s:.45,last:true,land:7},{v:'V01',at:'target',s:.5,each:true}],
 'hero-u2':[{v:'V04',at:'caster',s:.46},{v:'V01',at:'target',s:.5}],
 'hero-u3':[{v:'V10',at:'caster',s:1.3,under:true,loop:true},{v:'V09',at:'target',s:.55}],
 'yanfeng-u1':[{v:'V22',at:'line',s:.5,low:true,land:3},{v:'V08',at:'cell',s:.8,under:true}],
 'yanfeng-u2':[{v:'V23',at:'cell',s:.55},{v:'V08',at:'cell',s:1.2,under:true}],
 'yanfeng-u3':[{v:'V04',at:'caster',s:.46},{v:'V01',at:'target',s:.5}],
 'guqiangke-u1':[{v:'V05',at:'line',s:.4},{v:'V01',at:'target',s:.7}],
 'guqiangke-u2':[{v:'V24',at:'target',s:.7,land:0},{v:'V01',at:'target',s:.45,each:true}],
 'guqiangke-u3':[{v:'V07',at:'caster',s:.55},{v:'V01',at:'target',s:.5}],
 'qingxu-u1':[{v:'V25',at:'caster',s:1.1,under:true,loop:true},{v:'V09',at:'target',s:.5}],
 'qingxu-u2':[{v:'V26',at:'target',s:.55}],
 'pangle-u1':[{v:'V05',at:'line',s:.48,low:true},{v:'V08',at:'cell',s:.9,under:true}],
 'pangle-u2':[{v:'V04',at:'caster',s:.5},{v:'V01',at:'target',s:.5}],
 'pangle-u3':[{v:'V03',at:'target',s:.72},{v:'V02',at:'target',s:.36},{v:'V08',at:'cell',s:1.1,under:true}],
 'qingxu-u3':[{v:'V27',at:'caster',s:.6,sy:.55,under:true,loop:true},{v:'V01',at:'target',s:.5,each:true}]
};
// Sheets load on first use; tinted copies are cached per colour. Without Image or a 2D canvas (the native smoke test) nothing draws.
export function createVfxBank(ImageType=globalThis.Image){return {ImageType,images:{},tinted:new Map()};}
function image(bank,key,part=0){const d=VFX[key];if(!d||!bank.ImageType)return null;const srcs=[].concat(d.src),id=key+':'+part;if(!bank.images[key+':0'])srcs.forEach((s,i)=>{const img=bank.images[key+':'+i]=new bank.ImageType();img.src=s;});const img=bank.images[id];return img?.complete&&img.naturalWidth?img:null;}
export const vfxReady=(bank,key)=>!!image(bank,key);
function sheet(bank,key,color,part=0){const img=image(bank,key,part);if(!img||!color||!VFX[key].tint)return img;const id=key+part+color;if(bank.tinted.has(id))return bank.tinted.get(id);
 let out=img;try{const c=globalThis.document?.createElement?.('canvas'),g=c?.getContext?.('2d');if(g){c.width=img.naturalWidth;c.height=img.naturalHeight;g.drawImage(img,0,0);g.globalCompositeOperation='source-atop';g.globalAlpha=.68;g.fillStyle=color;g.fillRect(0,0,c.width,c.height);out=c;}}catch{out=img;}
 bank.tinted.set(id,out);return out;}
// Draw frame `frame` of a sheet with its anchor at (x, y); `sx`/`sy` stretch a line along its length and thickness.
export function drawVfx(ctx,bank,key,frame,{x,y,scale=1,sx=1,sy=1,angle=0,flip=false,alpha=1,color=null}={}){
 const d=VFX[key];if(!d||frame<0||frame>=d.n)return false;const part=d.per?Math.floor(frame/d.per):0,img=sheet(bank,key,color,part);if(!img)return false;const cols=Math.floor(1536/d.cw);frame-=part*(d.per||0);
 ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.scale((flip?-1:1)*scale*sx,scale*sy);
 const k=VFX_SCALE;ctx.drawImage(img,(frame%cols)*d.cw*k,Math.floor(frame/cols)*d.ch*k,d.cw*k,d.ch*k,-d.ax,-d.ay,d.cw,d.ch);ctx.restore();return true;
}
