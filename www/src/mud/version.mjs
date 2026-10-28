// 版本號（Leo 2026-10-28：裝成 App 的沒強制更新，每個人看到的版本不一樣）。部署時 .github/workflows/cf.yml 把 'dev' 換成 commit 的前 7 碼；
// 伺服器 /api/ping 回同一個值，網頁開啟或切回前景時比對，不一樣就重新載入（app.mjs checkBuild）。
export const BUILD='dev';
