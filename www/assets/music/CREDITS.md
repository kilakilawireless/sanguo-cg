# 背景音樂來源

五首都是 opengameart.org 上標 **CC0 1.0（公眾領域）** 的曲子：可商用、可改、不用署名（這裡照樣記下作者）。
2026-10-29 下載，用 ffmpeg 音量統一到約 -14 LUFS、轉成 80 kbps MP3；勝利那首剪掉結尾 1.5 秒的靜音並淡出。

| 檔案 | 用在 | 曲名 | 作者 | 來源 |
|---|---|---|---|---|
| town.mp3 | 城中 | Town1 - Home Town（JRPG Pack 2 Towns） | Juhani Junkala（SubspaceAudio） | https://opengameart.org/content/jrpg-pack-2-towns |
| field.mp3 | 野外（練功、地下城頁） | Grasslands（JRPG Pack 1 Exploration） | Juhani Junkala（SubspaceAudio） | https://opengameart.org/content/jrpg-pack-1-exploration |
| battle.mp3 | 一般戰鬥 | Hope (Orchestral battle music) | MintoDog | https://opengameart.org/content/hopeorchestral-battle-music |
| boss.mp3 | 王戰、迷宮王、組隊 | Determined Pursuit (epic orchestra loop) | Emma_MA | https://opengameart.org/content/determined-pursuit-epic-orchestra-loop |
| victory.mp3 | 打贏（只播一次） | Medieval: Victory Theme | RandomMind | https://opengameart.org/content/medieval-victory-theme |

授權全文：https://creativecommons.org/publicdomain/zero/1.0/

讀不到音檔時 www/src/mud/music.mjs 會退回 WebAudio 合成（野外借城中那段、勝利沒有合成就安靜）。
