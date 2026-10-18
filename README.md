# 日本叮叮 · 客服速查（靜態 MVP）

手機優先嘅客服／消費者參考頁：

1. **產品問答**——功效、成份、用法、年齡、DEET、蠶豆症（G6PD）誠實說明  
2. **門店查貨**——萬寧可顯示「該產品約 N 間舖有貨」**快照**（可展開店名／電話／地址）；屈臣氏為擴大靜態電話簿（約 280+ 間，非有貨舖數）＋`tel:` 致電確認（**冇**即時庫存）  
3. **其他渠道**——惠康／百佳／一田／AEON／莎莎／卡萊美／卓悅／松本清／HKTVmall 等部分店有售／非全線

## 預覽

```bash
cd /workspace/dingding-cs
python3 -m http.server 8765
```

瀏覽器開：<http://127.0.0.1:8765/>

GitHub Pages：<https://lingling3899.github.io/dingding-cs/>

（直接雙撃 `index.html` 亦可；快照用 `.js` 設定 `window.DD_MANNINGS_STOCK`，唔使 CORS。）

## 檔案

| 路徑 | 說明 |
|------|------|
| `index.html` | 主頁（問答＋門店分頁） |
| `assets/css/app.css` | 樣式（深藍／白） |
| `assets/js/app.js` | 問答／篩選／萬寧快照 UI |
| `data/products.js` | SKU 與 claim-safe 說明；含可選 `manningsUrl`／`manningsCode` |
| `data/stores.js` | 萬寧代表性電話簿／屈臣氏擴大電話簿（公開目錄；非有貨舖數） |
| `assets/img/products/` | 官網產品圖（japandingding.com） |
| `data/mannings-stock-snapshot.js` | 萬寧「按產品有貨舖」快照（6 SKU；`window.DD_MANNINGS_STOCK`） |
| `data/mannings-stock-snapshot.json` | 同源 JSON（採集原文；可選保留） |

## 萬寧產品頁連結（已填）

| 本站 id | 產品 | 萬寧 code | 快照舖數（2026-10-18） |
|---------|------|-----------|------------------------|
| `spray-pmd` | 全效版配方驅蚊防蟲噴霧 70ml | 678201 | 284 |
| `spray-sensitive` | 防敏蚊怕水 70ml | 802793 | 164 |
| `spray-sakura` | 全效驅蚊噴霧（櫻花香）70ml | 708156 | 108 |
| `patch-18` | 全效驅蚊防蟲貼 18片 | 675165 | 140 |
| `space-35g` | 全效驅蚊防蟲劑 35g | 669374 | 204 |
| `eco-35g` | 環保驅蚊劑 35g | 744805 | 276 |

其餘 SKU 暫無萬寧門店庫存快照（UI fallback 去產品頁連結／電話簿）；`manningsUrl` 未核實者維持 `null`。

## 點樣接入庫存快照

1. computerUse／手動喺萬寧產品頁撳「查詢門店庫存」，整成 JSON。  
2. 覆寫 `data/mannings-stock-snapshot.js`：

```js
window.DD_MANNINGS_STOCK = {
  asOf: "2026-10-18",          // 必填先會顯示「約 N 間」
  source: "Mannings PDP 查詢門店庫存",
  disclaimer: "快照非即時庫存；請致電確認。",
  products: {
    "spray-pmd": {
      manningsCode: "678201",
      manningsUrl: "https://www.mannings.com.hk/zh-hant/ding-ding-mosquito-and-insect-repellent-spray-70ml/p/678201",
      storeCount: 123,         // 數字；唔好估
      stores: [
        { name: "萬寧 · 沙田新城市廣場", address: "…", tel: "26034318", district: "沙田" }
      ]
    }
    // 鍵必須係 products.js 的 id
  }
};
```

3. 重新整理頁面即可。`asOf` 為 `null` 或該 id 無 entry → UI 會 fallback 去萬寧產品頁連結＋靜態電話簿，並清楚寫「非該產品有貨舖數」。

**誠實原則：** 唔好發明舖數；唔當 live API。

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
- 更新萬寧有貨舖快照：編輯 `data/mannings-stock-snapshot.js`
