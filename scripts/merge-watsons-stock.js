#!/usr/bin/env node
/**
 * Merge Watsons store-stock scrape JSON into data/watsons-stock-snapshot.js
 *
 * Usage:
 *   node scripts/merge-watsons-stock.js [rawJsonPath]
 *
 * Raw shape:
 * {
 *   asOf, source?, coverageNote?,
 *   products: {
 *     [productId]: {
 *       watsonsCode|code, watsonsUrl|url,
 *       storeCount?,
 *       stores: [{ name, address, district?, region?, stockStatus, tel? }]
 *     }
 *   }
 * }
 *
 * Never writes quantity / 件數. Fuzzy-matches DD_STORES.watsons for tel.
 * Flat product shape aligned with DD_MANNINGS_STOCK (watsonsCode / watsonsUrl / storeCount / stores).
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var DEFAULT_RAW = path.join(ROOT, "data", "raw-watsons-stock-20261029.json");
var STORES_JS = path.join(ROOT, "data", "stores.js");
var PRODUCTS_JS = path.join(ROOT, "data", "products.js");
var OUT_JS = path.join(ROOT, "data", "watsons-stock-snapshot.js");

var KNOWN_BP = {
  "spray-pmd": "BP_254153",
  "spray-sakura": "BP_806306",
  "spray-sensitive": "BP_291873",
  "patch-18": "BP_815608",
  "space-35g": "BP_815717",
  "eco-35g": "BP_291870"
};

var KNOWN_URL = {
  "spray-pmd":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E5%85%A8%E6%95%88%E7%89%88%E9%A9%85%E8%9A%8A%E9%98%B2%E8%9F%B2%E5%99%B4%E9%9C%A770%E6%AF%AB%E5%8D%87/p/BP_254153",
  "spray-sakura":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E5%85%A8%E6%95%88%E9%A9%85%E8%9A%8A%E5%99%B4%E9%9C%A7-%E6%AB%BB%E8%8A%B1%E9%A6%99/p/BP_806306",
  "spray-sensitive":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E9%98%B2%E6%95%8F%E8%9A%8A%E6%80%95%E6%B0%B470ml/p/BP_291873",
  "patch-18":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE%E5%85%A8%E6%95%88%E9%A9%85%E8%9A%8A%E9%98%B2%E8%9F%B2%E8%B2%BC18%E7%89%87/p/BP_815608",
  "space-35g":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE%E5%85%A8%E6%95%88%E9%A9%85%E8%9A%8A%E9%98%B2%E8%9F%B2%E5%8A%9135%E5%85%8B/p/BP_815717",
  "eco-35g":
    "https://www.watsons.com.hk/zh-hk/%E6%97%A5%E6%9C%AC%E5%8F%AE%E5%8F%AE-%E7%92%B0%E4%BF%9D%E9%A9%85%E8%9A%8A%E5%8A%9135g/p/BP_291870"
};

function loadWindow(file, key) {
  var t = fs.readFileSync(file, "utf8");
  var g = { window: {} };
  // eslint-disable-next-line no-new-func
  Function("window", t)(g.window);
  return g.window[key];
}

function loadWatsonsBook() {
  var data = loadWindow(STORES_JS, "DD_STORES") || {};
  return Array.isArray(data.watsons) ? data.watsons : [];
}

function loadProductUrls() {
  var list = loadWindow(PRODUCTS_JS, "DD_PRODUCTS") || [];
  var map = {};
  list.forEach(function (p) {
    if (p && p.id) {
      map[p.id] = {
        watsonsUrl: p.watsonsUrl || "",
        watsonsCode: p.watsonsCode || ""
      };
    }
  });
  return map;
}

function stripBrand(name) {
  return String(name || "")
    .replace(/^屈臣氏\s*[·•．.]\s*/u, "")
    .replace(/\s+/g, "")
    .trim();
}

function findTel(book, snap) {
  if (snap && snap.tel) return String(snap.tel).trim();
  var sn = stripBrand(snap && snap.name);
  var sa = String((snap && snap.address) || "").replace(/\s+/g, "");
  var i, b, bn, ba;
  for (i = 0; i < book.length; i++) {
    b = book[i];
    bn = stripBrand(b.name);
    if (sn && bn && (bn === sn || bn.indexOf(sn) !== -1 || sn.indexOf(bn) !== -1)) {
      return b.tel || "";
    }
  }
  if (sa.length >= 8) {
    for (i = 0; i < book.length; i++) {
      b = book[i];
      ba = String(b.address || "").replace(/\s+/g, "");
      if (ba && (ba.indexOf(sa.slice(0, 12)) !== -1 || sa.indexOf(ba.slice(0, 12)) !== -1)) {
        return b.tel || "";
      }
    }
  }
  return "";
}

function normalizeStatus(s) {
  var t = String(s || "").trim();
  if (!t) return "有存貨";
  return t;
}

