# 日本叮叮 · 客服速查（靜態 MVP）

手機優先嘅客服／消費者參考頁：

1. **產品問答**——功效、成份、用法、年齡、DEET、蠶豆症（G6PD）誠實說明  
2. **門店查貨**——萬寧／屈臣氏靜態分店＋`tel:` 致電確認（**冇**即時庫存）  
3. **其他渠道**——部分店有售／非全線

## 預覽

```bash
cd /workspace/dingding-cs
python3 -m http.server 8765
```

瀏覽器開：<http://127.0.0.1:8765/>

（直接雙撃 `index.html` 亦可，但建議用 local server。）

## 檔案

| 路徑 | 說明 |
|------|------|
| `index.html` | 主頁（問答＋門店分頁） |
| `assets/css/app.css` | 樣式 |
| `assets/js/app.js` | 問答／篩選邏輯 |
| `data/products.js` | SKU 與 claim-safe 說明 |
| `data/stores.js` | 萬寧／屈臣氏靜態分店 |

## 聲稱安全原則

- 只採用官網已寫內容；**唔自創**「蠶豆症適用」醫療聲稱。  
- 官網多款核心產品強調 **non-DEET、不含樟腦**，但通常**無**明示 G6PD safe → 答案會列明此點，並請諮詢醫生／藥劑師。  
- 「防蚊敵」成份（樟腦 1%）來自**第三方藥房頁**，頁內已標明並建議核標籤。  
- 唔會保證可預防登革熱／日本腦炎。

## 範圍外

- 唔連 KA 即時庫存 API、唔爬 live stock、唔登入、未部署。

## 更新資料

- 改產品：編輯 `data/products.js`  
- 加分店：編輯 `data/stores.js`（建議再以官方 store finder 核對電話）
