# 日本叮叮 · 客服速查（靜態 MVP）

手機優先嘅客服／消費者參考頁：

1. **產品問答**——功效、成份、用法、年齡、DEET、蠶豆症（G6PD）誠實說明  
2. **門店查貨**——**萬寧／屈臣氏**可顯示「該產品約 N 間舖有貨」**快照**（店名／電話／地址；可切「電話簿全部」）；另有多渠道**電話簿，非庫存**（松本清／莎莎／AEON／百佳／惠康／卡萊美／Soda Mall／永安／先施），可按香港／九龍／新界篩選＋`tel:` 致電確認。**唔顯示件數。**  
3. **Roadshow／快閃**——2026全民驅蚊大行動時間表＋Facebook 公開海報（以 Facebook 最新為準）
4. **其他／說明**——單張尚有 Market Place、Fusion、Taste、一田、卓悅、HKTVmall 等暫未入電話簿

## 預覽

```bash
cd /workspace/dingding-cs
python3 -m http.server 8765
```

瀏覽器開：<http://127.0.0.1:8765/>

GitHub Pages：<https://lingling3899.github.io/dingding-cs/?v=20261029b>

（直接雙撃 `index.html` 亦可；快照用 `.js` 設定 `window.DD_MANNINGS_STOCK`／`window.DD_WATSONS_STOCK`，唔使 CORS。）

## 檔案

| 路徑 | 說明 |
|------|------|
| `index.html` | 主頁（問答＋門店＋Roadshow） |
| `data/roadshow.js` | 2026 Roadshow／快閃時間表＋宣傳圖 gallery（`window.DD_ROADSHOW`） |
| `data/roadshow-gifts.js` | Roadshow 贈品／試用裝 Stock Check（`window.DD_ROADSHOW_GIFTS`，職員專用） |
| `data/roadshow-images.json` | Facebook 公開帖海報 metadata |
| `assets/css/app.css` | 樣式（深藍／白） |
| `assets/js/app.js` | 問答／篩選／萬寧＋屈臣氏有貨快照 UI |
| `data/products.js` | SKU 與 claim-safe 說明；`manningsUrl`／`manningsCode`／`watsonsUrl`／`watsonsCode` |
| `data/stores.js` | 萬寧／屈臣氏電話簿（公開目錄；非有貨舖數） |
| `data/extra-stores.js` | 松本清／莎莎／AEON／百佳／惠康／卡萊美／Soda Mall／永安／先施電話簿（非庫存） |
| `assets/img/products/` | 官網產品圖（japandingding.com） |
| `data/mannings-stock-snapshot.js` | 萬寧「按產品有貨舖」快照（6 SKU；`window.DD_MANNINGS_STOCK`） |
| `data/mannings-stock-snapshot.json` | 同源 JSON（採集原文；可選保留） |
| `data/watsons-stock-snapshot.js` | 屈臣氏有貨快照（`window.DD_WATSONS_STOCK`；覆蓋約 177 間） |
| `scripts/merge-mannings-stock.js` | raw Mannings JSON → mannings snapshot（fuzzy tel） |
| `scripts/merge-watsons-stock.js` | raw Watsons JSON → watsons snapshot（fuzzy tel；唔寫件數） |

## 萬寧產品頁連結（已填）

| 本站 id | 產品 | 萬寧 code | 快照舖數（2026-10-29） |
|---------|------|-----------|------------------------|
| `spray-pmd` | 全效版配方驅蚊防蟲噴霧 70ml | 678201 | 298 |
| `spray-sensitive` | 防敏蚊怕水 70ml | 802793 | 213 |
| `spray-sakura` | 全效驅蚊噴霧（櫻花香）70ml | 708156 | 158 |
| `patch-18` | 全效驅蚊防蟲貼 18片 | 675165 | 239 |
| `space-35g` | 全效驅蚊防蟲劑 35g | 669374 | 181 |
| `eco-35g` | 環保驅蚊劑 35g | 744805 | 282 |

## 屈臣氏產品頁連結（已填）

| 本站 id | 產品 | 屈臣氏 code | 快照舖數（2026-10-29） |
|---------|------|-------------|------------------------|
| `spray-pmd` | 全效版驅蚊防蟲噴霧 70ml | BP_254153 | 175 |
| `spray-sensitive` | 防敏蚊怕水 70ml | BP_291873 | 173 |
| `spray-sakura` | 全效驅蚊噴霧（櫻花香） | BP_806306 | 147 |
| `patch-18` | 全效驅蚊防蟲貼 18片 | BP_815608 | 175 |
| `space-35g` | 全效驅蚊防蟲劑 35g | BP_815717 | 135 |
| `eco-35g` | 環保驅蚊劑 35g | BP_291870 | 142 |
| `stone-sakura` | 全效驅蚊芳香石（櫻花香） | BP_806305 | 130 |
| `usb-liquid` | USB 液體驅蚊器（連驅蚊液） | BP_813078 | 8 |

屈臣氏「查看門市庫存」只覆蓋約 **177** 間（非電話簿全部）——未列出嘅舖**唔等於**沒有此產品。快照非即時；**唔顯示件數**。

## 點樣接入／更新庫存快照

1. computerUse／手動喺萬寧或屈臣氏產品頁撳「查詢／查看門市庫存」，寫成：
   - `data/raw-mannings-stock-YYYYMMDD.json`
   - `data/raw-watsons-stock-YYYYMMDD.json`
2. 跑 merge（會 fuzzy match 電話簿補 tel；**唔寫件數**）：

```bash
node scripts/merge-mannings-stock.js data/raw-mannings-stock-20261029.json
node scripts/merge-watsons-stock.js data/raw-watsons-stock-20261029.json
```

3. 重新整理頁面（cache bust `?v=`）。`asOf` 為 `null` 或該 id 無 entry → UI fallback 去產品頁連結＋靜態電話簿。

**誠實原則：** 唔好發明舖數；唔當 live API；唔顯示件數／quantity。

## 聲稱安全原則

- 只採用官網已寫內容；**唔自創**「蠶豆症適用」醫療聲稱。  
- 官網多款核心產品強調 **non-DEET、不含樟腦**，但通常**無**明示 G6PD safe → 答案會列明此點，並請諮詢醫生／藥劑師。  
- 「防蚊敵」成份（樟腦 1%）來自**第三方藥房頁**，頁內已標明並建議核標籤。  
- 唔會保證可預防登革熱／日本腦炎。

## 範圍外

- 唔連 KA 即時庫存 API；快照為手動／工具整理檔，唔係 live crawl 結果自動寫入。  
- 未接自訂 domain 亦可試玩（GitHub Pages）。

## 更新資料

- 改產品：編輯 `data/products.js`  
- 加分店電話簿：編輯 `data/stores.js`  
- 更新萬寧有貨舖快照：`node scripts/merge-mannings-stock.js …`  
- 更新屈臣氏有貨舖快照：`node scripts/merge-watsons-stock.js …`
