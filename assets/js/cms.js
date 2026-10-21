(function () {
  "use strict";

  var PREFIX = "dd_cms_";
  var KEYS = {
    faqCustom: PREFIX + "faq_custom",
    faqHidden: PREFIX + "faq_hidden",
    rsCustom: PREFIX + "rs_custom",
    rsHidden: PREFIX + "rs_hidden",
    giftCustom: PREFIX + "gift_custom",
    giftHidden: PREFIX + "gift_hidden",
    blogCustom: PREFIX + "blog_custom",
    blogHidden: PREFIX + "blog_hidden",
    notesStores: PREFIX + "notes_stores",
    notesAnti: PREFIX + "notes_anti"
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  /* ---- FAQ ---- */
  function getFaqCustom() {
    var list = readJson(KEYS.faqCustom, []);
    return Array.isArray(list) ? list : [];
  }

  function setFaqCustom(list) {
    return writeJson(KEYS.faqCustom, Array.isArray(list) ? list : []);
  }

  function getFaqHidden() {
    var list = readJson(KEYS.faqHidden, []);
    return Array.isArray(list) ? list : [];
  }

  function setFaqHidden(list) {
    return writeJson(KEYS.faqHidden, Array.isArray(list) ? list : []);
  }

  function isFaqHidden(key) {
    return getFaqHidden().indexOf(String(key)) !== -1;
  }

  function hideFaq(key) {
    var list = getFaqHidden();
    var k = String(key);
    if (list.indexOf(k) === -1) {
      list.push(k);
      setFaqHidden(list);
    }
  }

  function showFaq(key) {
    setFaqHidden(getFaqHidden().filter(function (k) { return k !== String(key); }));
  }

  function addFaqCustom(item) {
    var list = getFaqCustom();
    var row = {
      id: uid("faq"),
      label: String(item.label || "").trim(),
      icon: String(item.icon || "❓").trim() || "❓",
      answer: String(item.answer || "").trim(),
      createdAt: new Date().toISOString()
    };
    if (!row.label || !row.answer) return { ok: false, error: "請填題目同答案" };
    list.push(row);
    setFaqCustom(list);
    return { ok: true, item: row };
  }

  function removeFaqCustom(id) {
    setFaqCustom(getFaqCustom().filter(function (x) { return x.id !== id; }));
  }

  function getFaqCustomById(id) {
    return getFaqCustom().find(function (x) { return x.id === id; }) || null;
  }

  /* ---- Roadshow ---- */
  function builtinRsKey(ev) {
    return (
      String(ev.date || "") +
      "|" +
      String(ev.start || "") +
      "|" +
      String(ev.place || "")
    );
  }

  function getRsCustom() {
    var list = readJson(KEYS.rsCustom, []);
    return Array.isArray(list) ? list : [];
  }

  function setRsCustom(list) {
    return writeJson(KEYS.rsCustom, Array.isArray(list) ? list : []);
  }

  function getRsHidden() {
    var list = readJson(KEYS.rsHidden, []);
    return Array.isArray(list) ? list : [];
  }

  function setRsHidden(list) {
    return writeJson(KEYS.rsHidden, Array.isArray(list) ? list : []);
  }

  function isRsHidden(key) {
    return getRsHidden().indexOf(String(key)) !== -1;
  }

  function hideRs(key) {
    var list = getRsHidden();
    var k = String(key);
    if (list.indexOf(k) === -1) {
      list.push(k);
      setRsHidden(list);
    }
  }

  function showRs(key) {
    setRsHidden(getRsHidden().filter(function (k) { return k !== String(key); }));
  }

  function addRsCustom(item) {
    var list = getRsCustom();
    var row = {
      id: uid("rs"),
      date: String(item.date || "").trim(),
      start: String(item.start || "11:00").trim() || "11:00",
      end: String(item.end || "17:00").trim() || "17:00",
      area: String(item.area || "").trim(),
      place: String(item.place || item.title || "").trim(),
      note: String(item.note || "").trim(),
      custom: true,
      createdAt: new Date().toISOString()
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      return { ok: false, error: "請填正確日期（YYYY-MM-DD）" };
    }
    if (!row.place) return { ok: false, error: "請填地點／標題" };
    list.push(row);
    setRsCustom(list);
    return { ok: true, item: row };
  }

  function removeRsCustom(id) {
    setRsCustom(getRsCustom().filter(function (x) { return x.id !== id; }));
  }

  /** Merge built-in + custom, apply hidden. Staff see hidden marked; public excludes hidden. */
  function mergeRoadshowEvents(builtinEvents, opts) {
    opts = opts || {};
    var includeHidden = !!opts.includeHidden;
    var builtin = Array.isArray(builtinEvents) ? builtinEvents : [];
    var hidden = getRsHidden();
    var out = [];

    builtin.forEach(function (ev) {
      var key = builtinRsKey(ev);
      var hid = hidden.indexOf(key) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, ev, {
          _key: key,
          _builtin: true,
          _hidden: hid
        })
      );
    });

    getRsCustom().forEach(function (ev) {
      var key = "custom:" + ev.id;
      var hid = hidden.indexOf(key) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, ev, {
          _key: key,
          _builtin: false,
          _hidden: hid,
          custom: true
        })
      );
    });

    return out;
  }


  /* ---- Roadshow gifts (stock check) ---- */
  function getGiftCustom() {
    var list = readJson(KEYS.giftCustom, []);
    return Array.isArray(list) ? list : [];
  }

  function setGiftCustom(list) {
    return writeJson(KEYS.giftCustom, Array.isArray(list) ? list : []);
  }

  function getGiftHidden() {
    var list = readJson(KEYS.giftHidden, []);
    return Array.isArray(list) ? list : [];
  }

  function setGiftHidden(list) {
    return writeJson(KEYS.giftHidden, Array.isArray(list) ? list : []);
  }

  function isGiftHidden(id) {
    return getGiftHidden().indexOf(String(id)) !== -1;
  }

  function hideGiftDay(id) {
    var list = getGiftHidden();
    var k = String(id);
    if (list.indexOf(k) === -1) {
      list.push(k);
      setGiftHidden(list);
    }
  }

  function showGiftDay(id) {
    setGiftHidden(getGiftHidden().filter(function (k) { return k !== String(id); }));
  }

  function addGiftCustom(item) {
    var list = getGiftCustom();
    var date = String(item.date || "").trim();
    var dayLabel = String(item.dayLabel || "").trim();
    var place = String(item.place || "").trim();
    var time = String(item.time || "").trim();
    var items = Array.isArray(item.items) ? item.items : [];
    var normalized = [];
    items.forEach(function (row) {
      var code = String(row.code || "").trim();
      var qty = Number(row.qty);
      if (!code || !isFinite(qty) || qty < 0) return;
      var out = { code: code, qty: Math.round(qty) };
      if (row.remark) out.remark = String(row.remark).trim();
      normalized.push(out);
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "請填正確日期（YYYY-MM-DD）" };
    }
    if (!normalized.length) {
      return { ok: false, error: "請至少填一項贈品數量" };
    }
    var slots = [];
    if (place || time) {
      slots.push({ time: time || "", place: place || "" });
    }
    var row = {
      id: uid("gift"),
      dayLabel: dayLabel || ("自訂 " + date),
      date: date,
      slots: slots,
      items: normalized,
      custom: true,
      createdAt: new Date().toISOString()
    };
    list.push(row);
    setGiftCustom(list);
    return { ok: true, item: row };
  }

  function removeGiftCustom(id) {
    setGiftCustom(getGiftCustom().filter(function (x) { return x.id !== id; }));
  }

  /** Merge baked-in gift days + custom; apply hidden. */
  function mergeGiftDays(builtinDays, opts) {
    opts = opts || {};
    var includeHidden = !!opts.includeHidden;
    var builtin = Array.isArray(builtinDays) ? builtinDays : [];
    var hidden = getGiftHidden();
    var out = [];

    builtin.forEach(function (day) {
      var id = String(day.id || "");
      var hid = hidden.indexOf(id) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, day, {
          _builtin: true,
          _hidden: hid,
          custom: false
        })
      );
    });

    getGiftCustom().forEach(function (day) {
      var id = String(day.id || "");
      var hid = hidden.indexOf(id) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, day, {
          _builtin: false,
          _hidden: hid,
          custom: true
        })
      );
    });

    out.sort(function (a, b) {
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
    return out;
  }


  /* ---- Blog ---- */
  function getBlogCustom() {
    var list = readJson(KEYS.blogCustom, []);
    return Array.isArray(list) ? list : [];
  }

  function setBlogCustom(list) {
    return writeJson(KEYS.blogCustom, Array.isArray(list) ? list : []);
  }

  function getBlogHidden() {
    var list = readJson(KEYS.blogHidden, []);
    return Array.isArray(list) ? list : [];
  }

  function setBlogHidden(list) {
    return writeJson(KEYS.blogHidden, Array.isArray(list) ? list : []);
  }

  function isBlogHidden(id) {
    return getBlogHidden().indexOf(String(id)) !== -1;
  }

  function hideBlog(id) {
    var list = getBlogHidden();
    var k = String(id);
    if (list.indexOf(k) === -1) {
      list.push(k);
      setBlogHidden(list);
    }
  }

  function showBlog(id) {
    setBlogHidden(getBlogHidden().filter(function (k) { return k !== String(id); }));
  }

  function addBlogCustom(item) {
    var list = getBlogCustom();
    var paras = String(item.body || "")
      .split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    var row = {
      id: uid("blog"),
      title: String(item.title || "").trim(),
      tag: String(item.tag || "防蚊").trim() || "防蚊",
      date: new Date().toISOString().slice(0, 10),
      excerpt: String(item.excerpt || "").trim(),
      sections: paras.length
        ? [{ h: "", paragraphs: paras }]
        : [],
      custom: true,
      createdAt: new Date().toISOString()
    };
    if (!row.title || !row.excerpt || !paras.length) {
      return { ok: false, error: "請填標題、摘要同正文" };
    }
    list.unshift(row);
    setBlogCustom(list);
    return { ok: true, item: row };
  }

  function removeBlogCustom(id) {
    setBlogCustom(getBlogCustom().filter(function (x) { return x.id !== id; }));
  }

  function mergeBlogPosts(builtinPosts, includeHidden) {
    var builtin = Array.isArray(builtinPosts) ? builtinPosts : [];
    var hidden = getBlogHidden();
    var out = [];

    builtin.forEach(function (post) {
      var id = String(post.id || "");
      var hid = hidden.indexOf(id) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, post, {
          _builtin: true,
          _hidden: hid,
          custom: false
        })
      );
    });

    getBlogCustom().forEach(function (post) {
      var id = String(post.id || "");
      var hid = hidden.indexOf(id) !== -1;
      if (hid && !includeHidden) return;
      out.push(
        Object.assign({}, post, {
          _builtin: false,
          _hidden: hid,
          custom: true
        })
      );
    });

    out.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    return out;
  }

  /* ---- Staff notes ---- */
  function getNotes(kind) {
    var key = kind === "anti" ? KEYS.notesAnti : KEYS.notesStores;
    var list = readJson(key, []);
    return Array.isArray(list) ? list : [];
  }

  function setNotes(kind, list) {
    var key = kind === "anti" ? KEYS.notesAnti : KEYS.notesStores;
    return writeJson(key, Array.isArray(list) ? list : []);
  }

  function addNote(kind, text) {
    var t = String(text || "").trim();
    if (!t) return { ok: false, error: "請填備註" };
    var list = getNotes(kind);
    var row = { id: uid("note"), text: t, createdAt: new Date().toISOString() };
    list.unshift(row);
    setNotes(kind, list);
    return { ok: true, item: row };
  }

  function removeNote(kind, id) {
    setNotes(
      kind,
      getNotes(kind).filter(function (x) { return x.id !== id; })
    );
  }

  /** Clear CMS keys only — not login creds */
  function resetAllCms() {
    Object.keys(KEYS).forEach(function (k) {
      try {
        localStorage.removeItem(KEYS[k]);
      } catch (e) {
        /* ignore */
      }
    });
  }

  function listCmsKeys() {
    return Object.keys(KEYS).map(function (k) { return KEYS[k]; });
  }

  window.DDCms = {
    KEYS: KEYS,
    uid: uid,
    getFaqCustom: getFaqCustom,
    setFaqCustom: setFaqCustom,
    getFaqHidden: getFaqHidden,
    isFaqHidden: isFaqHidden,
    hideFaq: hideFaq,
    showFaq: showFaq,
    addFaqCustom: addFaqCustom,
    removeFaqCustom: removeFaqCustom,
    getFaqCustomById: getFaqCustomById,
    builtinRsKey: builtinRsKey,
    getRsCustom: getRsCustom,
    getRsHidden: getRsHidden,
    isRsHidden: isRsHidden,
    hideRs: hideRs,
    showRs: showRs,
    addRsCustom: addRsCustom,
    removeRsCustom: removeRsCustom,
    mergeRoadshowEvents: mergeRoadshowEvents,
    getGiftCustom: getGiftCustom,
    getGiftHidden: getGiftHidden,
    isGiftHidden: isGiftHidden,
    hideGiftDay: hideGiftDay,
    showGiftDay: showGiftDay,
    addGiftCustom: addGiftCustom,
    removeGiftCustom: removeGiftCustom,
    mergeGiftDays: mergeGiftDays,
    getNotes: getNotes,
    addNote: addNote,
    removeNote: removeNote,
    getBlogCustom: getBlogCustom,
    getBlogHidden: getBlogHidden,
    isBlogHidden: isBlogHidden,
    hideBlog: hideBlog,
    showBlog: showBlog,
    addBlogCustom: addBlogCustom,
    removeBlogCustom: removeBlogCustom,
    mergeBlogPosts: mergeBlogPosts,
    resetAllCms: resetAllCms,
    listCmsKeys: listCmsKeys
  };
})();
