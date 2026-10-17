(function () {
  "use strict";

  const products = window.DD_PRODUCTS || [];
  const stores = window.DD_STORES || { mannings: [], watsons: [] };
  const globalFaq = window.DD_GLOBAL_FAQ || {};

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fmtTel(tel) {
    const d = String(tel).replace(/\D/g, "");
    if (d.length === 8) return d.slice(0, 4) + " " + d.slice(4);
    return tel;
  }

  function getProduct() {
    const id = $("#productSelect")?.value;
    return products.find((p) => p.id === id) || products[0];
  }

  function renderProductMeta(p) {
    const el = $("#productMeta");
    if (!el || !p) return;
    const tags = [];
    if (p.nonDeet) tags.push('<span class="tag ok">non-DEET</span>');
    if (p.noCamphorOfficial) tags.push('<span class="tag ok">官網：不含樟腦</span>');
    if (p.containsCamphor) tags.push('<span class="tag danger">含樟腦（第三方）</span>');
    if (p.riskFlag) tags.push('<span class="tag danger">需特別注意</span>');
    if (p.registration) tags.push(`<span class="tag">註冊 ${p.registration}</span>`);
    tags.push(`<span class="tag">${p.form}</span>`);
    tags.push(`<span class="tag">${p.volume}</span>`);

    el.innerHTML = `
      <strong>${p.name}</strong>
      <div>主要成份：${p.actives}</div>
      <div>適用年齡／用法對象：${p.age}</div>
      <div class="tag-row">${tags.join("")}</div>
    `;
  }

  function answerBoxClass(p, key) {
    if (key === "g6pd" && p.containsCamphor) return "answer danger-box";
    if (key === "g6pd") return "answer warn-box";
    if (p.riskFlag && (key === "ingredients" || key === "usage")) return "answer warn-box";
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
      body =
        `【${p.name}】邊度買？\n\n` +
        `• 萬寧：${ch.mannings ? "有售（請致電該舖確認庫存）" : "請向門店確認／未必有售"}\n` +
        `• 屈臣氏：${ch.watsons ? "有售（請致電該舖確認庫存）" : "請向門店確認／未必有售"}\n` +
        `• 其他渠道：${ch.others || "部分店有售／非全線"}\n\n` +
        (globalFaq.buyIntro || "");
      links =
        `<a class="btn-link" href="#stores">去查萬寧／屈臣氏分店電話</a>` +
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
    $$(".chip").forEach((c) => c.classList.toggle("active", c.dataset.q === key));
  }

  function fillProductSelect() {
    const sel = $("#productSelect");
    if (!sel) return;
    sel.innerHTML = products
      .map((p) => {
        const flag = p.containsCamphor ? " ⚠" : "";
        return `<option value="${p.id}">${p.name}${flag}</option>`;
      })
      .join("");
    renderProductMeta(getProduct());
  }

  /* ---- Stores ---- */
  let storeChannel = "mannings";

  function districtsFor(list) {
    const set = new Set(list.map((s) => s.district));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }

  function currentStoreList() {
    if (storeChannel === "mannings") return stores.mannings || [];
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
    if (!listEl) return;

    if (storeChannel === "other") {
      filtersEl?.classList.add("hidden");
      listEl.classList.add("hidden");
      if (countEl) countEl.textContent = "";
      otherEl?.classList.remove("hidden");
      return;
    }

    filtersEl?.classList.remove("hidden");
    listEl.classList.remove("hidden");
    otherEl?.classList.add("hidden");

    const q = ($("#storeSearch")?.value || "").trim().toLowerCase();
    const district = $("#districtSelect")?.value || "";
    let list = currentStoreList().filter((s) => {
      if (district && s.district !== district) return false;
      if (!q) return true;
      const blob = `${s.name} ${s.address} ${s.district}`.toLowerCase();
      return blob.includes(q);
    });

    if (countEl) {
      const brand = storeChannel === "mannings" ? "萬寧" : "屈臣氏";
      countEl.textContent = `顯示 ${list.length} 間${brand}分店（靜態名單，非即時庫存）`;
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

    listEl.innerHTML = list
      .map(
        (s) => `
      <article class="store-card">
        <h4>${s.name}</h4>
        <p class="addr">${s.district}　${s.address}</p>
        <a class="tel-btn" href="tel:${s.tel}">📞 ${fmtTel(s.tel)}</a>
        <p class="note">請致電確認有冇貨（本頁不顯示即時庫存）</p>
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
      refreshDistrictOptions();
      renderStores();
    }
  }

  function init() {
    fillProductSelect();
    $("#productSelect")?.addEventListener("change", () => {
      renderProductMeta(getProduct());
      const active = $(".chip.active");
      if (active) showAnswer(active.dataset.q);
      else {
        const box = $("#answerPanel");
        if (box) {
          box.className = "answer empty";
          box.textContent = "揀咗產品後，撳下面問題掣即睇答案。";
        }
      }
    });

    $$(".chip").forEach((chip) => {
      chip.addEventListener("click", () => showAnswer(chip.dataset.q));
    });

    $$(".nav-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });

    // deep link #stores
    if (location.hash === "#stores") showView("stores");
    window.addEventListener("hashchange", () => {
      if (location.hash === "#stores") showView("stores");
      if (location.hash === "#qa" || location.hash === "") showView("qa");
    });

    $$(".seg button").forEach((btn) => {
      btn.addEventListener("click", () => setChannel(btn.dataset.channel));
    });
    $("#districtSelect")?.addEventListener("change", renderStores);
    $("#storeSearch")?.addEventListener("input", renderStores);

    refreshDistrictOptions();
    setChannel("mannings");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
