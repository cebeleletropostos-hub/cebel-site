// Comportamento compartilhado do site da CEBEL: menu, formulários de WhatsApp, calculadora e filtro de estações.
(function () {
  var cfg = window.CEBEL || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Menu móvel
  var btn = $(".menu-btn"), nav = $("#nav");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      var l = btn.querySelector(".lbl"); if (l) l.textContent = open ? "Fechar" : "Menu";
    });
  }

  // ---------- Origem do visitante (UTM, anúncios, indicação) ----------
  // Guardamos a primeira origem da visita para identificar de onde veio cada lead.
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var origem = (function () {
    var q = new URLSearchParams(location.search), saved = store.get("cebel-origem");
    var src = q.get("utm_source"), med = q.get("utm_medium"), camp = q.get("utm_campaign");
    if (!src && q.get("fbclid")) { src = "meta"; med = med || "anuncio"; }
    if (!src && q.get("gclid")) { src = "google"; med = med || "anuncio"; }
    if (!src && document.referrer) {
      try {
        var host = new URL(document.referrer).hostname.replace(/^www\./, "");
        if (host && host !== location.hostname) {
          src = /instagram/.test(host) ? "instagram" : /facebook|fb\./.test(host) ? "facebook" : /google/.test(host) ? "google" : host;
          med = /google|bing/.test(host) ? "busca" : "link";
        }
      } catch (e) {}
    }
    if (src) {
      var o = { fonte: src, meio: med || "", campanha: camp || "", entrada: location.pathname, data: new Date().toISOString() };
      if (!saved || q.get("utm_source") || q.get("fbclid") || q.get("gclid")) store.set("cebel-origem", o);
      return saved && !(q.get("utm_source") || q.get("fbclid") || q.get("gclid")) ? saved : o;
    }
    return saved || { fonte: "direto", meio: "", campanha: "", entrada: location.pathname };
  })();
  var origemTexto = origem.fonte + (origem.meio ? " / " + origem.meio : "");

  // ---------- Medição (Google e Meta), só depois do consentimento ----------
  var hasTags = !!(cfg.googleTag || cfg.metaPixel);
  var loadTags = function () {
    if (cfg.googleTag && !window.gtag) {
      var g = document.createElement("script"); g.async = true;
      g.src = "https://www.googletagmanager.com/gtag/js?id=" + cfg.googleTag; document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag("js", new Date()); gtag("config", cfg.googleTag);
    }
    if (cfg.metaPixel && !window.fbq) {
      (function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", cfg.metaPixel); fbq("track", "PageView");
    }
  };
  // Eventos: generate_lead (formulário), contact (clique no WhatsApp), calculadora_usada.
  var track = function (name, params) {
    params = params || {};
    try { if (window.gtag) gtag("event", name, params); } catch (e) {}
    try {
      if (window.fbq) {
        if (name === "generate_lead") fbq("track", "Lead", params);
        else if (name === "contact") fbq("track", "Contact", params);
        else fbq("trackCustom", name, params);
      }
    } catch (e) {}
  };
  window.cebelTrack = track;

  var consent = store.get("cebel-consent");
  var banner = $(".consent");
  if (hasTags) {
    if (consent === "sim") loadTags();
    else if (consent !== "nao" && banner) banner.hidden = false;
  }
  if (banner) {
    $(".consent-yes", banner).addEventListener("click", function () { store.set("cebel-consent", "sim"); banner.hidden = true; loadTags(); });
    $(".consent-no", banner).addEventListener("click", function () { store.set("cebel-consent", "nao"); banner.hidden = true; });
  }

  // Cliques em qualquer link de WhatsApp contam como contato.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (a) track("contact", { local: a.className || "link", pagina: location.pathname });
  });

  // ---------- Formulários que viram mensagem de WhatsApp ----------
  // Cada campo com data-label entra na mensagem; data-intro define a primeira linha;
  // data-form identifica o formulário. Se houver endpoint configurado, o lead também vai para a planilha.
  $$("form.wa").forEach(function (form) {
    var done = $(".done", form), err = $(".err", form), pre = $("pre", form), link = $(".wa-link", form), copy = $(".copy", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hp = form.querySelector('input[name="empresa_site"]');
      var missing = [], lines = [form.getAttribute("data-intro") || "Olá, CEBEL!", ""], dados = {};
      $$("[data-label]", form).forEach(function (el) {
        var v = (el.value || "").trim(), lbl = el.getAttribute("data-label");
        if (el.required && !v) missing.push(lbl.toLowerCase());
        if (v) { lines.push(lbl + ": " + v); dados[lbl] = v; }
      });
      if (missing.length) { err.textContent = "Preencha: " + missing.join(", ") + "."; err.hidden = false; return; }
      err.hidden = true;
      lines.push("Origem: " + origemTexto + (origem.campanha ? " (" + origem.campanha + ")" : ""));
      var msg = lines.join("\n");
      pre.textContent = msg;
      link.href = "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(msg);
      done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "nearest" });

      var formName = form.getAttribute("data-form") || "contato";
      track("generate_lead", { formulario: formName, origem: origem.fonte });
      if (cfg.leadsEndpoint && !(hp && hp.value) && !form.dataset.sent) {
        form.dataset.sent = "1";
        var payload = { token: cfg.leadsToken || "", formulario: formName, pagina: location.pathname,
          origem: origem.fonte, meio: origem.meio, campanha: origem.campanha, entrada: origem.entrada, campos: dados };
        try {
          fetch(cfg.leadsEndpoint, { method: "POST", mode: "no-cors", keepalive: true,
            headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        } catch (x) {}
      }
    });
    if (copy) copy.addEventListener("click", function () {
      var t = pre.textContent;
      var sel = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { copy.textContent = "Copiado"; }, sel); else sel();
    });
  });

  // Calculadora de repasse (página Parceiros)
  var calc = $(".calc");
  if (calc) {
    var PRECO = 2.0, ENERGIA = 0.85, IMPOSTO = 0.10, REPASSE = 0.15, DIAS = 30;
    var brl = function (n) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); };
    var num = function (n) { return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }); };
    var s = $("#sessoes"), k = $("#kwh");
    var defaults = { ac: { s: 3, k: 18 }, dc: { s: 6, k: 25 } };
    var run = function () {
      var ses = +s.value, kw = +k.value;
      $("#sessoes-out").textContent = ses;
      $("#kwh-out").textContent = kw + " kWh";
      var kwhMes = ses * kw * DIAS, bruta = kwhMes * PRECO;
      var liquida = Math.max(0, bruta * (1 - IMPOSTO) - kwhMes * ENERGIA), parte = liquida * REPASSE;
      $("#r-parte").textContent = brl(parte);
      $("#r-ano").textContent = brl(parte * 12);
      $("#r-kwh").textContent = num(kwhMes) + " kWh";
      $("#r-bruta").textContent = brl(bruta);
      $("#r-visitas").textContent = num(ses * DIAS);
    };
    $$("input[name=tipo]", calc).forEach(function (r) {
      r.addEventListener("change", function () { var d = defaults[r.value]; s.value = d.s; k.value = d.k; run(); });
    });
    var used = false;
    var mark = function () { if (!used) { used = true; track("calculadora_usada", { pagina: location.pathname }); } };
    s.addEventListener("input", function () { run(); mark(); }); k.addEventListener("input", function () { run(); mark(); });
    run();
  }

  // Copiar endereço das estações
  $$(".copy-addr").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = b.getAttribute("data-copy");
      var ok = function () { b.textContent = "Copiado"; setTimeout(function () { b.textContent = "Copiar"; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () {}); 
    });
  });

  // Recarga simulada na home
  var fill = $(".ls-fill");
  if (fill && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var kwh = 24.6, start = 18.4, end = 32.6, ticks = 0;
    var fmt1 = function (n) { return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
    setInterval(function () {
      kwh = kwh >= end ? start : +(kwh + 0.1).toFixed(1);
      var pct = Math.round(38 + (kwh - start) / (end - start) * 44);
      fill.style.width = pct + "%";
      $("#ls-pct").textContent = pct + "%";
      $("#ls-kwh").textContent = fmt1(kwh);
      $("#ls-brl").textContent = (kwh * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      $("#ls-min").textContent = Math.round(28 + (kwh - start) / (end - start) * 22);
    }, 900);
  }

  // Vídeo: som ligado/desligado e pausa para quem prefere menos movimento
  var reel = $("#reel-video"), snd = $(".reel-sound");
  if (reel && snd) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { reel.removeAttribute("autoplay"); reel.pause(); reel.controls = true; }
    snd.addEventListener("click", function () {
      reel.muted = !reel.muted;
      if (!reel.muted) { reel.currentTime = 0; reel.play(); }
      snd.setAttribute("aria-pressed", reel.muted ? "false" : "true");
      snd.textContent = reel.muted ? "Ativar som" : "Som ativado";
    });
  }

  // Link do app: abre a loja certa para cada celular
  $$(".app-link").forEach(function (a) {
    if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent)) a.href = a.getAttribute("data-ios");
  });

  // Filtro de estações
  var filters = $(".filters");
  if (filters) {
    filters.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $$("button", filters).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var f = b.getAttribute("data-filter");
      $$(".station").forEach(function (st) { st.hidden = f !== "todas" && st.getAttribute("data-status") !== f; });
    });
  }
})();
