#!/usr/bin/env node
/**
 * Merge Mannings store-stock scrape JSON into data/mannings-stock-snapshot.js
 *
 * Usage:
 *   node scripts/merge-mannings-stock.js [rawJsonPath]
 *
 * Never writes quantity. Fuzzy-matches DD_STORES.mannings for tel.
 * Keeps flat DD_MANNINGS_STOCK shape (manningsCode / manningsUrl / storeCount / stores).
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var DEFAULT_RAW = path.join(ROOT, "data", "raw-mannings-stock-20261029.json");
var STORES_JS = path.join(ROOT, "data", "stores.js");
var PRODUCTS_JS = path.join(ROOT, "data", "products.js");
var OUT_JS = path.join(ROOT, "data", "mannings-stock-snapshot.js");
var OUT_JSON = path.join(ROOT, "data", "mannings-stock-snapshot.json");

var KNOWN_CODE = {
  "spray-pmd": "678201",
  "spray-sensitive": "802793",
  "spray-sakura": "708156",
  "patch-18": "675165",
  "space-35g": "669374",
  "eco-35g": "744805"
};

function loadWindow(file, key) {
  var t = fs.readFileSync(file, "utf8");
  var g = { window: {} };
  // eslint-disable-next-line no-new-func
  Function("window", t)(g.window);
  return g.window[key];
}

function loadBook() {
  var data = loadWindow(STORES_JS, "DD_STORES") || {};
  return Array.isArray(data.mannings) ? data.mannings : [];
}

function loadProductMeta() {
  var list = loadWindow(PRODUCTS_JS, "DD_PRODUCTS") || [];
  var map = {};
  list.forEach(function (p) {
    if (p && p.id) {
      map[p.id] = {
        manningsUrl: p.manningsUrl || "",
        manningsCode: p.manningsCode || ""
      };
    }
  });
  return map;
}

function stripBrand(name) {
  return String(name || "")
    .replace(/^萬寧\s*[·•．.]\s*/u, "")
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
  if (!t) return "有現貨";
  return t;
}

function main() {
  var rawPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_RAW;
  if (!fs.existsSync(rawPath)) {
    console.error("Raw JSON not found:", rawPath);
    console.error("Leaving mannings-stock-snapshot.js unchanged (keep prior snapshot).");
    process.exit(2);
  }
  var raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  var book = loadBook();
  var prodMeta = loadProductMeta();
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
    var code = entry.manningsCode || entry.code || meta.manningsCode || KNOWN_CODE[pid] || "";
    var url = entry.manningsUrl || entry.url || meta.manningsUrl || "";
    productsOut[pid] = {
      manningsCode: code,
      manningsUrl: url,
      storeCount: stores.length,
      stores: stores
    };
    summary.push(pid + "\t" + code + "\t" + stores.length);
  });

  var banner =
    "/**\n" +
    " * 萬寧門店庫存快照（靜態）。\n" +
    " * 來源：mannings.com.hk 公開「查詢門店庫存」／" +
    asOf +
    " HKT。\n" +
    " * 鍵為 products.js 的 product id。asOf 有值＝已載入；請勿當 live stock。\n" +
    " * 只含有現貨 + 庫存緊張門店；無庫存門店不會出現。唔顯示件數。\n" +
    " * 由 scripts/merge-mannings-stock.js 產生（" +
    path.basename(rawPath) +
    "）。\n" +
    " */\n";

  var payload = {
    asOf: asOf,
    manningsAsOf: asOf,
    source: raw.source || "Mannings PDP 查詢門店庫存",
    disclaimer: "快照非即時庫存；請致電確認。",
    products: productsOut
  };

  var body = "window.DD_MANNINGS_STOCK = " + JSON.stringify(payload, null, 2) + ";\n";
  fs.writeFileSync(OUT_JS, banner + body, "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  var sumPath = rawPath.replace(/\.json$/i, "-summary.txt");
  fs.writeFileSync(
    sumPath,
    "Mannings HK store stock as of " +
      asOf +
      "\nOnly in-stock / low-stock. No quantities.\n\n" +
      summary.join("\n") +
      "\n",
    "utf8"
  );

  console.log("Wrote", OUT_JS);
  summary.forEach(function (line) {
    console.log(" ", line);
  });
}

main();
