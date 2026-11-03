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

  // Formulários que viram mensagem de WhatsApp.
  // Cada campo com data-label entra na mensagem; data-intro define a primeira linha.
  $$("form.wa").forEach(function (form) {
    var done = $(".done", form), err = $(".err", form), pre = $("pre", form), link = $(".wa-link", form), copy = $(".copy", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var missing = [], lines = [form.getAttribute("data-intro") || "Olá, CEBEL!", ""];
      $$("[data-label]", form).forEach(function (el) {
        var v = (el.value || "").trim();
        if (el.required && !v) missing.push(el.getAttribute("data-label").toLowerCase());
        if (v) lines.push(el.getAttribute("data-label") + ": " + v);
      });
      if (missing.length) { err.textContent = "Preencha: " + missing.join(", ") + "."; err.hidden = false; return; }
      err.hidden = true;
      var msg = lines.join("\n");
      pre.textContent = msg;
      link.href = "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(msg);
      done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    s.addEventListener("input", run); k.addEventListener("input", run);
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

  // Painel do carregador no topo da home: animação leve da recarga
  var ring = $(".charger .prog");
  if (ring && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var kwhEl = $("#ch-kwh"), brlEl = $("#ch-brl"), pctEl = $("#ch-pct"), C = 2 * Math.PI * 88;
    var kwh = 18.4, target = 32.6;
    var tick = function () {
      kwh = kwh >= target ? 18.4 : +(kwh + 0.1).toFixed(1);
      var pct = Math.round(38 + (kwh - 18.4) / (target - 18.4) * 44);
      ring.style.strokeDashoffset = C * (1 - pct / 100);
      pctEl.textContent = pct + "%";
      kwhEl.textContent = kwh.toLocaleString("pt-BR", { minimumFractionDigits: 1 });
      brlEl.textContent = (kwh * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };
    setInterval(tick, 900);
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
