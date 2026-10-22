// 亂點測試：開 node server.mjs 後執行。用中期存檔隨機點按鈕（跳過放生、轉職這類），抓畫面程式的錯誤。node scripts/monkey.mjs [毫秒，預設 90000] [--mobile] [--field] [--late]（--late：40 級正職、在維諾亞村）
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require(require('node:child_process').execSync('npm root -g').toString().trim()+'/playwright');}
const mobile=process.argv.includes('--mobile');
const b=await pw.chromium.launch(),page=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720}});
const errs=new Map();page.on('pageerror',e=>{const k=String(e.stack||e).split('\n').slice(0,3).join(' | ');errs.set(k,(errs.get(k)||0)+1);});page.on('console',m=>{if(m.type()==='error'){errs.set(m.text(),(errs.get(m.text())||0)+1);}});
await page.goto(process.env.URL||'http://127.0.0.1:4190/');
await page.evaluate(async()=>{localStorage.clear();const P=await import('./src/core/player.mjs');
 const p=P.createPlayer({name:'猴',look:'liufeixing',bp:{vit:10,str:12,tgh:4,qui:4},elem:{wind:7,earth:3}}).player;
 P.gainExp(p,22**4);p.job='sword';p.rep=12000;p.gold=50000;p.skills=[{id:'combo',lv:3,exp:0},{id:'lumber',lv:2,exp:0},{id:'craftSword',lv:2,exp:0},{id:'fire3',lv:1,exp:0},{id:'sleep1',lv:2,exp:0},{id:'heal',lv:2,exp:0}];
 for(const id of ['copper','pine','ironOre','potion','potion','crystalS','swordC','bun','painkiller'])P.addItem(p,id,3);
 for(const id of ['swordI','mailL','helmL','bootL'])P.addItem(p,id),P.equip(p,id);
 for(const id of ['dianwei','huatuo','taishici','zuoci'])P.recruit(p,id);
 const {makeRng}=await import('./src/core/rng.mjs');P.addPet(p,'wolf',8,makeRng(5));p.flags.treant=true;
 localStorage.setItem('sanguo-cg-v1',JSON.stringify(p));});
// --late：40 級正職、打通海底洞窟、在維諾亞村，帶克勞斯、莉莉安，主角中傷
if(process.argv.includes('--late'))await page.evaluate(async()=>{const P=await import('./src/core/player.mjs');const p=JSON.parse(localStorage.getItem('sanguo-cg-v1'));
 P.gainExp(p,40**4);p.rank=1;p.flags.hangu=true;p.place='changan';P.dismiss(p,'zuoci');P.dismiss(p,'taishici');P.recruit(p,'machao');P.recruit(p,'caiwenji');p.inj=30;
 localStorage.setItem('sanguo-cg-v1',JSON.stringify(p));});
await page.reload();await page.getByRole('button',{name:/繼續/}).click();
// --field：從盜賊的巢穴開始，多點戰鬥畫面（手動指令）
if(process.argv.includes('--field'))await page.evaluate(async()=>{const {G,go}=await import('./src/game.mjs');G.p.settings.auto=false;G.p.dungeon={place:'camp',floor:1,explore:0};go.field();});
let clicks=0;const t0=Date.now();const dur=+process.argv.find(a=>/^\d+$/.test(a))||90000;
while(Date.now()-t0<dur){
 try{
  if(await page.locator('.talk').count()){await page.locator('.talk').click({timeout:1000});clicks++;continue;}
  const scope=await page.locator('.overlay').count()?page.locator('.overlay').last():page.locator('body');
  const btns=scope.locator('button:visible:not([disabled])');const n=await btns.count();if(!n){await page.waitForTimeout(300);continue;}
  let i=Math.floor(Math.random()*n);const txt=await btns.nth(i).innerText().catch(()=>'');
  if(/新的旅程|重新開始|回到遊民|放生|忘記|離隊|轉職/.test(txt)){continue;}
  await btns.nth(i).click({timeout:1500});clicks++;await page.waitForTimeout(80);
 }catch(e){}
}
console.log((mobile?'手機':'電腦')+' 點了',clicks,'下');for(const [k,v] of errs)console.log(v,k.slice(0,400));if(!errs.size)console.log('沒有錯誤');
await b.close();
