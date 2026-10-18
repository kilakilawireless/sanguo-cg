// 畫面健檢：開 node server.mjs 後執行。從創角一路玩到就職、打一場自動戰鬥，截圖存到 out/。
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require(require('node:child_process').execSync('npm root -g').toString().trim()+'/playwright');}
import fs from 'node:fs';
const out=new URL('../out/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const URL0=process.env.URL||'http://127.0.0.1:4190/';
const mobile=process.argv.includes('--mobile');
const browser=await pw.chromium.launch();
const page=await browser.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const shot=async n=>{await page.waitForTimeout(400);await page.screenshot({path:out+(mobile?'m-':'')+n+'.png'});};
// 有視窗開著就只在最上層視窗裡找按鈕
const click=async t=>{const scope=await page.locator('.overlay').count()?page.locator('.overlay').last():page;await scope.getByRole('button',{name:t}).first().click();await page.waitForTimeout(150);};
const talkThrough=async()=>{for(let i=0;i<12;i++){const t=page.locator('.talk');if(!await t.count())break;await t.click();await page.waitForTimeout(80);}};
await page.goto(URL0);await page.evaluate(()=>localStorage.clear());await page.reload();await shot('01-title');
await click('新的旅程');
await page.fill('input','曹小明');
const plus=page.locator('.bp-row button:has-text("+")');
for(let i=0;i<15;i++)await plus.nth(0).click();for(let i=0;i<15;i++)await plus.nth(1).click();
for(let i=0;i<10;i++)await plus.nth(7).click(); // 火
await shot('02-create');
await click('決定');await page.waitForTimeout(300);await shot('03-opening');await talkThrough();await shot('04-town');
// 酒館找典韋
await page.locator('.npc,.fac',{hasText:'酒館'}).first().click();await click('典韋');await talkThrough();await shot('04b-tavern');
// 醫館買止痛藥 → 公會換通行證 → 買劍裝備
await page.locator('.npc,.fac',{hasText:'醫館'}).first().click();await click('買止痛藥');await talkThrough();
await page.locator('.npc,.fac',{hasText:'職業公會'}).first().click();await click('把止痛藥給受傷的士兵');await talkThrough();
await page.locator('.npc,.fac',{hasText:'武器鋪'}).first().click();await click('買');await page.locator('.modal .row',{hasText:'銅劍'}).getByRole('button',{name:'買'}).click();await shot('05-shop');await click('關閉');
await click('狀態');await click('裝備');await page.locator('.modal .row',{hasText:'銅劍'}).getByRole('button',{name:'裝備'}).click();await shot('06-equip');await click('關閉');
// 試煉洞窟：直接把進度設到 6 樓測大廳
await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('sanguo-cg-v1'));p.dungeon={place:'trial',floor:6,explore:0};localStorage.setItem('sanguo-cg-v1',JSON.stringify(p));});
await page.reload();await click('繼續');await click('出城');await shot('07-map');
await page.evaluate(async()=>{const {go}=await import('./src/game.mjs');const {load}=await import('./src/game.mjs');go.field();});
await page.waitForTimeout(500);await shot('08-hall');await click('找試煉官');await talkThrough();await talkThrough();
await click('離開');await click('洛陽');
await page.locator('.npc,.fac',{hasText:'劍術館'}).first().click();await click('就職成為見習劍客');await talkThrough();
await page.locator('.npc,.fac',{hasText:'劍術館'}).first().click();await click('學技能');await click('連擊');await talkThrough();await shot('09-job');
// 野外：開自動戰鬥、3 倍速，等遇敵
await click('出城');await click('洛陽郊外');await shot('10-field');
await click('自動戰鬥');
await page.waitForSelector('.cmd',{timeout:15000});await page.waitForTimeout(600);await shot('11-battle');
await page.evaluate(async()=>{const {G}=await import('./src/game.mjs');G.p.settings.speed=3;});
await page.waitForTimeout(5000);await shot('12-battle2');
const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanguo-cg-v1')));
console.log('job',p.job,'lv',p.lv,'exp',p.exp,'hp',p.hp,'gold',p.gold,'rep',p.rep,'skills',JSON.stringify(p.skills),'bag',p.bag.map(x=>x.id+'x'+x.n).join(','));
console.log(errors.length?'ERRORS:\n'+errors.join('\n'):'沒有錯誤');
await browser.close();
