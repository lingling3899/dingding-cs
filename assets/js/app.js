(function () {
  "use strict";

  const products = window.DD_PRODUCTS || [];
  const stores = Object.assign(
    { mannings: [], watsons: [] },
    window.DD_STORES || {},
    window.DD_EXTRA_STORES || {}
  );

  const PHONEBOOK_CHANNELS = {
    mannings: { label: "萬寧", locatorKey: "manningsLocator" },
    watsons: { label: "屈臣氏", locatorKey: "watsonsLocator" },
    matsukiyo: { label: "松本清", locatorKey: "matsukiyoLocator" },
    sasa: { label: "莎莎", locatorKey: "sasaLocator" },
    aeon: { label: "AEON", locatorKey: "aeonLocator" },
    parknshop: { label: "百佳", locatorKey: "parknshopLocator" },
    wellcome: { label: "惠康", locatorKey: "wellcomeLocator" },
    colourmix: { label: "卡萊美", locatorKey: "colourmixLocator" },
    soda: { label: "Soda Mall", locatorKey: "sodaLocator" },
    wingon: { label: "永安", locatorKey: "wingonLocator" },
    sincere: { label: "先施", locatorKey: "sincereLocator" }
  };
  const globalFaq = window.DD_GLOBAL_FAQ || {};
  const manningsStock = window.DD_MANNINGS_STOCK || {
    asOf: null,
    source: "missing",
    disclaimer: "尚未載入萬寧門店庫存快照。",
    products: {}
  };
  const watsonsStock = window.DD_WATSONS_STOCK || {
    asOf: null,
    source: "missing",
    disclaimer: "尚未載入屈臣氏門店庫存快照。覆蓋約 177 間，非電話簿全部。",
    products: {}
  };
  const STOCK_CHANNELS = {
    mannings: {
      key: "mannings",
      label: "萬寧",
      root: manningsStock,
      codeField: "manningsCode",
      urlField: "manningsUrl",
      productUrlField: "manningsUrl",
      coverageNote: null
    },
    watsons: {
      key: "watsons",
      label: "屈臣氏",
      root: watsonsStock,
      codeField: "watsonsCode",
      urlField: "watsonsUrl",
      productUrlField: "watsonsUrl",
      coverageNote: "屈臣氏庫存查詢覆蓋約 177 間，非電話簿全部"
    }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const GROUP_ORDER = ["噴霧", "貼／卡", "空間", "其他"];

  const BUILTIN_FAQ = [
    { key: "g6pd", icon: "🩸", label: "蠶豆症" },
    { key: "deet", icon: "🚫", label: "DEET" },
    { key: "age", icon: "👶", label: "年齡" },
    { key: "usage", icon: "🧴", label: "用法" },
    { key: "where", icon: "🛒", label: "邊度買" },
    { key: "ingredients", icon: "🧪", label: "成份" },
    { key: "skin", icon: "✋", label: "皮膚" },
    { key: "combine", icon: "🔗", label: "一齊用" },
    { key: "reg", icon: "📋", label: "註冊" },
    { key: "pregnant", icon: "🤰", label: "孕婦" },
    { key: "freq", icon: "⏰", label: "次數" },
    { key: "pet", icon: "🐾", label: "寵物" }
  ];

  let faqShowHidden = false;
  let rsShowHidden = false;
  let blogShowHidden = false;
  let activeFaqKey = null;
  let activeBlogId = null;

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


  function mapsUrl(s) {
    if (!s) return "";
    const name = String(s.name || "").trim();
    const address = String(s.address || "").trim();
    if (!name && !address) return "";
    const q = [name, s.district, address].filter(Boolean).join(" ");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  function storeActionsHtml(s, telFallbackHtml) {
    const telHtml = s.tel
      ? `<a class="tel-btn" href="tel:${String(s.tel).replace(/\D/g, "")}">📞 ${fmtTel(s.tel)}</a>`
      : telFallbackHtml;
    const url = mapsUrl(s);
    const mapHtml = url
      ? `<a class="map-btn" href="${url}" target="_blank" rel="noopener">📍 地圖</a>`
      : "";
    return `<div class="store-actions">${telHtml}${mapHtml}</div>`;
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
      renderStaffIngredientPanel(prod);
    }
    preferSnapshotIfAvailable();
    renderChannelStockPanel();
    renderStores();
  }

  function renderProductMeta(p, targetId) {
    const el = $(targetId || "#productMeta");
    if (!el || !p) return;
    const tags = [];
    if (p.nonDeet) tags.push('<span class="tag ok">non-DEET</span>');
    if (p.noCamphorOfficial) tags.push('<span class="tag ok">不含樟腦</span>');
    if (p.containsCamphor) tags.push('<span class="tag danger">含樟腦（第三方）</span>');
    if (p.riskFlag) tags.push('<span class="tag danger">需特別注意</span>');
    if (p.registration) tags.push(`<span class="tag">註冊 ${p.registration}</span>`);
    tags.push(`<span class="tag">${p.form}</span>`);
    tags.push(`<span class="tag">${p.volume}</span>`);

    const img = p.image
      ? `<img class="product-thumb" src="${p.image}" alt="${p.name}" width="96" height="96" loading="lazy" />`
      : "";

    const stockLines = [];
    ["mannings", "watsons"].forEach((ch) => {
      const meta = stockChannelMeta(ch);
      const entry = getSnapshotEntry(p.id, ch);
      if (hasUsableSnapshot(entry, ch)) {
        const asOf = fmtAsOf(channelAsOf(ch));
        const cover = meta.coverageNote ? `；${meta.coverageNote}` : "";
        stockLines.push(
          `<p class="pc-meta stock-line" style="margin-top:6px"><strong>${meta.label}約 ${entry.storeCount} 間舖有貨</strong>（截至 ${asOf}${cover}；快照非即時；唔顯示件數）</p>`
        );
      }
    });

    el.innerHTML = `
      <div class="product-card-row">
        ${img}
        <div class="product-card-body">
          <strong>${p.name}</strong>
          <div>主要成份：${p.actives}</div>
          <div>適用年齡／用法對象：${p.age}</div>
          <div class="tag-row">${tags.join("")}</div>
          ${stockLines.join("")}
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

  function isStaff() {
    return !!(window.DDAdminAuth && window.DDAdminAuth.isLoggedIn());
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function staffIngredientCardsHtml(p) {
    if (!p || !Array.isArray(p.ingredientDetails) || !p.ingredientDetails.length) return "";
    return (
      '<div class="sip-ing-grid">' +
      p.ingredientDetails
        .map((ing) => {
          const role = String(ing.role || "");
          const warn = /⚠|注意|樟腦|排除|毒性/.test(role + (ing.note || "") + (ing.detail || ""));
          const roleCls = warn ? "sip-role warn" : "sip-role";
          let html =
            '<article class="sip-ing-card">' +
            '<div class="sip-ing-top">' +
            '<span class="sip-ing-name">' +
            escapeHtml(ing.name) +
            "</span>" +
            (role ? '<span class="' + roleCls + '">' + escapeHtml(role) + "</span>" : "") +
            "</div>" +
            '<p class="sip-ing-detail">' +
            escapeHtml(ing.detail || "") +
            "</p>";
          if (ing.benefit) {
            html += '<p class="sip-ing-benefit">好處：' + escapeHtml(ing.benefit) + "</p>";
          }
          if (ing.note) {
            html += '<p class="sip-ing-note">注意：' + escapeHtml(ing.note) + "</p>";
          }
          html += "</article>";
          return html;
        })
        .join("") +
      "</div>"
    );
  }

  function staffBenefitsListHtml(p) {
    if (!p || !Array.isArray(p.benefits) || !p.benefits.length) return "";
    return (
      '<ul class="sip-benefits">' +
      p.benefits.map((b) => "<li>" + escapeHtml(b) + "</li>").join("") +
      "</ul>"
    );
  }

  function renderStaffIngredientPanel(p) {
    const el = $("#staffIngredientPanel");
    if (!el) return;
    const logged = isStaff();
    el.classList.toggle("hidden", !logged);
    el.classList.toggle("admin-only", true);
    if (!logged) {
      el.innerHTML = "";
      return;
    }
    if (!p) {
      el.innerHTML = '<p class="sip-empty">請先揀產品。</p>';
      return;
    }
    const cards = staffIngredientCardsHtml(p);
    const bens = staffBenefitsListHtml(p);
    if (!cards && !bens) {
      el.innerHTML =
        '<div class="sip-head"><span class="staff-badge">職員</span> 成份詳述／優點</div>' +
        '<p class="sip-empty">呢款暫時未有拆解資料。</p>';
      return;
    }
    el.innerHTML =
      '<div class="sip-head"><span class="staff-badge">職員</span> 成份詳述／優點（職員）</div>' +
      '<p class="sip-sub">CS 話術拆解 · 訪客睇唔到 · 請以包裝標籤為準，唔好發明療效保證</p>' +
      (cards ? '<div class="sip-section-title">成份</div>' + cards : "") +
      (bens ? '<div class="sip-section-title">優點</div>' + bens : "");
  }

  function staffIngredientAnswerHtml(p) {
    if (!isStaff() || !p) return "";
    const cards = staffIngredientCardsHtml(p);
    const bens = staffBenefitsListHtml(p);
    if (!cards && !bens) return "";
    return (
      '<div class="staff-ing-answer" role="note">' +
      '<strong><span class="staff-badge">職員</span> 成份／優點拆解</strong>' +
      (cards ? '<div class="sip-section-title">成份</div>' + cards : "") +
      (bens ? '<div class="sip-section-title">優點</div>' + bens : "") +
      "</div>"
    );
  }

  function staffAnswerBlock(key, p) {
    if (!isStaff() || !p) return "";
    const g = globalFaq || {};
    const bits = [];
    if (key === "pet") {
      if (p.staffPetNote) bits.push(p.staffPetNote);
      if (g.staffPetIntro) bits.push("總覽：" + g.staffPetIntro);
    } else if (key === "pregnant") {
      if (p.staffPregnantNote) bits.push(p.staffPregnantNote);
      if (g.staffPregnantIntro) bits.push("總覽：" + g.staffPregnantIntro);
    } else if (key === "combine") {
      if (p.staffCombineNote) bits.push(p.staffCombineNote);
    } else if (key === "g6pd") {
      if (p.staffG6pdNote) bits.push(p.staffG6pdNote);
      if (p.staffCamphorFlag) bits.push("樟腦標示：" + p.staffCamphorFlag);
      if (g.staffG6pdIntro) bits.push("總覽：" + g.staffG6pdIntro);
    } else if (key === "deet" || key === "ingredients" || key === "reg") {
      if (p.staffG6pdNote && (key === "deet" || key === "ingredients")) bits.push(p.staffG6pdNote);
      if (p.staffCamphorFlag) bits.push("樟腦標示：" + p.staffCamphorFlag);
    } else if (key === "age" && p.staffAge) {
      bits.push(p.staffAge);
    } else if (key === "usage" && p.staffDengueNote) {
      bits.push(p.staffDengueNote);
    }
    if (!bits.length) return "";
    return (
      '<div class="staff-answer-note" role="note">' +
      '<strong><span class="staff-badge">職員</span> 職員備註</strong>（訪客睇唔到）' +
      '<div class="staff-answer-body">' +
      bits.map((b) => escapeHtml(b)).join("\n\n").replace(/\n/g, "<br>") +
      "</div></div>"
    );
  }

  function buildAnswer(key) {
    const cms = window.DDCms;
    if (cms && String(key || "").startsWith("custom:")) {
      const id = String(key).slice(7);
      const item = cms.getFaqCustomById(id);
      if (!item) return { html: "呢條自訂問題已唔見咗。", cls: "answer empty" };
      const p0 = getProduct();
      const title = p0 ? "【" + p0.name + "】" : "";
      const staffMeta = isStaff()
        ? '<div class="meta">職員新增答案（本機儲存）</div>'
        : "";
      return {
        html: title + item.label + "\n\n" + item.answer + staffMeta,
        cls: "answer"
      };
    }

    const p = getProduct();
    if (!p) return { html: "請先選擇產品。", cls: "answer empty" };

    let body = "";
    let links = "";

    if (key === "g6pd") {
      body =
        `【${p.name}】蠶豆症（G6PD）相關說明\n\n` +
        `${p.g6pdNote}`;
      if (globalFaq.g6pdIntro) {
        body += `\n\n—\n${globalFaq.g6pdIntro}`;
      }
    } else if (key === "deet") {
      body =
        `【${p.name}】有冇 DEET？\n\n` +
        (p.nonDeet
          ? `不含避蚊胺（non-DEET）。\n`
          : `請核對包裝標籤是否含避蚊胺（DEET）。\n`) +
        (p.noCamphorOfficial ? `同時：不含樟腦。\n` : "") +
        (p.containsCamphor ? `注意：本產品含樟腦（與 DEET 無關，但蠶豆症須注意）。\n` : "") +
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
      const salesPoints =
        "萬寧、屈臣氏、松本清、莎莎、AEON、百佳、惠康、卡萊美、Soda Mall、永安、先施、各大藥房";
      body =
        `【${p.name}】邊度買？\n\n` +
        `銷售點：${salesPoints} 等（部分店有售、非全線）。\n\n` +
        (globalFaq.buyIntro || "");
      links =
        `<a class="btn-link" href="#stores">去門店查貨</a>` +
        `<a class="btn-link" href="${stores.officialRetail || "https://www.japandingding.com/"}" target="_blank" rel="noopener">官網零售點</a>`;
    } else if (key === "ingredients") {
      body =
        `【${p.name}】成份係咩？\n\n` +
        `主要成份：${p.actives}\n\n` +
        `功效重點：\n` +
        (p.claims || []).map((c) => `• ${c}`).join("\n");
      if (p.registration) body += `\n\n香港除害劑註冊編號：${p.registration}`;
      if (p.sourceNote && isStaff()) body += `\n\n來源備註：${p.sourceNote}`;
      if (p.officialUrl) {
        links = `<a class="btn-link" href="${p.officialUrl}" target="_blank" rel="noopener">查看產品頁</a>`;
      }
    } else if (key === "skin") {
      body =
        `【${p.name}】可噴／搽皮膚嗎？\n\n` +
        (p.skinOk === true
          ? `可以：${p.skinNote || "請依標籤用於皮膚。"}\n`
          : p.skinOk === false
            ? `唔建議／唔可以：${p.skinNote || "本產品非皮膚噴劑／忌塗皮膚。"}\n`
            : `請跟包裝標籤。${p.skinNote || ""}\n`) +
        `\n劑型：${p.form}`;
    } else if (key === "combine") {
      body =
        `【${p.name}】可同其他產品一齊用？\n\n` +
        (p.combineNote || "一般建議唔同時大面積疊用唔同驅蚊／外用品；請跟標籤。");
    } else if (key === "reg") {
      body =
        `【${p.name}】有冇註冊編號？\n\n` +
        (p.registration
          ? `香港除害劑註冊編號：${p.registration}\n`
          : `呢款未必屬香港除害劑註冊範圍（外用舒緩類常見）；請以包裝標示為準。\n`) +
        `\n主要成份：${p.actives}`;
      if (p.officialUrl) {
        links = `<a class="btn-link" href="${p.officialUrl}" target="_blank" rel="noopener">查看產品頁</a>`;
      }
    } else if (key === "pregnant") {
      body =
        `【${p.name}】孕婦／餵奶可用嗎？\n\n` +
        (p.pregnantNote || "請跟包裝標籤，並諮詢醫生／藥劑師。") +
        `\n\n—\n${globalFaq.pregnantIntro || "請跟包裝標籤，並諮詢醫生／藥劑師。"}`;
    } else if (key === "freq") {
      body =
        `【${p.name}】幾耐一次？\n\n` +
        (p.freqNote || p.usage || "請跟標籤。") +
        `\n\n完整用法：\n${p.usage}`;
    } else if (key === "pet") {
      body =
        `【${p.name}】寵物安全嗎？\n\n` +
        (p.petNote || "請勿直接用於寵物；請跟包裝用法。") +
        `\n\n—\n${globalFaq.petIntro || ""}`;
    } else {
      body = "請選擇問題。";
    }

    const meta =
      (p.officialUrl
        ? `<div class="meta">資料參考：官網產品頁（請以最新標籤為準）</div>`
        : `<div class="meta">請以包裝標籤為準</div>`) + links;

    const staffHtml = staffAnswerBlock(key, p);
    const staffIngHtml = key === "ingredients" ? staffIngredientAnswerHtml(p) : "";

    return {
      html: body + meta + staffHtml + staffIngHtml,
      cls: answerBoxClass(p, key)
    };
  }

  function showAnswer(key) {
    const box = $("#answerPanel");
    if (!box) return;
    activeFaqKey = key;
    const { html, cls } = buildAnswer(key);
    box.className = cls;
    box.innerHTML = html.replace(/\n/g, "<br>");
    $$(".faq-card[data-q]").forEach((c) => c.classList.toggle("active", c.dataset.q === key));
  }

  function cms() {
    return window.DDCms || null;
  }

  function renderFaqGrid() {
    const grid = $("#faqGrid");
    if (!grid) return;
    const c = cms();
    const logged = !!(auth() && auth().isLoggedIn());
    const hidden = c ? c.getFaqHidden() : [];
    const parts = [];

    BUILTIN_FAQ.forEach((item) => {
      const isHid = hidden.indexOf(item.key) !== -1;
      if (isHid && !(logged && faqShowHidden)) return;
      const active = activeFaqKey === item.key ? " active" : "";
      const hidCls = isHid ? " is-hidden-admin" : "";
      let ops = "";
      if (logged) {
        ops =
          '<span class="faq-admin-ops">' +
          '<button type="button" data-faq-hide="' +
          item.key +
          '" aria-label="' +
          (isHid ? "顯示" : "隱藏") +
          '">' +
          (isHid ? "顯示" : "隱藏") +
          "</button></span>";
      }
      parts.push(
        '<button type="button" class="faq-card' +
          active +
          hidCls +
          '" data-q="' +
          item.key +
          '"><span class="faq-ico" aria-hidden="true">' +
          item.icon +
          '</span><span class="faq-label">' +
          item.label +
          "</span>" +
          ops +
          "</button>"
      );
    });

    const customs = c ? c.getFaqCustom() : [];
    customs.forEach((item) => {
      const q = "custom:" + item.id;
      const active = activeFaqKey === q ? " active" : "";
      let ops = "";
      if (logged) {
        ops =
          '<span class="faq-admin-ops">' +
          '<button type="button" data-faq-del="' +
          item.id +
          '" aria-label="刪除">刪除</button></span>';
      }
      parts.push(
        '<button type="button" class="faq-card' +
          active +
          '" data-q="' +
          q +
          '"><span class="faq-ico" aria-hidden="true">' +
          (item.icon || "❓") +
          '</span><span class="faq-label">' +
          escapeHtml(item.label) +
          "</span>" +
          ops +
          "</button>"
      );
    });

    grid.innerHTML = parts.join("") || '<p class="count">暫時冇可見問題。</p>';
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
    renderStaffIngredientPanel(prod);
  }

  function stockChannelMeta(channel) {
    return STOCK_CHANNELS[channel || storeChannel] || null;
  }

  function stockRoot(channel) {
    const meta = stockChannelMeta(channel);
    return (meta && meta.root) || { asOf: null, products: {} };
  }

  function channelAsOf(channel) {
    const root = stockRoot(channel);
    const ch = channel || storeChannel;
    if (ch === "mannings" && root.manningsAsOf) return root.manningsAsOf;
    if (ch === "watsons" && root.watsonsAsOf) return root.watsonsAsOf;
    return root.asOf || "";
  }

  function getSnapshotEntry(productId, channel) {
    const map = stockRoot(channel).products || {};
    return map[productId] || null;
  }

  function hasUsableSnapshot(entry, channel) {
    if (!entry) return false;
    if (!channelAsOf(channel)) return false;
    if (typeof entry.storeCount !== "number") return false;
    if (!Array.isArray(entry.stores)) return false;
    return true;
  }

  function isStockChannel(ch) {
    return !!(STOCK_CHANNELS[ch || storeChannel]);
  }

  function productChannelUrl(p, channel) {
    const meta = stockChannelMeta(channel);
    if (!p || !meta) return null;
    const entry = getSnapshotEntry(p.id, channel);
    return (
      (entry && entry[meta.urlField]) ||
      p[meta.productUrlField] ||
      null
    );
  }

  function syncStockModeChips() {
    const wrap = $("#stockModeChips");
    if (!wrap) return;
    const p = getProduct();
    const entry = p ? getSnapshotEntry(p.id, storeChannel) : null;
    const usable = isStockChannel(storeChannel) && hasUsableSnapshot(entry, storeChannel);
    wrap.classList.toggle("hidden", !usable);
    if (usable) wrap.removeAttribute("hidden");
    else wrap.setAttribute("hidden", "");
    if (!usable) return;
    $$("#stockModeChips .region-chip").forEach((x) => {
      const mode = x.getAttribute("data-stock-mode") || "snapshot";
      const on = mode === stockListMode;
      x.classList.toggle("active", on);
      x.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function preferSnapshotIfAvailable() {
    const p = getProduct();
    const entry = p ? getSnapshotEntry(p.id, storeChannel) : null;
    if (isStockChannel(storeChannel) && hasUsableSnapshot(entry, storeChannel)) {
      stockListMode = "snapshot";
      stockListExpanded = true;
    } else {
      stockListMode = "directory";
      stockListExpanded = false;
    }
  }

  function renderChannelStockPanel() {
    const panel = $("#channelStockPanel") || $("#manningsStockPanel");
    if (!panel) return;
    const p = getProduct();
    if (!p) {
      panel.innerHTML = "";
      return;
    }

    // Show both channel summaries when product selected (quick glance)
    const parts = [];
    ["mannings", "watsons"].forEach((ch) => {
      const meta = stockChannelMeta(ch);
      const entry = getSnapshotEntry(p.id, ch);
      const asOf = fmtAsOf(channelAsOf(ch));
      const url = productChannelUrl(p, ch);
      if (hasUsableSnapshot(entry, ch)) {
        const n = entry.storeCount;
        const cover = meta.coverageNote
          ? `<span class="stock-asof">；${meta.coverageNote}</span>`
          : "";
        parts.push(`
          <div class="stock-summary${storeChannel === ch ? " active-channel" : ""}" data-stock-ch="${ch}">
            <p class="stock-headline">
              <strong>${meta.label}：約 ${n} 間舖有貨</strong>
              <span class="stock-asof">（截至 ${asOf}；請致電確認${cover ? "" : ""}）</span>
            </p>
            <p class="stock-disclaimer">快照非即時庫存${meta.coverageNote ? "；" + meta.coverageNote : ""}。唔顯示件數。</p>
            <div class="stock-actions">
              <button type="button" class="chip expand-chip" data-goto-channel="${ch}">
                ${storeChannel === ch && stockListMode === "snapshot" ? "正在顯示有貨舖名單" : "睇有貨舖名單"}
              </button>
              ${url ? `<a class="btn-link" href="${url}" target="_blank" rel="noopener">${meta.label}產品頁「查詢門店庫存」</a>` : ""}
            </div>
          </div>`);
      } else {
        parts.push(`
          <div class="stock-summary fallback${storeChannel === ch ? " active-channel" : ""}" data-stock-ch="${ch}">
            <p class="stock-headline"><strong>${meta.label}：暫未有「該產品有貨舖數」快照</strong></p>
            <p class="stock-disclaimer">${stockRoot(ch).disclaimer || "尚未載入快照。"}</p>
            <div class="stock-actions">
              ${
                url
                  ? `<a class="btn-link" href="${url}" target="_blank" rel="noopener">去${meta.label}產品頁「查詢門店庫存」</a>`
                  : `<span class="muted-inline">此產品暫未對應${meta.label}產品頁連結</span>`
              }
            </div>
          </div>`);
      }
    });

    panel.innerHTML = parts.join("");
    panel.querySelectorAll("[data-goto-channel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ch = btn.getAttribute("data-goto-channel");
        stockListMode = "snapshot";
        stockListExpanded = true;
        setChannel(ch);
      });
    });
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

  function renderExpandedStockList(list, channelLabel) {
    const box = $("#stockStoreList");
    if (!box) return;
    let filtered = applyStoreFilters(list);
    const label = channelLabel || stockChannelMeta(storeChannel)?.label || "分店";
    if (!filtered.length) {
      box.innerHTML = `<div class="other-box">快照名單中搵唔到符合篩選嘅舖。可清空搜尋，或直接去${label}產品頁查庫存。</div>`;
      return;
    }
    box.innerHTML = filtered
      .map(
        (s) => `
      <article class="store-card stock-hit">
        <h4>${s.name || label + "分店"}</h4>
        <p class="addr">${s.district ? s.district + "　" : ""}${s.address || ""}</p>
        ${storeActionsHtml(s, `<span class="muted-inline">電話待補</span>`)}
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
    if (isStockChannel(storeChannel)) {
      const p = getProduct();
      const entry = p ? getSnapshotEntry(p.id, storeChannel) : null;
      if (
        stockListMode === "snapshot" &&
        hasUsableSnapshot(entry, storeChannel)
      ) {
        return entry.stores || [];
      }
      return stores[storeChannel] || [];
    }
    if (PHONEBOOK_CHANNELS[storeChannel]) {
      return stores[storeChannel] || [];
    }
    return [];
  }

  function channelMeta(ch) {
    return PHONEBOOK_CHANNELS[ch] || null;
  }

  function channelLocator(ch) {
    const meta = channelMeta(ch);
    if (!meta) return "";
    return stores[meta.locatorKey] || "";
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

    syncStockModeChips();

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
    const entry = p ? getSnapshotEntry(p.id, storeChannel) : null;
    const usingSnapshot =
      isStockChannel(storeChannel) &&
      stockListMode === "snapshot" &&
      hasUsableSnapshot(entry, storeChannel);

    const meta = channelMeta(storeChannel);
    const label = meta?.label || storeChannel;
    const locator = channelLocator(storeChannel);
    const rawList = currentStoreList();
    const withTel = (rawList || []).filter((s) => s && s.tel).length;
    const noTel = (rawList || []).length - withTel;
    const asOf = fmtAsOf(channelAsOf(storeChannel));
    const cover = stockChannelMeta(storeChannel)?.coverageNote;

    if (noteEl) {
      if (usingSnapshot) {
        noteEl.innerHTML =
          `<strong>顯示中：</strong>快照標示「可能有貨」嘅${label}舖（截至 ${asOf}；唔顯示件數）。` +
          (cover ? ` ${cover}。` : "") +
          ` 可切「電話簿全部」。`;
        noteEl.className = "directory-note ok-note";
        noteEl.dataset.open = "1";
      } else if (isStockChannel(storeChannel)) {
        const bookCount = (stores[storeChannel] || []).length;
        const url = productChannelUrl(p, storeChannel);
        noteEl.innerHTML =
          `<strong>${label}分店電話簿（約 ${bookCount} 間）——電話簿，非庫存</strong>。公開目錄整理，<strong>非</strong>該產品有貨舖數。` +
          (hasUsableSnapshot(entry, storeChannel)
            ? ` 若想睇有貨快照，請撳上方「只顯示有貨快照」。`
            : ` 此產品暫未有${label}有貨快照。`) +
          (url
            ? ` 或 <a href="${url}" target="_blank" rel="noopener">去${label}產品頁查庫存</a>。`
            : "") +
          (locator ? ` <a href="${locator}" target="_blank" rel="noopener">官方分店搜尋</a>` : "") +
          (cover ? ` （${cover}）` : "");
        noteEl.className = "directory-note warn-note";
        noteEl.dataset.open = "1";
      } else {
        let extra = "";
        if (storeChannel === "parknshop") {
          extra =
            ` 已整理約 ${withTel} 間分店電話（房委會商場名冊／公開目錄／舊版官網）；` +
            (noTel > 0 ? `另有 ${noTel} 間暫缺號碼——請用` : `如需核對請用`) +
            (locator
              ? `<a href="${locator}" target="_blank" rel="noopener">百佳官方店舖搜尋</a>`
              : "官方店舖搜尋") +
            `。`;
        } else if (storeChannel === "wellcome") {
          extra =
            ` 港島／九龍較齊；新界僅部分。` +
            (locator
              ? ` 完整名單：<a href="${locator}" target="_blank" rel="noopener">惠康官方門店位置</a>。`
              : "");
        } else if (locator) {
          extra = ` <a href="${locator}" target="_blank" rel="noopener">官方分店搜尋</a>`;
        }
        noteEl.innerHTML =
          `<strong>${label}電話簿（約 ${(rawList || []).length} 間）——電話簿，非庫存</strong>。` +
          `公開目錄整理，<strong>唔代表</strong>該產品一定有貨；請致電確認。` +
          extra;
        noteEl.className = "directory-note warn-note";
        noteEl.dataset.open = "1";
      }
    }

    let list = applyStoreFilters(currentStoreList());
    const regionName = REGION_LABEL[storeRegion] || "全部";

    if (countEl) {
      if (usingSnapshot) {
        countEl.textContent = `${regionName}：約 ${list.length} 間快照「可能有貨」舖（截至 ${asOf}；請致電確認；唔顯示件數）`;
      } else {
        countEl.textContent = `${regionName}：${label}電話簿約 ${list.length} 間（電話簿，非庫存）`;
      }
    }

    if (!list.length) {
      listEl.innerHTML =
        `<div class="other-box">搵唔到分店。可改關鍵字／分區，或去官方分店搜尋：` +
        (locator
          ? `<a href="${locator}" target="_blank" rel="noopener">${label}官方</a>`
          : "（暫無連結）") +
        `</div>`;
      return;
    }

    const fallbackNote = usingSnapshot
      ? "快照標示可能有貨 — 請致電確認（非即時庫存）"
      : "電話簿，非庫存 — 唔代表此產品有貨；請致電確認";

    listEl.innerHTML = list
      .map(
        (s) => `
      <article class="store-card${usingSnapshot ? " stock-hit" : ""}">
        <h4>${s.name}</h4>
        <p class="addr">${s.district ? s.district + "　" : ""}${s.address || ""}</p>
        ${storeActionsHtml(
          s,
          storeChannel === "parknshop" && locator
            ? `<a class="btn-link" href="${locator}" target="_blank" rel="noopener">查官方電話</a>`
            : `<span class="muted-inline">電話待補（請用官方店舖搜尋）</span>`
        )}
        <p class="note">${usingSnapshot && s.stockStatus ? `快照：${s.stockStatus} — 請致電確認（非即時庫存）` : fallbackNote}</p>
      </article>`
      )
      .join("");
  }

  function setChannel(ch) {
    storeChannel = ch;
    $(".channel-seg button").forEach((b) =>
      b.classList.toggle("active", b.dataset.channel === ch)
    );
    preferSnapshotIfAvailable();
    refreshDistrictOptions();
    renderChannelStockPanel();
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
    renderStores();
  }


  /* ---- Roadshow ---- */
  const roadshow = window.DD_ROADSHOW || {
    asOf: null,
    title: "Roadshow",
    facebookUrl: "https://www.facebook.com/japandingding/",
    sourceNote: "尚未載入時間表。",
    disclaimer: "",
    events: []
  };
  let roadshowFilter = "upcoming";

  const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
  const MONTH_ZH = {
    "01": "1月", "02": "2月", "03": "3月", "04": "4月",
    "05": "5月", "06": "6月", "07": "7月", "08": "8月",
    "09": "9月", "10": "10月", "11": "11月", "12": "12月"
  };

  function todayHK() {
    // Asia/Hong_Kong calendar date YYYY-MM-DD
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (_) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }
  }

  function eventEndKey(ev) {
    // Compare by date + end time so same-day morning slots become past after they end
    const end = String(ev.end || "23:59").replace(":", "");
    return String(ev.date || "") + "T" + end;
  }

  function nowKeyHK() {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value || "";
      return get("year") + "-" + get("month") + "-" + get("day") + "T" + get("hour") + get("minute");
    } catch (_) {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0") +
        "T" +
        String(d.getHours()).padStart(2, "0") +
        String(d.getMinutes()).padStart(2, "0")
      );
    }
  }

  function isUpcoming(ev) {
    return eventEndKey(ev) >= nowKeyHK();
  }

  function formatRoadshowDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso || "";
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const dt = new Date(Date.UTC(y, mo, d));
    // weekday for HK calendar date (treat as local civil date)
    const wd = WEEKDAY_ZH[new Date(y, mo, d).getDay()];
    return m[1] + "年" + (+m[2]) + "月" + (+m[3]) + "日（星期" + wd + "）";
  }

  function monthLabel(ym) {
    const parts = String(ym || "").split("-");
    if (parts.length < 2) return ym;
    return parts[0] + "年" + (MONTH_ZH[parts[1]] || parts[1]);
  }

  function allRoadshowEvents() {
    const c = cms();
    const builtin = Array.isArray(roadshow.events) ? roadshow.events : [];
    if (!c) return builtin.map((ev) => Object.assign({}, ev, { _key: (ev.date || "") + "|" + (ev.start || "") + "|" + (ev.place || ""), _builtin: true, _hidden: false }));
    return c.mergeRoadshowEvents(builtin, { includeHidden: !!(auth() && auth().isLoggedIn() && rsShowHidden) });
  }

  function filteredRoadshowEvents() {
    const list = allRoadshowEvents().slice();
    list.sort((a, b) => {
      const ka = String(a.date) + String(a.start || "");
      const kb = String(b.date) + String(b.start || "");
      return ka.localeCompare(kb);
    });
    if (roadshowFilter === "upcoming") return list.filter(isUpcoming);
    if (roadshowFilter === "past") return list.filter((e) => !isUpcoming(e));
    return list;
  }

  function renderRoadshowAnalytics() {
    const el = $("#roadshowAnalytics");
    if (!el) return;
    const list = allRoadshowEvents().filter((e) => !e._hidden);
    const upcoming = list.filter(isUpcoming);
    const past = list.filter((e) => !isUpcoming(e));
    const byMonth = {};
    list.forEach((ev) => {
      const ym = String(ev.date || "").slice(0, 7);
      if (!ym) return;
      byMonth[ym] = (byMonth[ym] || 0) + 1;
    });
    const months = Object.keys(byMonth).sort();
    const maxM = months.reduce((m, k) => Math.max(m, byMonth[k]), 1);
    const byArea = {};
    list.forEach((ev) => {
      const a = String(ev.area || "未分區").trim() || "未分區";
      byArea[a] = (byArea[a] || 0) + 1;
    });
    const areas = Object.keys(byArea).sort((a, b) => byArea[b] - byArea[a]);

    let next = null;
    upcoming
      .slice()
      .sort((a, b) => (String(a.date) + String(a.start)).localeCompare(String(b.date) + String(b.start)));
    if (upcoming.length) {
      next = upcoming
        .slice()
        .sort((a, b) => (String(a.date) + String(a.start)).localeCompare(String(b.date) + String(b.start)))[0];
    }

    let html =
      '<div class="rs-stat-row">' +
      '<div class="rs-stat"><span class="n">' +
      list.length +
      '</span><span class="l">總場次</span></div>' +
      '<div class="rs-stat"><span class="n">' +
      upcoming.length +
      '</span><span class="l">即將舉行</span></div>' +
      '<div class="rs-stat"><span class="n">' +
      past.length +
      '</span><span class="l">已結束</span></div>' +
      "</div>";

    if (next) {
      html +=
        '<div class="rs-next"><p class="rs-next-label">下一場</p>' +
        '<p class="rs-next-title">' +
        escapeHtml(next.place || "") +
        (next.area ? "（" + escapeHtml(next.area) + "）" : "") +
        "</p>" +
        '<p class="rs-next-meta">' +
        escapeHtml(formatRoadshowDate(next.date)) +
        "　" +
        escapeHtml(next.start || "") +
        "–" +
        escapeHtml(next.end || "") +
        (next.note ? "　·　" + escapeHtml(next.note) : "") +
        "</p></div>";
    } else {
      html +=
        '<div class="rs-next"><p class="rs-next-label">下一場</p><p class="rs-next-title">而家冇即將場次</p><p class="rs-next-meta">可去 Facebook 睇有冇新公告，或自己新增場次。</p></div>';
    }

    if (months.length) {
      html += '<p class="field" style="margin:4px 0 0">按月份</p><div class="rs-month-bars">';
      months.forEach((ym) => {
        const n = byMonth[ym];
        const pct = Math.round((n / maxM) * 100);
        html +=
          '<div class="rs-month-row"><span>' +
          escapeHtml(monthLabel(ym)) +
          '</span><div class="bar-track"><div class="bar-fill" style="width:' +
          pct +
          '%"></div></div><strong>' +
          n +
          "</strong></div>";
      });
      html += "</div>";
    }

    if (areas.length) {
      html += '<p class="field" style="margin:8px 0 0">按地區</p><div class="rs-area-chips">';
      areas.forEach((a) => {
        html +=
          '<span class="rs-area-chip">' +
          escapeHtml(a) +
          " <strong>" +
          byArea[a] +
          "</strong></span>";
      });
      html += "</div>";
    }

    el.innerHTML = html;
  }

  var GIFT_LOW_QTY = 200;
  var GIFT_SHORT_ORDER = ["薄荷水", "防蟲貼", "單張", "噴霧10ml", "舒護膏", "貼紙"];

  function giftCatalogMap() {
    var raw = (window.DD_ROADSHOW_GIFTS && window.DD_ROADSHOW_GIFTS.catalog) || [];
    var map = {};
    raw.forEach(function (c) {
      if (c && c.code) map[c.code] = c;
    });
    return map;
  }

  function allGiftDays(includeHidden) {
    var raw = (window.DD_ROADSHOW_GIFTS && window.DD_ROADSHOW_GIFTS.days) || [];
    var c = cms();
    if (!c || !c.mergeGiftDays) {
      return raw.map(function (d) {
        return Object.assign({}, d, { _builtin: true, _hidden: false });
      });
    }
    return c.mergeGiftDays(raw, {
      includeHidden: !!(includeHidden && auth() && auth().isLoggedIn())
    });
  }

  function giftDayTotal(day) {
    return (day.items || []).reduce(function (s, it) {
      return s + (Number(it.qty) || 0);
    }, 0);
  }

  function giftPlaceSummary(day) {
    var slots = Array.isArray(day.slots) ? day.slots : [];
    if (!slots.length) return "地點未寫";
    return slots
      .map(function (s) {
        var bits = [];
        if (s.time) bits.push(s.time);
        if (s.place) bits.push(s.place);
        return bits.join(" ");
      })
      .filter(Boolean)
      .join("；") || "地點未寫";
  }

  function giftShortQtyByDay(day, catalog) {
    var byShort = {};
    (day.items || []).forEach(function (it) {
      var meta = catalog[it.code] || {};
      var short = meta.short || it.code;
      byShort[short] = (byShort[short] || 0) + (Number(it.qty) || 0);
    });
    return byShort;
  }

  function giftDatesSet() {
    var set = {};
    allGiftDays(false).forEach(function (d) {
      if (d.date) set[d.date] = d;
    });
    return set;
  }

  function renderGiftAnalytics() {
    var el = $("#giftAnalytics");
    var noteEl = $("#giftSourceNote");
    if (!el) return;
    var data = window.DD_ROADSHOW_GIFTS || {};
    if (noteEl) {
      noteEl.textContent =
        (data.sourceNote || "") +
        (data.asOf ? "　資料截至 " + fmtAsOf(data.asOf) + "。" : "");
    }
    var catalog = giftCatalogMap();
    var days = allGiftDays(true).filter(function (d) {
      return !d._hidden || (auth() && auth().isLoggedIn());
    });
    // For stats use non-hidden
    var visible = days.filter(function (d) { return !d._hidden; });
    if (!visible.length && !days.length) {
      el.innerHTML = '<p class="count">未有贈品 Stock Check 記錄。</p>';
      return;
    }

    var sorted = visible.slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    var latest = sorted.length ? sorted[sorted.length - 1] : null;
    var latestTotal = latest ? giftDayTotal(latest) : 0;
    var latestByShort = latest ? giftShortQtyByDay(latest, catalog) : {};

    var html = '<div class="gift-stat-row">';
    html +=
      '<div class="gift-stat"><span class="n">' +
      visible.length +
      '</span><span class="l">有記錄日數</span></div>';
    html +=
      '<div class="gift-stat"><span class="n">' +
      latestTotal.toLocaleString("en-HK") +
      '</span><span class="l">最新一日總件</span></div>';
    GIFT_SHORT_ORDER.forEach(function (short) {
      var n = latestByShort[short] || 0;
      if (!n && short !== "舒護膏") {
        // still show if any day has it
        var any = sorted.some(function (d) {
          return (giftShortQtyByDay(d, catalog)[short] || 0) > 0;
        });
        if (!any) return;
      }
      var warn = n > 0 && n < GIFT_LOW_QTY;
      html +=
        '<div class="gift-stat' +
        (warn ? " warn" : "") +
        '"><span class="n">' +
        n.toLocaleString("en-HK") +
        '</span><span class="l">最新·' +
        escapeHtml(short) +
        "</span></div>";
    });
    html += "</div>";

    // Low stock warnings on latest day
    var lows = [];
    if (latest) {
      (latest.items || []).forEach(function (it) {
        var q = Number(it.qty) || 0;
        if (q < GIFT_LOW_QTY) {
          var meta = catalog[it.code] || {};
          lows.push({
            short: meta.short || it.code,
            code: it.code,
            qty: q,
            remark: it.remark || "",
            dayLabel: latest.dayLabel,
            date: latest.date
          });
        }
      });
    }
    if (lows.length) {
      html += '<div class="gift-warn-box"><strong>低庫存提示</strong>（少於 ' + GIFT_LOW_QTY + '）：';
      lows.forEach(function (l) {
        html +=
          "<div>" +
          escapeHtml(l.dayLabel || "") +
          " " +
          escapeHtml(l.date) +
          "　" +
          escapeHtml(l.short) +
          "（" +
          escapeHtml(l.code) +
          "）<strong>" +
          l.qty +
          "</strong>　偏低" +
          (l.remark ? "　·　" + escapeHtml(l.remark) : "") +
          "</div>";
      });
      html += "</div>";
    }

    // Trend by short name
    html += '<p class="field" style="margin:4px 0 0">品類走勢（按短名合計）</p><div class="gift-trend">';
    var maxByShort = {};
    GIFT_SHORT_ORDER.forEach(function (short) {
      var max = 1;
      sorted.forEach(function (d) {
        var n = giftShortQtyByDay(d, catalog)[short] || 0;
        if (n > max) max = n;
      });
      maxByShort[short] = max;
    });
    GIFT_SHORT_ORDER.forEach(function (short) {
      var hasAny = sorted.some(function (d) {
        return (giftShortQtyByDay(d, catalog)[short] || 0) > 0;
      });
      if (!hasAny) return;
      html +=
        '<div class="gift-trend-sku"><p class="gt-name">' +
        escapeHtml(short) +
        '</p><div class="gift-trend-bars">';
      sorted.forEach(function (d) {
        var n = giftShortQtyByDay(d, catalog)[short] || 0;
        var pct = Math.round((n / maxByShort[short]) * 100);
        var low = n > 0 && n < GIFT_LOW_QTY;
        var label = (d.date || "").slice(5) + (d.dayLabel ? " " + d.dayLabel.replace("Day ", "D") : "");
        html +=
          '<div class="gift-trend-row' +
          (low ? " low" : "") +
          '"><span>' +
          escapeHtml(label) +
          '</span><div class="bar-track"><div class="bar-fill" style="width:' +
          pct +
          '%"></div></div><strong>' +
          n.toLocaleString("en-HK") +
          "</strong></div>";
      });
      html += "</div></div>";
    });
    html += "</div>";

    // Day table (expandable) — include hidden for staff management
    html += '<p class="field" style="margin:8px 0 0">按日明細</p><div class="gift-day-table">';
    var listForTable = days.slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    listForTable.forEach(function (d) {
      var total = giftDayTotal(d);
      var place = giftPlaceSummary(d);
      var hidCls = d._hidden ? " is-hidden-admin" : "";
      html +=
        '<details class="gift-day-row' +
        hidCls +
        '"><summary><div class="gd-main"><span class="gd-date">' +
        escapeHtml(formatRoadshowDate(d.date)) +
        "　" +
        escapeHtml(d.dayLabel || "") +
        (d.custom ? "　<span class=\"rs-badge\">自訂</span>" : "") +
        '</span><span class="gd-place">' +
        escapeHtml(place) +
        '</span></div><span class="gd-total">' +
        total.toLocaleString("en-HK") +
        " 件</span></summary><div class=\"gd-items\">";
      (d.items || []).forEach(function (it) {
        var meta = catalog[it.code] || {};
        var q = Number(it.qty) || 0;
        var low = q < GIFT_LOW_QTY;
        html +=
          '<div class="gift-item-line' +
          (low ? " low" : "") +
          '"><div><strong>' +
          escapeHtml(meta.short || it.code) +
          "</strong>　" +
          escapeHtml(meta.name || "") +
          '<div class="gi-code">' +
          escapeHtml(it.code) +
          (it.remark ? "　·　" + escapeHtml(it.remark) : "") +
          '</div></div><span class="gi-qty">' +
          q.toLocaleString("en-HK") +
          "</span></div>";
      });
      if (auth() && auth().isLoggedIn()) {
        html += '<div class="gift-day-ops">';
        if (d._builtin) {
          html +=
            '<button type="button" data-gift-hide="' +
            escapeHtml(d.id) +
            '">' +
            (d._hidden ? "顯示" : "隱藏") +
            "</button>";
        } else if (d.id) {
          html +=
            '<button type="button" data-gift-del="' +
            escapeHtml(d.id) +
            '">刪除</button>';
        }
        html += "</div>";
      }
      html += "</div></details>";
    });
    html += "</div>";

    // Source screenshots
    var sources = Array.isArray(data.sources) ? data.sources : [];
    if (sources.length) {
      html += '<p class="field" style="margin:8px 0 0">原始 Stock Check 表</p><div class="gift-sources">';
      sources.forEach(function (s) {
        html +=
          '<a href="' +
          escapeHtml(s.src) +
          '" target="_blank" rel="noopener">📷 ' +
          escapeHtml(s.label || "截圖") +
          "</a>";
      });
      html += "</div>";
    }

    el.innerHTML = html;
  }

  function closeRoadshowLightbox() {
    const box = $("#rsLightbox");
    if (box) box.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openRoadshowLightbox(item) {
    const box = $("#rsLightbox");
    const img = $("#rsLightboxImg");
    const cap = $("#rsLightboxCap");
    if (!box || !img || !item) return;
    img.src = item.src;
    img.alt = item.alt || item.caption || item.label || "宣傳圖";
    if (cap) {
      const bits = [];
      if (item.caption) bits.push(escapeHtml(item.caption));
      else if (item.label) bits.push(escapeHtml(item.label));
      if (item.source) bits.push(escapeHtml(item.source));
      if (item.postUrl) {
        bits.push(
          '<a href="' +
            escapeHtml(item.postUrl) +
            '" target="_blank" rel="noopener">睇 Facebook 原帖</a>'
        );
      }
      cap.innerHTML = bits.join("<br>");
    }
    box.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("#rsLightboxClose")?.focus();
  }

  function renderRoadshowGallery() {
    const gal = $("#roadshowGallery");
    const credit = $("#roadshowGalleryCredit");
    const items = Array.isArray(roadshow.gallery) ? roadshow.gallery : [];
    if (credit) {
      credit.textContent = items.length
        ? roadshow.imageCredit ||
          "圖片來源：日本叮叮 Facebook／公開宣傳"
        : "";
    }
    if (!gal) return;
    if (!items.length) {
      gal.innerHTML = "";
      return;
    }
    gal.innerHTML = items
      .map((item, i) => {
        const src = item.src || "";
        const label = item.label || "宣傳圖";
        const alt = item.alt || label;
        return (
          '<button type="button" class="rs-gal-item" data-rs-gal="' +
          i +
          '" aria-label="放大：' +
          label +
          '">' +
          '<img src="' +
          src +
          '" alt="' +
          alt +
          '" loading="lazy" width="160" height="200" />' +
          '<span class="rs-gal-label">' +
          label +
          "</span></button>"
        );
      })
      .join("");
  }

  function renderRoadshow() {
    renderRoadshowAnalytics();
    renderGiftAnalytics();
    renderRoadshowGallery();
    const intro = $("#roadshowIntro");
    const listEl = $("#roadshowList");
    const foot = $("#roadshowFoot");
    const fb = $("#roadshowFbLink");
    if (fb && roadshow.facebookUrl) fb.href = roadshow.facebookUrl;

    if (intro) {
      const title = roadshow.title || "Roadshow／快閃";
      const asOf = fmtAsOf(roadshow.asOf) || "—";
      intro.innerHTML =
        "<strong>" +
        title +
        "</strong>——免費派發驅蚊防蟲試用裝（Cipeller®PMD）。" +
        "<br><span class=\"muted-inline\">整理截至 " +
        asOf +
        "（香港時間）。</span><br>" +
        (roadshow.sourceNote || "") +
        (roadshow.disclaimer
          ? "<br><strong>" + roadshow.disclaimer + "</strong>"
          : "");
    }

    if (!listEl) return;
    const events = filteredRoadshowEvents();
    if (!events.length) {
      const msg =
        roadshowFilter === "upcoming"
          ? "而家冇即將／進行中嘅場次。可撳「已完結」睇過往，或者去 Facebook 睇有冇新公告。"
          : "呢個篩選暫時冇場次。";
      listEl.innerHTML = '<div class="roadshow-empty">' + msg + "</div>";
      if (foot) {
        foot.textContent =
          "共收錄 " +
          allRoadshowEvents().filter((e) => !e._hidden).length +
          " 個時段；請以 Facebook 最新為準。";
      }
      return;
    }

    // Group by month; upcoming ascending, past descending within filter
    const ordered = events.slice();
    if (roadshowFilter === "past") ordered.reverse();

    let html = "";
    let lastMonth = "";
    for (const ev of ordered) {
      const ym = String(ev.date || "").slice(0, 7);
      if (ym && ym !== lastMonth) {
        lastMonth = ym;
        html += '<h4 class="roadshow-month">' + monthLabel(ym) + "</h4>";
      }
      const up = isUpcoming(ev);
      const badge = up
        ? '<span class="rs-badge">即將／進行</span>'
        : '<span class="rs-badge done">已完結</span>';
      const giftMatch = giftDatesSet()[ev.date];
      const giftChip = giftMatch
        ? '<span class="rs-gift-chip" title="當日有贈品 Stock Check">🎁 當日贈品</span>'
        : "";
      const note = ev.note ? " · " + escapeHtml(ev.note) : "";
      const hidCls = ev._hidden ? " is-hidden-admin" : "";
      let ops = "";
      if (auth() && auth().isLoggedIn()) {
        if (ev._builtin) {
          ops =
            '<div class="rs-card-ops"><button type="button" data-rs-hide="' +
            escapeHtml(ev._key) +
            '">' +
            (ev._hidden ? "顯示" : "隱藏") +
            "</button></div>";
        } else if (ev.id) {
          ops =
            '<div class="rs-card-ops"><button type="button" data-rs-del="' +
            escapeHtml(ev.id) +
            '">刪除</button></div>';
        }
      }
      html +=
        '<article class="roadshow-card ' +
        (up ? "upcoming" : "past") +
        hidCls +
        '">' +
        '<p class="rs-date">' +
        formatRoadshowDate(ev.date) +
        badge +
        giftChip +
        "</p>" +
        '<p class="rs-time">' +
        escapeHtml(ev.start || "") +
        " – " +
        escapeHtml(ev.end || "") +
        "</p>" +
        '<p class="rs-place"><strong>' +
        escapeHtml(ev.area || "") +
        "</strong>　" +
        escapeHtml(ev.place || "") +
        "</p>" +
        '<p class="rs-meta">免費試用裝 · 數量有限' +
        note +
        "</p>" +
        ops +
        "</article>";
    }
    listEl.innerHTML = html;
    if (foot) {
      foot.textContent =
        "顯示 " +
        events.length +
        " 個時段（全表 " +
        allRoadshowEvents().filter((e) => !e._hidden).length +
        "）。惡劣天氣或以 Facebook 最新為準。";
    }
  }

  function setRoadshowFilter(name) {
    roadshowFilter = name || "upcoming";
    $$(".roadshow-filter button").forEach((b) =>
      b.classList.toggle("active", b.dataset.rsFilter === roadshowFilter)
    );
    // If upcoming empty on load, auto-fall to past for elder UX
    if (roadshowFilter === "upcoming") {
      const up = allRoadshowEvents().filter((e) => !e._hidden && isUpcoming(e));
      if (!up.length) {
        roadshowFilter = "past";
        $$(".roadshow-filter button").forEach((b) =>
          b.classList.toggle("active", b.dataset.rsFilter === "past")
        );
      }
    }
    renderRoadshow();
  }

  /* ---- Staff admin gate ---- */
  let pendingAdminView = null; // "roadshow" | "account" after login

  function auth() {
    return window.DDAdminAuth || null;
  }

  function closeLoginDropdown() {
    const dd = $("#loginDropdown");
    const btn = $("#headerLoginBtn");
    if (dd) dd.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function syncAdminUI() {
    const logged = !!(auth() && auth().isLoggedIn());
    $$(".admin-only").forEach((el) => el.classList.toggle("hidden", !logged));
    const btn = $("#headerLoginBtn");
    if (btn) {
      btn.classList.toggle("is-in", logged);
      btn.setAttribute("aria-label", logged ? "職員選單" : "職員登入");
      const outI = btn.querySelector(".hdr-icon-out");
      const inI = btn.querySelector(".hdr-icon-in");
      const dot = btn.querySelector(".hdr-login-dot");
      if (outI) outI.classList.toggle("hidden", logged);
      if (inI) inI.classList.toggle("hidden", !logged);
      if (dot) dot.classList.toggle("hidden", !logged);
    }
    const hint = $("#footerStaffHint");
    if (hint) hint.classList.toggle("hidden", logged);
    if (!logged) closeLoginDropdown();
    renderStaffNotes("stores");
    renderStaffNotes("anti");
    if (typeof activeFaqKey !== "undefined" && activeFaqKey) showAnswer(activeFaqKey);
    if (typeof renderProductMeta === "function") {
      const prod = typeof getProduct === "function" ? getProduct() : null;
      if (prod) {
        renderProductMeta(prod);
        renderProductMeta(prod, "#storeProductMeta");
      }
      if (typeof renderStaffIngredientPanel === "function") {
        renderStaffIngredientPanel(prod);
      }
    }
  }

  function renderStaffNotes(kind) {
    const listId = kind === "anti" ? "#antiNotesList" : "#storesNotesList";
    const listEl = $(listId);
    if (!listEl) return;
    const logged = !!(auth() && auth().isLoggedIn());
    if (!logged) {
      listEl.innerHTML = "";
      return;
    }
    const c = cms();
    const notes = c ? c.getNotes(kind) : [];
    if (!notes.length) {
      listEl.innerHTML = '<li class="staff-notes-empty" style="border:none;background:transparent;padding:0">暫時冇備註。</li>';
      return;
    }
    listEl.innerHTML = notes
      .map((n) => {
        const when = n.createdAt ? String(n.createdAt).slice(0, 16).replace("T", " ") : "";
        return (
          "<li><div class=\"note-text\">" +
          escapeHtml(n.text) +
          '<span class="note-time">' +
          escapeHtml(when) +
          "（香港時間近似）</span></div>" +
          '<button type="button" data-note-del="' +
          escapeHtml(n.id) +
          '" data-note-kind="' +
          kind +
          '" aria-label="刪除">刪除</button></li>'
        );
      })
      .join("");
  }


  /* ---- Blog (知識) ---- */
  const blogData = window.DD_BLOG || { asOf: null, posts: [] };

  function formatBlogDate(iso) {
    if (!iso) return "";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return escapeHtml(iso);
    return m[1] + "年" + Number(m[2]) + "月" + Number(m[3]) + "日";
  }

  function getMergedBlogPosts() {
    const c = cms();
    const builtin = Array.isArray(blogData.posts) ? blogData.posts : [];
    if (c && c.mergeBlogPosts) return c.mergeBlogPosts(builtin, blogShowHidden);
    return builtin.map((post) => Object.assign({}, post, { _builtin: true, _hidden: false, custom: false }));
  }

  function findBlogPost(id) {
    return getMergedBlogPosts().find((p) => String(p.id) === String(id)) || null;
  }

  function renderBlogList() {
    const list = $("#blogList");
    if (!list) return;
    const logged = !!(auth() && auth().isLoggedIn());
    const posts = getMergedBlogPosts();
    $("#blogListPanel")?.classList.remove("hidden");
    $("#blogArticlePanel")?.classList.add("hidden");
    activeBlogId = null;

    if (!posts.length) {
      list.innerHTML = '<p class="blog-empty">暫時未有文章。</p>';
      return;
    }

    list.innerHTML = posts
      .map((post) => {
        const hidClass = post._hidden ? " is-hidden-admin" : "";
        let ops = "";
        if (logged) {
          const hideLabel = post._hidden ? "顯示" : "隱藏";
          ops =
            '<div class="blog-admin-ops">' +
            '<button type="button" data-blog-hide="' +
            escapeHtml(post.id) +
            '">' +
            hideLabel +
            "</button>";
          if (post.custom) {
            ops +=
              '<button type="button" data-blog-del="' +
              escapeHtml(post.id) +
              '">刪除</button>';
          }
          ops += "</div>";
        }
        return (
          '<article class="blog-card' +
          hidClass +
          '" data-blog-id="' +
          escapeHtml(post.id) +
          '" role="button" tabindex="0">' +
          '<div class="blog-card-meta">' +
          '<span class="blog-tag">' +
          escapeHtml(post.tag || "知識") +
          "</span>" +
          '<time datetime="' +
          escapeHtml(post.date || "") +
          '">' +
          formatBlogDate(post.date) +
          "</time>" +
          "</div>" +
          "<h4>" +
          escapeHtml(post.title || "") +
          "</h4>" +
          '<p class="blog-excerpt">' +
          escapeHtml(post.excerpt || "") +
          "</p>" +
          '<span class="blog-read">閱讀全文 →</span>' +
          ops +
          "</article>"
        );
      })
      .join("");
  }

  function renderBlogSectionBody(sec) {
    let html = "";
    if (sec.h) html += "<h2>" + escapeHtml(sec.h) + "</h2>";
    (sec.paragraphs || []).forEach((para) => {
      html += "<p>" + escapeHtml(para) + "</p>";
    });
    if (sec.bullets && sec.bullets.length) {
      html +=
        "<ul>" +
        sec.bullets.map((b) => "<li>" + escapeHtml(b) + "</li>").join("") +
        "</ul>";
    }
    return html;
  }

  function renderBlogArticle(id) {
    const panel = $("#blogArticle");
    if (!panel) return;
    const post = findBlogPost(id);
    if (!post) {
      renderBlogList();
      return;
    }
    activeBlogId = String(post.id);
    $("#blogListPanel")?.classList.add("hidden");
    $("#blogArticlePanel")?.classList.remove("hidden");

    let body = (post.sections || []).map(renderBlogSectionBody).join("");
    if (!body && post.bodyHtml) {
      // custom posts shouldn't inject raw HTML from CMS — treat as plain
      body = "<p>" + escapeHtml(String(post.bodyHtml)) + "</p>";
    }

    const cta =
      '<div class="blog-cta">' +
      (post.ctaHint ? '<p class="blog-cta-hint">' + escapeHtml(post.ctaHint) + "</p>" : "") +
      '<div class="blog-cta-chips">' +
      '<button type="button" class="chip" data-blog-goto="qa">去產品問答</button>' +
      '<button type="button" class="chip" data-blog-goto="stores">門店查貨</button>' +
      "</div></div>";

    panel.innerHTML =
      '<header class="blog-article-head">' +
      '<span class="blog-tag">' +
      escapeHtml(post.tag || "知識") +
      "</span>" +
      '<time datetime="' +
      escapeHtml(post.date || "") +
      '">' +
      formatBlogDate(post.date) +
      "</time>" +
      "<h1>" +
      escapeHtml(post.title || "") +
      "</h1>" +
      "</header>" +
      '<div class="blog-prose">' +
      body +
      "</div>" +
      cta;
  }

  function openBlogPost(id) {
    location.hash = "#blog/" + encodeURIComponent(String(id));
    renderBlogArticle(id);
  }

  function showBlogView(postId) {
    $("#view-qa")?.classList.toggle("hidden", true);
    $("#view-stores")?.classList.toggle("hidden", true);
    $("#view-roadshow")?.classList.toggle("hidden", true);
    $("#view-anti")?.classList.toggle("hidden", true);
    $("#view-login")?.classList.toggle("hidden", true);
    $("#view-account")?.classList.toggle("hidden", true);
    $("#view-blog")?.classList.toggle("hidden", false);
    $$(".nav-tabs button[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === "blog")
    );
    syncAdminUI();
    if (postId) renderBlogArticle(postId);
    else renderBlogList();
  }

  function hashForView(v) {
    if (v === "stores") return "#stores";
    if (v === "blog") return "#blog";
    if (v === "roadshow") return "#roadshow";
    if (v === "anti") return "#anti";
    if (v === "login") return "#login";
    if (v === "account") return "#account";
    return "#qa";
  }

  /* ---- Tabs ---- */
  function showView(name) {
    const a = auth();
    if ((name === "roadshow" || name === "account") && !(a && a.isLoggedIn())) {
      pendingAdminView = name;
      name = "login";
    }
    if (name === "login" && a && a.isLoggedIn()) {
      name = pendingAdminView || "roadshow";
      pendingAdminView = null;
    }

    $("#view-qa")?.classList.toggle("hidden", name !== "qa");
    $("#view-stores")?.classList.toggle("hidden", name !== "stores");
    $("#view-blog")?.classList.toggle("hidden", name !== "blog");
    $("#view-roadshow")?.classList.toggle("hidden", name !== "roadshow");
    $("#view-anti")?.classList.toggle("hidden", name !== "anti");
    $("#view-login")?.classList.toggle("hidden", name !== "login");
    $("#view-account")?.classList.toggle("hidden", name !== "account");
    $$(".nav-tabs button[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === name)
    );
    syncAdminUI();
    if (name === "qa") {
      renderFaqGrid();
    }
    if (name === "stores") {
      // sync store select from QA
      const id = getProductId();
      const st = $("#storeProductSelect");
      if (st && id) st.value = id;
      renderChannelStockPanel();
      refreshDistrictOptions();
      renderStores();
    }
    if (name === "blog") {
      if (activeBlogId) renderBlogArticle(activeBlogId);
      else renderBlogList();
    }
    if (name === "roadshow") {
      renderRoadshow();
    }
    if (name === "login") {
      const err = $("#loginError");
      if (err) err.classList.add("hidden");
      const user = $("#loginUser");
      if (user && a) {
        try {
          user.value = a.getCreds().user || "";
        } catch (e) {
          /* ignore */
        }
      }
      $("#loginPass") && ($("#loginPass").value = "");
      setTimeout(() => $("#loginPass")?.focus(), 50);
    }
    if (name === "account" && a) {
      const msg = $("#accountMsg");
      if (msg) {
        msg.className = "admin-msg hidden";
        msg.textContent = "";
      }
      try {
        const u = $("#acctNewUser");
        if (u) u.value = a.getCreds().user || "";
      } catch (e) {
        /* ignore */
      }
      ["acctCurrentPass", "acctNewPass", "acctNewPass2"].forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = "";
      });
    }
  }

  function init() {
    fillProductSelects();

    $("#productSelect")?.addEventListener("change", () => {
      setProductId($("#productSelect").value, "qa");
      if (activeFaqKey) showAnswer(activeFaqKey);
      else {
        const box = $("#answerPanel");
        if (box) {
          box.className = "answer empty";
          box.textContent = "揀咗產品後，撳上面問題掣即睇答案。";
        }
      }
    });

    $("#storeProductSelect")?.addEventListener("change", () => {
      setProductId($("#storeProductSelect").value, "stores");
      refreshDistrictOptions();
      renderStores();
    });

    $("#faqGrid")?.addEventListener("click", (e) => {
      const hideBtn = e.target.closest("[data-faq-hide]");
      if (hideBtn) {
        e.preventDefault();
        e.stopPropagation();
        const key = hideBtn.dataset.faqHide;
        const c = cms();
        if (!c) return;
        if (c.isFaqHidden(key)) c.showFaq(key);
        else c.hideFaq(key);
        renderFaqGrid();
        return;
      }
      const delBtn = e.target.closest("[data-faq-del]");
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = delBtn.dataset.faqDel;
        if (!confirm("刪除呢條自訂問題？")) return;
        cms()?.removeFaqCustom(id);
        if (activeFaqKey === "custom:" + id) {
          activeFaqKey = null;
          const box = $("#answerPanel");
          if (box) {
            box.className = "answer empty";
            box.textContent = "揀咗產品後，撳上面問題掣即睇答案。";
          }
        }
        renderFaqGrid();
        return;
      }
      const card = e.target.closest(".faq-card[data-q]");
      if (card) showAnswer(card.dataset.q);
    });

    $("#goStoresBtn")?.addEventListener("click", () => {
      location.hash = "#stores";
      showView("stores");
    });

    $$(".nav-tabs button[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        if (v === "blog") activeBlogId = null;
        location.hash = hashForView(v);
        showView(v);
      });
    });

    function doLogout() {
      auth()?.logout();
      pendingAdminView = null;
      closeLoginDropdown();
      syncAdminUI();
      renderFaqGrid();
      location.hash = "#qa";
      showView("qa");
    }

    $("#headerLoginBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const logged = !!(auth() && auth().isLoggedIn());
      if (!logged) {
        pendingAdminView = "roadshow";
        location.hash = "#login";
        showView("login");
        return;
      }
      const dd = $("#loginDropdown");
      if (!dd) return;
      const open = dd.classList.contains("hidden");
      dd.classList.toggle("hidden", !open);
      $("#headerLoginBtn")?.setAttribute("aria-expanded", open ? "true" : "false");
    });

    $("#loginDropdown")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dd-action]");
      if (!btn) return;
      const act = btn.dataset.ddAction;
      closeLoginDropdown();
      if (act === "logout") {
        doLogout();
        return;
      }
      if (act === "roadshow" || act === "account") {
        location.hash = hashForView(act);
        showView(act);
      }
    });

    document.addEventListener("click", (e) => {
      const wrap = $(".header-login-wrap");
      if (wrap && !wrap.contains(e.target)) closeLoginDropdown();
    });

    $("#loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = auth();
      const err = $("#loginError");
      if (err) err.classList.add("hidden");
      if (!a) return;
      const user = $("#loginUser")?.value || "";
      const pass = $("#loginPass")?.value || "";
      const btn = $("#loginSubmit");
      if (btn) btn.disabled = true;
      try {
        const ok = await a.login(user, pass);
        if (!ok) {
          if (err) err.classList.remove("hidden");
          return;
        }
        const next = pendingAdminView || "roadshow";
        pendingAdminView = null;
        syncAdminUI();
        renderFaqGrid();
        location.hash = hashForView(next);
        showView(next);
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    $("#accountForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = auth();
      const msg = $("#accountMsg");
      if (!a) return;
      const cur = $("#acctCurrentPass")?.value || "";
      const nu = $("#acctNewUser")?.value || "";
      const np = $("#acctNewPass")?.value || "";
      const np2 = $("#acctNewPass2")?.value || "";
      if (msg) {
        msg.className = "admin-msg";
        msg.classList.remove("hidden", "ok", "err");
      }
      if (np !== np2) {
        if (msg) {
          msg.classList.add("err");
          msg.textContent = "兩次新密碼唔一致";
        }
        return;
      }
      const btn = $("#accountSave");
      if (btn) btn.disabled = true;
      try {
        const res = await a.changeCredentials(cur, nu, np);
        if (!res.ok) {
          if (msg) {
            msg.classList.add("err");
            msg.textContent = res.error || "更新失敗";
          }
          return;
        }
        if (msg) {
          msg.classList.add("ok");
          msg.textContent = "已更新帳號密碼";
        }
        ["acctCurrentPass", "acctNewPass", "acctNewPass2"].forEach((id) => {
          const el = $("#" + id);
          if (el) el.value = "";
        });
      } finally {
        if (btn) btn.disabled = false;
      }
    });


    $("#openCompareImg")?.addEventListener("click", () => {
      openRoadshowLightbox({
        src: "assets/img/promo/cipeller-pmd-dabiping.jpg?v=20261021a",
        alt: "驅蚊蟲成分大比拼：Cipeller®PMD VS 一般驅蚊成分",
        caption: "【Cipeller®PMD VS 一般驅蚊成分】驅蚊蟲成分大比拼——安全、功效、驅防種類、有效時間。",
        source: "日本叮叮 Facebook 公開帖",
        postUrl: ""
      });
    });

    $("#roadshowGallery")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rs-gal]");
      if (!btn) return;
      const idx = Number(btn.dataset.rsGal);
      const items = Array.isArray(roadshow.gallery) ? roadshow.gallery : [];
      if (items[idx]) openRoadshowLightbox(items[idx]);
    });
    $("#rsLightboxClose")?.addEventListener("click", closeRoadshowLightbox);
    $("#rsLightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "rsLightbox") closeRoadshowLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeRoadshowLightbox();
    });

    $$(".roadshow-filter button").forEach((btn) => {
      btn.addEventListener("click", () => setRoadshowFilter(btn.dataset.rsFilter));
    });

    function applyHash() {
      const h = location.hash || "";
      if (h === "#stores") showView("stores");
      else if (h === "#blog" || h.startsWith("#blog/")) {
        const parts = h.split("/");
        const postId = parts.length > 1 ? decodeURIComponent(parts.slice(1).join("/")) : "";
        activeBlogId = postId || null;
        showView("blog");
      } else if (h === "#roadshow") showView("roadshow");
      else if (h === "#anti") showView("anti");
      else if (h === "#login") showView("login");
      else if (h === "#account") showView("account");
      else {
        activeBlogId = null;
        showView("qa");
      }
    }
    syncAdminUI();
    applyHash();
    window.addEventListener("hashchange", applyHash);

    // Default filter: upcoming, auto-switch to past if season ended
    // Only render roadshow data when staff can see it (after login / when gated)
    setRoadshowFilter("upcoming");

    $(".channel-seg button").forEach((btn) => {
      btn.addEventListener("click", () => setChannel(btn.dataset.channel));
    });
    $("#stockModeChips .region-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-stock-mode") || "snapshot";
        stockListMode = mode;
        stockListExpanded = mode === "snapshot";
        refreshDistrictOptions();
        renderChannelStockPanel();
        renderStores();
      });
    });
    $$("#regionChips .region-chip").forEach((btn) => {
      btn.addEventListener("click", () => setRegion(btn.dataset.region || ""));
    });
    $("#districtSelect")?.addEventListener("change", () => {
      renderStores();
    });
    $("#storeSearch")?.addEventListener("input", () => {
      renderStores();
    });

    /* ---- FAQ CMS ---- */
    $("#faqAddBtn")?.addEventListener("click", () => {
      $("#faqAddForm")?.classList.remove("hidden");
      $("#faqNewLabel")?.focus();
    });
    $("#faqAddCancel")?.addEventListener("click", () => {
      $("#faqAddForm")?.classList.add("hidden");
      const msg = $("#faqAddMsg");
      if (msg) msg.className = "admin-msg hidden";
    });
    $("#faqToggleHiddenBtn")?.addEventListener("click", () => {
      faqShowHidden = !faqShowHidden;
      const b = $("#faqToggleHiddenBtn");
      if (b) b.textContent = faqShowHidden ? "收起已隱藏" : "顯示已隱藏";
      renderFaqGrid();
    });
    $("#faqAddForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = cms();
      const msg = $("#faqAddMsg");
      if (!c) return;
      const res = c.addFaqCustom({
        label: $("#faqNewLabel")?.value || "",
        icon: $("#faqNewIcon")?.value || "❓",
        answer: $("#faqNewAnswer")?.value || ""
      });
      if (!res.ok) {
        if (msg) {
          msg.className = "admin-msg err";
          msg.textContent = res.error || "儲存失敗";
        }
        return;
      }
      if (msg) {
        msg.className = "admin-msg ok";
        msg.textContent = "已新增問題";
      }
      $("#faqNewLabel") && ($("#faqNewLabel").value = "");
      $("#faqNewAnswer") && ($("#faqNewAnswer").value = "");
      $("#faqNewIcon") && ($("#faqNewIcon").value = "❓");
      $("#faqAddForm")?.classList.add("hidden");
      renderFaqGrid();
    });

    /* ---- Roadshow CMS ---- */
    $("#rsAddBtn")?.addEventListener("click", () => {
      $("#rsAddForm")?.classList.remove("hidden");
      $("#rsNewDate")?.focus();
    });
    $("#rsAddCancel")?.addEventListener("click", () => {
      $("#rsAddForm")?.classList.add("hidden");
    });
    $("#rsToggleHiddenBtn")?.addEventListener("click", () => {
      rsShowHidden = !rsShowHidden;
      const b = $("#rsToggleHiddenBtn");
      if (b) b.textContent = rsShowHidden ? "收起已隱藏" : "顯示已隱藏";
      renderRoadshow();
    });
    $("#rsAddForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = cms();
      const msg = $("#rsAddMsg");
      if (!c) return;
      const res = c.addRsCustom({
        date: $("#rsNewDate")?.value || "",
        start: ($("#rsNewStart")?.value || "11:00").slice(0, 5),
        end: ($("#rsNewEnd")?.value || "17:00").slice(0, 5),
        area: $("#rsNewArea")?.value || "",
        place: $("#rsNewPlace")?.value || "",
        note: $("#rsNewNote")?.value || ""
      });
      if (!res.ok) {
        if (msg) {
          msg.className = "admin-msg err";
          msg.textContent = res.error || "儲存失敗";
        }
        return;
      }
      if (msg) {
        msg.className = "admin-msg ok";
        msg.textContent = "已新增場次";
      }
      $("#rsAddForm")?.classList.add("hidden");
      ["rsNewPlace", "rsNewNote", "rsNewArea"].forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = "";
      });
      renderRoadshow();
    });

    $("#roadshowList")?.addEventListener("click", (e) => {
      const hideBtn = e.target.closest("[data-rs-hide]");
      if (hideBtn) {
        const key = hideBtn.dataset.rsHide;
        const c = cms();
        if (!c) return;
        if (c.isRsHidden(key)) c.showRs(key);
        else c.hideRs(key);
        renderRoadshow();
        return;
      }
      const delBtn = e.target.closest("[data-rs-del]");
      if (delBtn) {
        if (!confirm("刪除呢個自訂場次？")) return;
        cms()?.removeRsCustom(delBtn.dataset.rsDel);
        renderRoadshow();
      }
    });

    /* ---- Staff notes ---- */
    function bindNoteForm(formId, inputId, kind) {
      $(formId)?.addEventListener("submit", (e) => {
        e.preventDefault();
        const c = cms();
        if (!c) return;
        const res = c.addNote(kind, $(inputId)?.value || "");
        if (!res.ok) {
          alert(res.error || "新增失敗");
          return;
        }
        if ($(inputId)) $(inputId).value = "";
        renderStaffNotes(kind);
      });
    }
    bindNoteForm("#storesNoteForm", "#storesNoteInput", "stores");
    bindNoteForm("#antiNoteForm", "#antiNoteInput", "anti");
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-note-del]");
      if (!btn) return;
      const kind = btn.dataset.noteKind;
      cms()?.removeNote(kind, btn.dataset.noteDel);
      renderStaffNotes(kind);
    });

    /* ---- Gift stock CMS ---- */
    $("#giftAddBtn")?.addEventListener("click", () => {
      $("#giftAddForm")?.classList.remove("hidden");
      $("#giftNewDate")?.focus();
    });
    $("#giftAddCancel")?.addEventListener("click", () => {
      $("#giftAddForm")?.classList.add("hidden");
    });
    $("#giftAddForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = cms();
      const msg = $("#giftAddMsg");
      if (!c || !c.addGiftCustom) return;
      const items = [];
      $$("#giftQtyInputs [data-gift-code]").forEach((inp) => {
        const v = Number(inp.value);
        if (!inp.value || !isFinite(v) || v <= 0) return;
        items.push({ code: inp.dataset.giftCode, qty: Math.round(v) });
      });
      const res = c.addGiftCustom({
        date: $("#giftNewDate")?.value || "",
        dayLabel: $("#giftNewLabel")?.value || "",
        time: $("#giftNewTime")?.value || "",
        place: $("#giftNewPlace")?.value || "",
        items: items
      });
      if (!res.ok) {
        if (msg) {
          msg.className = "admin-msg err";
          msg.textContent = res.error || "儲存失敗";
        }
        return;
      }
      if (msg) {
        msg.className = "admin-msg ok";
        msg.textContent = "已新增贈品日";
      }
      $("#giftAddForm")?.classList.add("hidden");
      ["giftNewLabel", "giftNewTime", "giftNewPlace"].forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = "";
      });
      $$("#giftQtyInputs input").forEach((inp) => {
        inp.value = "";
      });
      renderRoadshow();
    });

    $("#giftAnalytics")?.addEventListener("click", (e) => {
      const hideBtn = e.target.closest("[data-gift-hide]");
      if (hideBtn) {
        const id = hideBtn.dataset.giftHide;
        const c = cms();
        if (!c) return;
        if (c.isGiftHidden(id)) c.showGiftDay(id);
        else c.hideGiftDay(id);
        renderRoadshow();
        return;
      }
      const delBtn = e.target.closest("[data-gift-del]");
      if (delBtn) {
        if (!confirm("刪除呢個自訂贈品日？")) return;
        cms()?.removeGiftCustom(delBtn.dataset.giftDel);
        renderRoadshow();
      }
    });


    /* ---- Blog CMS ---- */
    $("#blogAddBtn")?.addEventListener("click", () => {
      $("#blogAddForm")?.classList.remove("hidden");
      $("#blogNewTitle")?.focus();
    });
    $("#blogAddCancel")?.addEventListener("click", () => {
      $("#blogAddForm")?.classList.add("hidden");
      const msg = $("#blogAddMsg");
      if (msg) msg.className = "admin-msg hidden";
    });
    $("#blogToggleHiddenBtn")?.addEventListener("click", () => {
      blogShowHidden = !blogShowHidden;
      const b = $("#blogToggleHiddenBtn");
      if (b) b.textContent = blogShowHidden ? "收起已隱藏" : "顯示已隱藏";
      renderBlogList();
    });
    $("#blogAddForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = cms();
      const msg = $("#blogAddMsg");
      if (!c || !c.addBlogCustom) return;
      const res = c.addBlogCustom({
        title: $("#blogNewTitle")?.value || "",
        tag: $("#blogNewTag")?.value || "防蚊",
        excerpt: $("#blogNewExcerpt")?.value || "",
        body: $("#blogNewBody")?.value || ""
      });
      if (!res.ok) {
        if (msg) {
          msg.className = "admin-msg err";
          msg.textContent = res.error || "儲存失敗";
        }
        return;
      }
      if (msg) {
        msg.className = "admin-msg ok";
        msg.textContent = "已新增文章";
      }
      ["blogNewTitle", "blogNewExcerpt", "blogNewBody"].forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = "";
      });
      $("#blogAddForm")?.classList.add("hidden");
      renderBlogList();
    });

    $("#blogList")?.addEventListener("click", (e) => {
      const hideBtn = e.target.closest("[data-blog-hide]");
      if (hideBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = hideBtn.dataset.blogHide;
        const c = cms();
        if (!c) return;
        if (c.isBlogHidden(id)) c.showBlog(id);
        else c.hideBlog(id);
        renderBlogList();
        return;
      }
      const delBtn = e.target.closest("[data-blog-del]");
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("刪除呢篇自訂文章？")) return;
        cms()?.removeBlogCustom(delBtn.dataset.blogDel);
        renderBlogList();
        return;
      }
      const card = e.target.closest(".blog-card[data-blog-id]");
      if (card) openBlogPost(card.dataset.blogId);
    });
    $("#blogList")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".blog-card[data-blog-id]");
      if (!card) return;
      e.preventDefault();
      openBlogPost(card.dataset.blogId);
    });
    $("#blogBackBtn")?.addEventListener("click", () => {
      activeBlogId = null;
      location.hash = "#blog";
      renderBlogList();
    });
    $("#blogArticle")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-blog-goto]");
      if (!btn) return;
      const v = btn.dataset.blogGoto;
      activeBlogId = null;
      location.hash = hashForView(v);
      showView(v);
    });

    $("#cmsResetBtn")?.addEventListener("click", () => {
      if (!confirm("還原預設內容？會清走自訂問題、隱藏名單、自訂場次、自訂贈品日、自訂知識文章同職員備註。")) return;
      cms()?.resetAllCms();
      faqShowHidden = false;
      rsShowHidden = false;
      blogShowHidden = false;
      const msg = $("#cmsResetMsg");
      if (msg) {
        msg.className = "admin-msg ok";
        msg.textContent = "已還原預設內容";
      }
      renderFaqGrid();
      renderRoadshow();
      renderBlogList();
      renderStaffNotes("stores");
      renderStaffNotes("anti");
    });

    renderFaqGrid();
    renderChannelStockPanel();
    refreshDistrictOptions();
    setChannel("mannings");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