function writeEmptyShell(reason) {
  var banner =
    "/**\n" +
    " * 日本叮叮客服 — 屈臣氏門市庫存快照（靜態）。\n" +
    " * asOf 有值＝已載入；請勿當 live stock。唔顯示件數。\n" +
    " * 屈臣氏庫存查詢只覆蓋約 177 間（非電話簿全部）——唔好將未列出嘅舖標「沒有此產品」。\n" +
    " * " + reason + "\n" +
    " */\n";
  var payload = {
    asOf: null,
    watsonsAsOf: null,
    source: "pending",
    disclaimer: "尚未載入屈臣氏門店庫存快照。覆蓋約 177 間，非電話簿全部；請致電確認。",
    coverageNote: "Checker covers ~177 stores, not full phone book",
    products: {}
  };
  fs.writeFileSync(OUT_JS, banner + "window.DD_WATSONS_STOCK = " + JSON.stringify(payload, null, 2) + ";\n", "utf8");
  console.log("Wrote empty shell", OUT_JS, "(" + reason + ")");
}

function main() {
  var rawPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_RAW;
  if (!fs.existsSync(rawPath)) {
    console.error("Raw JSON not found:", rawPath);
    writeEmptyShell("raw 未到 — 空殼；等 browser scrape 寫入後再跑 merge");
    process.exit(0);
  }
  var raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  var book = loadWatsonsBook();
  var prodMeta = loadProductUrls();
  var asOf = String(raw.asOf || "2026-10-29").trim();
  var productsIn = raw.products || {};
  var productsOut = {};
  var summary = [];

  Object.keys(productsIn).sort().forEach(function (pid) {
    var entry = productsIn[pid] || {};
    var storesIn = Array.isArray(entry.stores) ? entry.stores : [];
    var stores = storesIn
      .map(function (s) {
        var out = {
          name: String(s.name || "").trim(),
          address: String(s.address || "").trim(),
          district: String(s.district || "").trim(),
          stockStatus: normalizeStatus(s.stockStatus)
        };
        if (s.region) out.region = String(s.region).trim();
        var tel = findTel(book, s);
        if (tel) out.tel = tel;
        return out;
      })
      .filter(function (s) {
        return s.name;
      });

    var meta = prodMeta[pid] || {};
    var code = entry.watsonsCode || entry.code || meta.watsonsCode || KNOWN_BP[pid] || "";
    var url = entry.watsonsUrl || entry.url || meta.watsonsUrl || KNOWN_URL[pid] || "";
    productsOut[pid] = {
      watsonsCode: code,
      watsonsUrl: url,
      storeCount: stores.length,
      stores: stores
    };
    summary.push(pid + "\t" + code + "\t" + stores.length);
  });

  var banner =
    "/**\n" +
    " * 日本叮叮客服 — 屈臣氏門市庫存快照（靜態）。\n" +
    " * asOf／watsonsAsOf 有值＝已載入；請勿當 live stock。唔顯示件數。\n" +
    " * 只含「有存貨／就嚟賣晒」舖；無庫存舖唔會出現。\n" +
    " * 屈臣氏庫存查詢只覆蓋約 177 間（非電話簿全部）——唔好將未列出嘅舖標「沒有此產品」。\n" +
    " *\n" +
    " * 來源：" +
    path.basename(rawPath) +
    "（" +
    asOf +
    "）；tel 優先 scrape，否則電話簿 fuzzy match。\n" +
    " * 由 scripts/merge-watsons-stock.js 產生——唔好手改數量欄（本檔唔存件數）。\n" +
    " */\n";

  var payload = {
    asOf: asOf,
    watsonsAsOf: asOf,
    source: raw.source || "watsons.com.hk 查看門市庫存",
    disclaimer: "快照非即時庫存；到舖前請致電確認。覆蓋約 177 間，非電話簿全部。",
    coverageNote: raw.coverageNote || "Checker covers ~177 stores, not full phone book",
    products: productsOut
  };

  fs.writeFileSync(OUT_JS, banner + "window.DD_WATSONS_STOCK = " + JSON.stringify(payload, null, 2) + ";\n", "utf8");

  var sumPath = rawPath.replace(/\.json$/i, "-summary.txt");
  var sumText =
    "Watsons HK 查看門市庫存  as of " +
    asOf +
    "\n" +
    "Source: " +
    (raw.source || "watsons.com.hk") +
    "\n" +
    "Coverage: checker lists about 177 stores, not the full phone book.\n" +
    "Only in-stock / low-stock stores listed. No quantities.\n\n" +
    summary.join("\n") +
    "\n";
  fs.writeFileSync(sumPath, sumText, "utf8");

  console.log("Wrote", OUT_JS);
  summary.forEach(function (line) {
    console.log(" ", line);
  });
}

main();
