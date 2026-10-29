/**
 * 日本叮叮客服 — 屈臣氏門市庫存快照（靜態）。
 * asOf 有值＝已載入；請勿當 live stock。唔顯示件數。
 * 屈臣氏庫存查詢只覆蓋約 177 間（非電話簿全部）——唔好將未列出嘅舖標「沒有此產品」。
 * raw 未到 — 空殼；等 browser scrape 寫入後再跑 merge
 */
window.DD_WATSONS_STOCK = {
  "asOf": null,
  "watsonsAsOf": null,
  "source": "pending",
  "disclaimer": "尚未載入屈臣氏門店庫存快照。覆蓋約 177 間，非電話簿全部；請致電確認。",
  "coverageNote": "Checker covers ~177 stores, not full phone book",
  "products": {}
};
