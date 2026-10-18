(function () {
  "use strict";

  const products = window.DD_PRODUCTS || [];
  const stores = window.DD_STORES || { mannings: [], watsons: [] };
  const globalFaq = window.DD_GLOBAL_FAQ || {};
  const manningsStock = window.DD_MANNINGS_STOCK || {
    asOf: null,
    source: "missing",
    disclaimer: "尚未載入萬寧門店庫存快照。",
    products: {}
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const GROUP_ORDER = ["噴霧", "貼／卡", "空間", "其他"];

  let storeChannel = "mannings";
  let stockListExpanded = false;
  let stockListMode = "snapshot"; // "snapshot" | "directory"
  let storeRegion = ""; // "" | "hk" | "kln" | "nt"

  const REGION_LABEL = { "": "全部", hk: "香港", kln: "九龍", nt: "新界" };

  /** 18 區（去「區」字後）→ 香港／九龍／新界 */
  const DISTRICT_REGION = {
    中西: "hk",
    灣仔: "hk",
    東: "hk",
    南: "hk",
    油尖旺: "kln",
    深水埗: "kln",
    九龍城: "kln",
    黃大仙: "kln",
    觀塘: "kln",
    葵青: "nt",
    荃灣: "nt",
    屯門: "nt",
    元朗: "nt",
    北: "nt",
    大埔: "nt",
    沙田: "nt",
    西貢: "nt",
    離島: "nt"
  };

  function normalizeDistrict(d) {
    return String(d || "")
      .trim()
      .replace(/區$/u, "")
      .replace(/\s+/g, "");
  }

  function regionOfStore(s) {
    if (!s) return "";
    const r = String(s.region || "").trim();
    if (r === "hk" || r === "kln" || r === "nt") return r;
    if (r === "香港" || r === "香港島") return "hk";
    if (r === "九龍") return "kln";
    if (r === "新界" || r === "離島") return "nt";

    const d = normalizeDistrict(s.district);
    if (d && DISTRICT_REGION[d]) return DISTRICT_REGION[d];

    const addr = String(s.address || "").trim();
    if (/^離島/.test(addr) || addr.includes("離島")) return "nt";
    if (/^新界/.test(addr)) return "nt";
    if (/^九龍/.test(addr)) return "kln";
    if (/^香港/.test(addr)) return "hk";
    // 後備關鍵字（地址中段）
    if (/九龍/.test(addr)) return "kln";
    if (/新界|屯門|元朗|沙田|大埔|荃灣|葵涌|青衣|將軍澳|天水圍|上水|粉嶺|東涌|馬鞍山/.test(addr))
      return "nt";
    if (/中環|灣仔|銅鑼灣|北角|太古|香港仔|金鐘|上環|西環|柴灣|筲箕灣|薄扶林|赤柱/.test(addr))
      return "hk";
    return "";
  }

  function fmtTel(tel) {
    const d = String(tel || "").replace(/\D/g, "");
    if (d.length === 8) return d.slice(0, 4) + " " + d.slice(4);
    return tel || "";
  }

  function fmtAsOf(asOf) {
    if (!asOf) return null;
    const s = String(asOf).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }

  function getProductId() {
    return $("#productSelect")?.value || products[0]?.id;
  }

  function getProduct() {
    const id = getProductId();
    return products.find((p) => p.id === id) || products[0];
  }

  function setProductId(id, source) {
    if (!id || !products.some((p) => p.id === id)) return;
    const qa = $("#productSelect");
    const st = $("#storeProductSelect");
    if (qa && qa.value !== id) qa.value = id;
    if (st && st.value !== id) st.value = id;
    if (source !== "qa-meta-skip") {
      const prod = getProduct();
      renderProductMeta(prod);
      renderProductMeta(prod, "#storeProductMeta");
    }
    stockListExpanded = false;
    renderManningsStockPanel();
    if (storeChannel === "mannings") renderStores();
  }

  function renderProductMeta(p, targetId) {
    const el = $(targetId || "#productMeta");
    if (!el || !p) return;
    const tags = [];
    if (p.nonDeet) tags.push('<span class="tag ok">non-DEET</span>');
    if (p.noCamphorOfficial) tags.push('<span class="tag ok">官網：不含樟腦</span>');
    if (p.containsCamphor) tags.push('<span class="tag danger">含樟腦（第三方）</span>');
    if (p.riskFlag) tags.push('<span class="tag danger">需特別注意</span>');
    if (p.registration) tags.push(`<span class="tag">註冊 ${p.registration}</span>`);
    tags.push(`<span class="tag">${p.form}</span>`);
    tags.push(`<span class="tag">${p.volume}</span>`);

    const img = p.image
      ? `<img class="product-thumb" src="${p.image}" alt="${p.name}" width="96" height="96" loading="lazy" />`
      : "";

    el.innerHTML = `
      <div class="product-card-row">
        ${img}
        <div class="product-card-body">
          <strong>${p.name}</strong>
          <div>主要成份：${p.actives}</div>
          <div>適用年齡／用法對象：${p.age}</div>
          <div class="tag-row">${tags.join("")}</div>
        </div>
      </div>
    `;
  }

  function answerBoxClass(p, key) {
    if (key === "g6pd" && p.containsCamphor) return "answer danger-box";
    if (key === "g6pd") return "answer warn-box";
    if (key === "pregnant" && p.id === "usb-liquid") return "answer danger-box";
    if (key === "pet" && (p.id === "usb-liquid" || p.id === "usb-refill")) return "answer danger-box";
    if (p.riskFlag && (key === "ingredients" || key === "usage" || key === "skin")) return "answer warn-box";
    return "answer";
  }

  function buildAnswer(key) {
    const p = getProduct();
    if (!p) return { html: "請先選擇產品。", cls: "answer empty" };

    let body = "";
    let links = "";

    if (key === "g6pd") {
      body =
        `【${p.name}】蠶豆症（G6PD）相關說明\n\n` +
        `① 官網／已知標示：\n` +
        (p.containsCamphor
          ? `• 第三方藥房頁標示本產品含樟腦 1%＋薄荷腦 5% → 蠶豆症患者一般應避免。\n`
          : "") +
        (p.noCamphorOfficial
          ? `• 官網標明本產品不含樟腦；同時標明 non-DEET。\n`
          : p.containsCamphor
            ? `• 請以包裝標籤核實樟腦含量。\n`
            : `• 官網此頁未同時明確寫「不含樟腦」${p.camphorFlag ? "（" + p.camphorFlag + "）" : ""}。\n`) +
        (p.nonDeet ? `• 官網／已知：不含避蚊胺（non-DEET）。\n` : "") +
        `\n② 公開教育參考：\n` +
        `蠶豆症患者應避免樟腦等誘發物（消委會等公開教育，唔當醫療建議）。\n\n` +
        `③ 產品說明：\n${p.g6pdNote}\n\n` +
        `④ 請以包裝標籤為準，並諮詢醫生／藥劑師。`;
      if (globalFaq.g6pdIntro) {
        body += `\n\n—\n總覽：${globalFaq.g6pdIntro}`;
      }
    } else if (key === "deet") {
      body =
        `【${p.name}】有冇 DEET？\n\n` +
        (p.nonDeet
          ? `官網／已知資料：不含避蚊胺（non-DEET）。\n`
          : `請核實包裝標籤。〔待核標籤〕\n`) +
        (p.noCamphorOfficial ? `同時：官網標明不含樟腦。\n` : "") +
        (p.containsCamphor ? `注意：第三方頁標示含樟腦 1%（與 DEET 無關，但蠶豆症須注意）。\n` : "") +
        `\n主要成份：${p.actives}`;
    } else if (key === "age") {
      body =
        `【${p.name}】幾歲用得？\n\n` +
        `${p.age}\n\n` +
        `請依包裝年齡指示；嬰幼兒請在成人協助／監管下使用。`;
    } else if (key === "usage") {
      body =
        `【${p.name}】點用？\n\n` +
        `${p.usage}\n\n` +
        `劑型：${p.form}　容量／包裝：${p.volume}`;
      if (p.dengueNote) body += `\n\n備註：${p.dengueNote}`;
    } else if (key === "where") {
      const ch = p.channels || {};
      const snap = getSnapshotEntry(p.id);
      let manningsLine = ch.mannings
        ? "有售（請致電該舖確認庫存）"
        : "請向門店確認／未必有售";
      if (snap && typeof snap.storeCount === "number" && manningsStock.asOf) {
        manningsLine = `約 ${snap.storeCount} 間舖有貨（截至 ${fmtAsOf(manningsStock.asOf)}；請致電確認）`;
      } else if (p.manningsUrl) {
        manningsLine = "可查萬寧產品頁「查詢門店庫存」（非本頁即時庫存）";
      }
      body =
        `【${p.name}】邊度買？\n\n` +
        `• 萬寧：${manningsLine}\n` +
        `• 屈臣氏：${ch.watsons ? "有售（請致電該舖確認庫存）" : "請向門店確認／未必有售"}\n` +
        `• 其他渠道：${ch.others || "部分店有售／非全線（惠康／百佳／一田／AEON／莎莎／卡萊美／卓悅／松本清／HKTVmall 等）"}\n\n` +
        (globalFaq.buyIntro || "");
      links =
        `<a class="btn-link" href="#stores">去查萬寧／屈臣氏分店電話</a>` +
        (p.manningsUrl
          ? `<a class="btn-link" href="${p.manningsUrl}" target="_blank" rel="noopener">萬寧產品頁／查庫存</a>`
          : "") +
        `<a class="btn-link" href="${stores.officialRetail || "https://www.japandingding.com/"}" target="_blank" rel="noopener">官網零售點</a>`;
    } else if (key === "ingredients") {
      body =
        `【${p.name}】成份係咩？\n\n` +
        `主要成份：${p.actives}\n\n` +
        `官方／已知功效重點：\n` +
        (p.claims || []).map((c) => `• ${c}`).join("\n");
      if (p.registration) body += `\n\n香港除害劑註冊編號：${p.registration}`;
      if (p.sourceNote) body += `\n\n來源備註：${p.sourceNote}`;
      if (p.officialUrl) {
        links = `<a class="btn-link" href="${p.officialUrl}" target="_blank" rel="noopener">查看官網產品頁</a>`;
      }
    } else if (key === "skin") {
      body =
        `【${p.name}】可噴／搽皮膚嗎？\n\n` +
        (p.skinOk === true
          ? `可以（按官網用法）：${p.skinNote || "請依標籤用於皮膚。"}\n`
          : p.skinOk === false
            ? `唔建議／唔可以（按官網）：${p.skinNote || "本產品非皮膚噴劑／忌塗皮膚。"}\n`
            : `請核標籤。${p.skinNote || ""}〔待核標籤〕\n`) +
        `\n劑型：${p.form}`;
    } else if (key === "combine") {
      body =
        `【${p.name}】可同其他產品一齊用？\n\n` +
        (p.combineNote || "官網未列併用細節。請以標籤為準。〔待核標籤〕");
    } else if (key === "reg") {
      body =
        `【${p.name}】有冇註冊編號？\n\n` +
        (p.registration
          ? `香港除害劑註冊編號：${p.registration}（官網）\n`
          : `官網此頁未列出香港除害劑註冊編號（或部分外用舒緩產品可能唔屬除害劑註冊範圍）。請以包裝標籤為準。〔待核標籤〕\n`) +
        `\n主要成份：${p.actives}`;
      if (p.officialUrl) {
        links = `<a class="btn-link" href="${p.officialUrl}" target="_blank" rel="noopener">查看官網產品頁</a>`;
      }
    } else if (key === "pregnant") {
      body =
        `【${p.name}】孕婦／餵奶可用嗎？\n\n` +
        (p.pregnantNote || "官網若無寫則請以標籤為準並諮詢醫生。") +
        `\n\n—\n${globalFaq.pregnantIntro || "請以標籤為準並諮詢醫生。"}`;
    } else if (key === "freq") {
      body =
        `【${p.name}】幾耐一次？\n\n` +
        (p.freqNote || p.usage || "請以標籤為準。") +
        `\n\n完整用法：\n${p.usage}`;
    } else if (key === "pet") {
      body =
        `【${p.name}】寵物安全嗎？\n\n` +
        (p.petNote || "官網未寫寵物專用指引。請以標籤為準。") +
        `\n\n—\n${globalFaq.petIntro || ""}`;
    } else {
      body = "請選擇問題。";
    }

    const meta =
      (p.officialUrl
        ? `<div class="meta">資料參考：官網產品頁（請以最新標籤為準）</div>`
        : `<div class="meta">請以包裝標籤及官網為準</div>`) + links;

    return {
      html: body + meta,
      cls: answerBoxClass(p, key)
    };
  }

  function showAnswer(key) {
    const box = $("#answerPanel");
    if (!box) return;
    const { html, cls } = buildAnswer(key);
    box.className = cls;
    box.innerHTML = html.replace(/\n/g, "<br>");
    $$(".chip[data-q]").forEach((c) => c.classList.toggle("active", c.dataset.q === key));
  }

  function productOptionsHtml() {
    const byGroup = {};
    products.forEach((p) => {
      const g = p.group || "其他";
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(p);
    });

    const parts = [];
    GROUP_ORDER.forEach((g) => {
      const list = byGroup[g];
      if (!list || !list.length) return;
      parts.push(
        `<optgroup label="${g}">` +
          list
            .map((p) => {
              const flag = p.containsCamphor ? " ⚠" : "";
              return `<option value="${p.id}">${p.name}${flag}</option>`;
            })
            .join("") +
          `</optgroup>`
      );
    });
    Object.keys(byGroup).forEach((g) => {
      if (GROUP_ORDER.includes(g)) return;
      parts.push(
        `<optgroup label="${g}">` +
          byGroup[g]
            .map((p) => {
              const flag = p.containsCamphor ? " ⚠" : "";
              return `<option value="${p.id}">${p.name}${flag}</option>`;
            })
            .join("") +
          `</optgroup>`
      );
    });
    return parts.join("");
  }

  function fillProductSelects() {
    const html = productOptionsHtml();
    const qa = $("#productSelect");
    const st = $("#storeProductSelect");
    if (qa) qa.innerHTML = html;
    if (st) st.innerHTML = html;
    const prod = getProduct();
    renderProductMeta(prod);
    renderProductMeta(prod, "#storeProductMeta");
  }

  function getSnapshotEntry(productId) {
    const map = manningsStock.products || {};
    return map[productId] || null;
  }

  function hasUsableSnapshot(entry) {
    if (!entry) return false;
    if (!manningsStock.asOf) return false;
    if (typeof entry.storeCount !== "number") return false;
    if (!Array.isArray(entry.stores)) return false;
    return true;
  }

  function renderManningsStockPanel() {
    const panel = $("#manningsStockPanel");
    if (!panel) return;
    const p = getProduct();
    if (!p) {
      panel.innerHTML = "";
      return;
    }

    const entry = getSnapshotEntry(p.id);
    const asOf = fmtAsOf(manningsStock.asOf);
    const url = (entry && entry.manningsUrl) || p.manningsUrl || null;

    if (hasUsableSnapshot(entry)) {
      const n = entry.storeCount;
      const listId = "stockStoreList";
      panel.innerHTML = `
        <div class="stock-summary">
          <p class="stock-headline">
            <strong>萬寧：約 ${n} 間舖有貨</strong>
            <span class="stock-asof">（截至 ${asOf}；請致電確認）</span>
          </p>
          <p class="stock-disclaimer">此為門店庫存快照，<strong>非</strong>即時庫存；到舖前請再致電。</p>
          <div class="stock-actions">
            <button type="button" class="chip expand-chip" id="toggleStockList" aria-expanded="${stockListExpanded}" aria-controls="${listId}">
              ${stockListExpanded ? "收起有貨舖名單 ▲" : "展開有貨舖名單（店名／電話／地址）▼"}
            </button>
            ${
              url
                ? `<a class="btn-link" href="${url}" target="_blank" rel="noopener">萬寧產品頁「查詢門店庫存」</a>`
                : ""
            }
          </div>
          <div id="${listId}" class="stock-expand ${stockListExpanded ? "" : "hidden"}"></div>
        </div>`;
      if (stockListExpanded) renderExpandedStockList(entry.stores || []);
      $("#toggleStockList")?.addEventListener("click", () => {
        stockListMode = "snapshot";
        stockListExpanded = !stockListExpanded;
        renderManningsStockPanel();
        if (storeChannel === "mannings") renderStores();
      });
      return;
    }

    // Fallback: no snapshot for this product
    const disclaimer = manningsStock.disclaimer || "尚未載入萬寧門店庫存快照。";
    stockListMode = "directory";
    stockListExpanded = false;
    panel.innerHTML = `
      <div class="stock-summary fallback">
        <p class="stock-headline"><strong>萬寧：暫未有「該產品有貨舖數」快照</strong></p>
        <p class="stock-disclaimer">${disclaimer}</p>
        <div class="stock-actions">
          ${
            url
              ? `<a class="btn-link" href="${url}" target="_blank" rel="noopener">去萬寧產品頁「查詢門店庫存」</a>`
              : `<span class="muted-inline">此產品暫未對應萬寧產品頁連結</span>`
          }
        </div>
        <p class="directory-warn">下方係<strong>萬寧分店電話簿</strong>（約 ${(stores.mannings || []).length} 間），<strong>唔代表</strong>該產品一定有貨——請致電查詢或用上方連結查庫存。</p>
      </div>`;
  }

  function applyStoreFilters(list) {
    const q = ($("#storeSearch")?.value || "").trim().toLowerCase();
    const district = $("#districtSelect")?.value || "";
    return (list || []).filter((s) => {
      if (storeRegion && regionOfStore(s) !== storeRegion) return false;
      if (district && (s.district || "") !== district) return false;
      if (!q) return true;
      const blob = `${s.name || ""} ${s.address || ""} ${s.district || ""} ${s.tel || ""} ${s.stockStatus || ""} ${REGION_LABEL[regionOfStore(s)] || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  function renderExpandedStockList(list) {
    const box = $("#stockStoreList");
    if (!box) return;
    let filtered = applyStoreFilters(list);
    if (!filtered.length) {
      box.innerHTML = `<div class="other-box">快照名單中搵唔到符合篩選嘅舖。可清空搜尋，或直接去萬寧產品頁查庫存。</div>`;
      return;
    }
    box.innerHTML = filtered
      .map(
        (s) => `
      <article class="store-card stock-hit">
        <h4>${s.name || "萬寧分店"}</h4>
        <p class="addr">${s.district ? s.district + "　" : ""}${s.address || ""}</p>
        ${
          s.tel
            ? `<a class="tel-btn" href="tel:${String(s.tel).replace(/\D/g, "")}">📞 ${fmtTel(s.tel)}</a>`
            : `<span class="muted-inline">電話待補</span>`
        }
        <p class="note">${s.stockStatus ? `快照：${s.stockStatus} — 請致電確認（非即時庫存）` : "快照標示可能有貨 — 請致電確認（非即時庫存）"}</p>
      </article>`
      )
      .join("");
  }

  /* ---- Stores ---- */

  function districtsFor(list) {
    const scoped = storeRegion
      ? list.filter((s) => regionOfStore(s) === storeRegion)
      : list;
    const set = new Set(scoped.map((s) => s.district).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }

  function currentStoreList() {
    if (storeChannel === "mannings") {
      const p = getProduct();
      const entry = p ? getSnapshotEntry(p.id) : null;
      if (
        storeChannel === "mannings" &&
        stockListExpanded &&
        stockListMode === "snapshot" &&
        hasUsableSnapshot(entry)
      ) {
        return entry.stores || [];
      }
      return stores.mannings || [];
    }
    if (storeChannel === "watsons") return stores.watsons || [];
    return [];
  }

  function refreshDistrictOptions() {
    const dist = $("#districtSelect");
    if (!dist) return;
    const list = currentStoreList();
    const ds = districtsFor(list);
    const prev = dist.value;
    dist.innerHTML =
      `<option value="">全部地區</option>` +
      ds.map((d) => `<option value="${d}">${d}</option>`).join("");
    if (ds.includes(prev)) dist.value = prev;
  }

  function renderStores() {
    const listEl = $("#storeList");
    const countEl = $("#storeCount");
    const otherEl = $("#otherChannels");
    const filtersEl = $("#storeFilters");
    const noteEl = $("#directoryNote");
    if (!listEl) return;

    if (storeChannel === "other") {
      filtersEl?.classList.add("hidden");
      listEl.classList.add("hidden");
      if (countEl) countEl.textContent = "";
      if (noteEl) noteEl.innerHTML = "";
      otherEl?.classList.remove("hidden");
      return;
    }

    filtersEl?.classList.remove("hidden");
    listEl.classList.remove("hidden");
    otherEl?.classList.add("hidden");

    const p = getProduct();
    const entry = p ? getSnapshotEntry(p.id) : null;
    const usingSnapshot =
      storeChannel === "mannings" &&
      stockListExpanded &&
      stockListMode === "snapshot" &&
      hasUsableSnapshot(entry);

    if (noteEl) {
      if (storeChannel === "mannings" && usingSnapshot) {
        noteEl.innerHTML = `<strong>顯示中：</strong>快照標示「可能有貨」嘅萬寧舖（截至 ${fmtAsOf(manningsStock.asOf)}）。`;
        noteEl.className = "directory-note ok-note";
        noteEl.dataset.open = "1";
      } else if (storeChannel === "mannings") {
        const mCount = (stores.mannings || []).length;
        noteEl.innerHTML =
          `<strong>萬寧分店電話簿（約 ${mCount} 間）</strong>——公開目錄整理，<strong>非</strong>該產品有貨舖數。` +
          ` 若上方有快照，請撳「展開有貨舖名單」。` +
          (p?.manningsUrl
            ? ` 或 <a href="${p.manningsUrl}" target="_blank" rel="noopener">去萬寧產品頁查庫存</a>。`
            : "") +
          (stores.manningsLocator
            ? ` <a href="${stores.manningsLocator}" target="_blank" rel="noopener">官方分店搜尋</a>`
            : "");
        noteEl.className = "directory-note warn-note";
        noteEl.dataset.open = stockListExpanded && stockListMode === "directory" ? "1" : "0";
      } else {
        const wCount = (stores.watsons || []).length;
        noteEl.innerHTML =
          `<strong>屈臣氏電話簿（約 ${wCount} 間）</strong>——公開目錄整理，<strong>非</strong>該產品有貨舖數；本頁無屈臣氏庫存快照。請致電確認。` +
          (stores.watsonsLocator
            ? ` <a href="${stores.watsonsLocator}" target="_blank" rel="noopener">官方分店搜尋</a>`
            : "");
        noteEl.className = "directory-note warn-note";
        noteEl.dataset.open = "1";
      }
    }

    // When mannings + snapshot expanded, prefer rendering inside stock panel list;
    // still mirror into main list for filter UX.
    if (usingSnapshot) {
      renderExpandedStockList(entry.stores || []);
    }

    let list = applyStoreFilters(currentStoreList());
    const regionName = REGION_LABEL[storeRegion] || "全部";

    if (countEl) {
      if (storeChannel === "watsons") {
        countEl.textContent = `${regionName}：約 ${list.length} 間屈臣氏分店（電話簿，非該產品有貨舖數）`;
      } else if (usingSnapshot) {
        countEl.textContent = `${regionName}：約 ${list.length} 間快照「可能有貨」舖（截至 ${fmtAsOf(manningsStock.asOf)}；請致電確認）`;
      } else {
        countEl.textContent = `${regionName}：萬寧分店電話簿約 ${list.length} 間（非該產品有貨舖數）`;
      }
    }

    if (!list.length) {
      listEl.innerHTML =
        `<div class="other-box">搵唔到分店。可改關鍵字，或去官方分店搜尋：` +
        (storeChannel === "mannings"
          ? `<a href="${stores.manningsLocator}" target="_blank" rel="noopener">萬寧分店位置</a>`
          : `<a href="${stores.watsonsLocator}" target="_blank" rel="noopener">屈臣氏分店位置</a>`) +
        `</div>`;
      return;
    }

    const fallbackNote = usingSnapshot
      ? "快照標示可能有貨 — 請致電確認（非即時庫存）"
      : storeChannel === "mannings"
        ? "電話簿分店 — 唔代表此產品有貨；請致電確認"
        : "電話簿分店 — 唔代表此產品有貨；請致電確認";

    listEl.innerHTML = list
      .map(
        (s) => `
      <article class="store-card${usingSnapshot ? " stock-hit" : ""}">
        <h4>${s.name}</h4>
        <p class="addr">${s.district ? s.district + "　" : ""}${s.address || ""}</p>
        ${
          s.tel
            ? `<a class="tel-btn" href="tel:${String(s.tel).replace(/\D/g, "")}">📞 ${fmtTel(s.tel)}</a>`
            : `<span class="muted-inline">電話待補</span>`
        }
        <p class="note">${usingSnapshot && s.stockStatus ? `快照：${s.stockStatus} — 請致電確認（非即時庫存）` : fallbackNote}</p>
      </article>`
      )
      .join("");
  }

  function setChannel(ch) {
    storeChannel = ch;
    $$(".seg button").forEach((b) =>
      b.classList.toggle("active", b.dataset.channel === ch)
    );
    refreshDistrictOptions();
    renderManningsStockPanel();
    renderStores();
  }

  function setRegion(region) {
    storeRegion = region || "";
    $$("#regionChips .region-chip").forEach((b) => {
      const on = (b.dataset.region || "") === storeRegion;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // 換分區時重置細分地區，避免選咗唔屬於呢區嘅值
    const dist = $("#districtSelect");
    if (dist) dist.value = "";
    refreshDistrictOptions();
    if (stockListExpanded && stockListMode === "snapshot") {
      const entry = getSnapshotEntry(getProductId());
      if (hasUsableSnapshot(entry)) renderExpandedStockList(entry.stores || []);
    }
    renderStores();
  }

  /* ---- Tabs ---- */
  function showView(name) {
    $("#view-qa")?.classList.toggle("hidden", name !== "qa");
    $("#view-stores")?.classList.toggle("hidden", name !== "stores");
    $$(".nav-tabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === name)
    );
    if (name === "stores") {
      // sync store select from QA
      const id = getProductId();
      const st = $("#storeProductSelect");
      if (st && id) st.value = id;
      renderManningsStockPanel();
      refreshDistrictOptions();
      renderStores();
    }
  }

  function init() {
    fillProductSelects();

    $("#productSelect")?.addEventListener("change", () => {
      setProductId($("#productSelect").value, "qa");
      const active = $(".chip.active[data-q]");
      if (active) showAnswer(active.dataset.q);
      else {
        const box = $("#answerPanel");
        if (box) {
          box.className = "answer empty";
          box.textContent = "揀咗產品後，撳下面問題掣即睇答案。";
        }
      }
    });

    $("#storeProductSelect")?.addEventListener("change", () => {
      setProductId($("#storeProductSelect").value, "stores");
      refreshDistrictOptions();
      renderStores();
    });

    $$(".chip[data-q]").forEach((chip) => {
      chip.addEventListener("click", () => showAnswer(chip.dataset.q));
    });

    $("#goStoresBtn")?.addEventListener("click", () => {
      location.hash = "#stores";
      showView("stores");
    });

    $$(".nav-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        location.hash = v === "stores" ? "#stores" : "#qa";
        showView(v);
      });
    });

    if (location.hash === "#stores") showView("stores");
    window.addEventListener("hashchange", () => {
      if (location.hash === "#stores") showView("stores");
      if (location.hash === "#qa" || location.hash === "") showView("qa");
    });

    $$(".seg button").forEach((btn) => {
      btn.addEventListener("click", () => setChannel(btn.dataset.channel));
    });
    $$("#regionChips .region-chip").forEach((btn) => {
      btn.addEventListener("click", () => setRegion(btn.dataset.region || ""));
    });
    $("#districtSelect")?.addEventListener("change", () => {
      if (stockListExpanded && stockListMode === "snapshot") {
        const entry = getSnapshotEntry(getProductId());
        if (hasUsableSnapshot(entry)) renderExpandedStockList(entry.stores || []);
      }
      renderStores();
    });
    $("#storeSearch")?.addEventListener("input", () => {
      if (stockListExpanded && stockListMode === "snapshot") {
        const entry = getSnapshotEntry(getProductId());
        if (hasUsableSnapshot(entry)) renderExpandedStockList(entry.stores || []);
      }
      renderStores();
    });

    renderManningsStockPanel();
    refreshDistrictOptions();
    setChannel("mannings");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
