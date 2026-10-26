# 魔力寶貝（暫名）
- 擁有者 Leo：用繁體中文回覆；省 token；先做小而可玩的版本再擴充。
- 目標：系統完全照《魔力寶貝》（職業、就職／轉職／晉級、BP 配點、公式）。Leo 決定（2026-10-18）：不做三國主題，地名、NPC、職業、技能、怪物、劇情都用原作名稱（查不到的自訂並標 ◎）。企劃書：https://claude.ai/code/artifact/4d14b0f0-ef1b-4c30-bb24-b374348ff046
- Leo 的決定（2026-10-18）：先單機再連線；大地圖點了就到，野外用模擬走路，5～7 秒（平均 6 秒）隨機遇敵；回合制保留，要有自動戰鬥與三倍速；美術用關山月（guanshan-srpg）與群俠江湖現成素材，不改群俠江湖原檔。
- 架構：純 ES modules + Canvas，沒有套件。`www/src/core/` 是規則（不碰畫面，之後可搬到伺服器做連線），`www/src/view/` 是畫面。標 ◎ 的數字是原作查不到、自訂的值。
- 本機試玩：`node server.mjs`（http://127.0.0.1:4190）。改規則跑 `node --test test/*.test.mjs`；畫面健檢 `node scripts/check-ui.mjs [--mobile]`、亂點測試 `node scripts/monkey.mjs [毫秒] [--mobile] [--field] [--late]`（都要先開 server）；數值平衡 `node scripts/sim.mjs`（第二張地圖加參數 `2`）、練功流程試算 `node scripts/pace.mjs [目標等級]`（20／50／70 是三次晉級）、錢夠不夠用（帶血魔連打、自己付錢補）`node scripts/economy.mjs [目標等級] [mage|bow|fighter]`；三個都可加環境變數 `PET=1` 帶寵物。新角色圖用 `node scripts/sync-art.mjs 角色id ...` 從關山月搬（只讀不改原專案），怪物可用 tint 濾鏡染色重用。
- 存檔 key：localStorage `sanguo-cg-v1`，改格式要在 game.mjs migrate 遷移舊檔。
- 網頁不能用 window.confirm／alert（嵌在 claude.ai 會被擋），用 view/ui.mjs 的 ask()。
- 經濟照原作很缺錢（Leo 的要求）：醫院補血 0.5 金／點、補魔 1 金／點，補血時免費補到三成、沒錢時重傷免費治到中傷；收入主要靠賣魔石。寵物出戰時主角每回合只行動一次，試算帶寵物才夠錢練到 Lv70、打頭目勝率 85～98%，提示會引導抓寵物。
- 文字版擂台（MUD，手機用）：`www/mud.html`，程式在 `www/src/mud/`（rules.mjs 規則、app.mjs 畫面、online.mjs 存檔與線上名單），角色是三國武將（Leo 2026-10-26；generals.mjs，立繪在 assets/mud/、臉在 assets/mud/face/，從武俠 kairosoft 專案搬來），其他照本作：BP、職業、技能、裝備、戰鬥公式都直接用 core/ 與 data/。另有職業攻略（guide.mjs）、交易所（db 的 market/，賣家上線時收錢）。不帶寵物傭兵，可帶一位隨行夥伴（p.mate，另一位武將；錢和道具欄共用；練功時電腦代打；「換他帶頭」＝ swapMate 對調 CHAR_KEYS；擂台只派帶頭的）、技能在「大師」學（公會只就職）、指令按一下就出完一回合（兩動出同一招）、練功一群最多 2 隻（3 級以前 1 隻）、諸刃每級 +30%、聖盾撐 3 回合（rules.mjs 的 MODS，只有擂台用）、擂台雙方補滿打完不扣、對手由電腦照 ai.mjs 代打（b.pvp）。選單不要固定在螢幕底部（Leo 2026-10-26）。存檔 key `sanguo-cg-mud-v1`；發布的網頁用 db 的 fighters/、bouts/（v:2 才是這一版）。
