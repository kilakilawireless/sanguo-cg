# 三國魔力寶貝（暫名）
- 擁有者 Leo：用繁體中文回覆；省 token；先做小而可玩的版本再擴充。
- 目標：系統完全照《魔力寶貝》（職業、就職／轉職／晉級、BP 配點、公式），人物與劇情換成三國。企劃書：https://claude.ai/code/artifact/4d14b0f0-ef1b-4c30-bb24-b374348ff046
- Leo 的決定（2026-10-18）：先單機再連線；大地圖點了就到，野外用模擬走路，5～7 秒（平均 6 秒）隨機遇敵；回合制保留，要有自動戰鬥與三倍速；美術用關山月（guanshan-srpg）與群俠江湖現成素材，不改群俠江湖原檔。
- 架構：純 ES modules + Canvas，沒有套件。`www/src/core/` 是規則（不碰畫面，之後可搬到伺服器做連線），`www/src/view/` 是畫面。標 ◎ 的數字是原作查不到、自訂的值。
- 本機試玩：`node server.mjs`（http://127.0.0.1:4190）。改規則跑 `node --test test/*.test.mjs`；畫面健檢 `node scripts/check-ui.mjs [--mobile]`、亂點測試 `node scripts/monkey.mjs [毫秒] [--mobile] [--field]`（都要先開 server）；數值平衡 `node scripts/sim.mjs`（第二張地圖加參數 `2`）。新角色圖用 `node scripts/sync-art.mjs 角色id ...` 從關山月搬（只讀不改原專案），怪物可用 tint 濾鏡染色重用。
- 存檔 key：localStorage `sanguo-cg-v1`，改格式要在 game.mjs migrate 遷移舊檔。
- 網頁不能用 window.confirm／alert（嵌在 claude.ai 會被擋），用 view/ui.mjs 的 ask()。
