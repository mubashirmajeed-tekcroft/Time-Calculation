/* ===== Calcul Heure — logique ===== */
(function () {
  "use strict";

  var SITE = "https://time-calculation-france.vercel.app/";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- format ---------- */
  function hm(mins) {
    mins = Math.max(0, Math.round(mins));
    var h = Math.floor(mins / 60), m = mins % 60;
    return h + "h " + (m < 10 ? "0" + m : m) + "m";
  }
  function dec(mins) {
    return (Math.max(0, mins) / 60).toFixed(2).replace(".", ",");
  }
  function clock(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }
  function nf(v, d) { return v.toLocaleString("fr-FR", { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 2 : d }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function toMin(v) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /* ---------- mode ---------- */
  var mode = "quotidien";
  document.querySelectorAll(".ch-mode").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".ch-mode").forEach(function (x) { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
      b.classList.add("is-active"); b.setAttribute("aria-selected", "true");
      mode = b.dataset.mode;
      $("chDaysField").hidden = mode !== "mensuel";
      $("chWeekField").hidden = mode !== "hebdomadaire";
    });
  });

  /* ---------- state ---------- */
  var state = null;
  var toastT;
  function toast(msg) { $("chToast").textContent = msg; clearTimeout(toastT); toastT = setTimeout(function () { $("chToast").textContent = ""; }, 2800); }
  function bad(el, msg) { el.classList.add("is-bad"); $("chError").textContent = msg; el.focus(); }

  $("chNew").addEventListener("click", showForm);

  function showForm() {
    state = null;
    $("chResult").hidden = true;
    $("chForm").hidden = false;
    $("chIntro").hidden = false;
    $("chStart").focus();
  }

  function showResult() {
    $("chForm").hidden = true;
    $("chIntro").hidden = true;
    $("chResult").hidden = false;
  }

  document.querySelectorAll(".ch-input").forEach(function (el) {
    el.addEventListener("input", function () { el.classList.remove("is-bad"); });
  });

  /* ---------- calculate ---------- */
  $("chCalc").addEventListener("click", calculate);

  function calculate() {
    $("chError").textContent = "";
    document.querySelectorAll(".ch-input").forEach(function (i) { i.classList.remove("is-bad"); });

    var start = toMin($("chStart").value), end = toMin($("chEnd").value);
    if (start === null) return bad($("chStart"), "Heure de début invalide.");
    if (end === null) return bad($("chEnd"), "Heure de fin invalide.");

    var overnight = $("chOvernight").checked;
    var gross = end - start;
    var wrapped = false;
    if (overnight || gross <= 0) { gross += 1440; wrapped = true; }
    if (gross <= 0 || gross > 1440) return bad($("chEnd"), "Plage horaire invalide.");

    var brk = parseInt($("chBreak").value, 10);
    if (isNaN(brk) || brk < 0) brk = 0;
    if (brk >= gross) return bad($("chBreak"), "La pause ne peut pas dépasser la durée totale.");

    var net = gross - brk;   // minutes de travail effectif par jour

    state = { mode: mode, start: start, end: end, wrapped: wrapped, gross: gross, brk: brk, net: net };

    if (mode === "quotidien") {
      state.days = 1; state.periodNet = net; state.periodLabel = "journalier";
    } else if (mode === "hebdomadaire") {
      var wd = parseInt($("chWeekDays").value, 10);
      if (isNaN(wd) || wd < 1 || wd > 7) return bad($("chWeekDays"), "Jours par semaine : 1 à 7.");
      state.days = wd; state.periodNet = net * wd; state.periodLabel = "hebdomadaire";
    } else {
      var md = parseInt($("chDays").value, 10);
      if (isNaN(md) || md < 1 || md > 31) return bad($("chDays"), "Jours par mois : 1 à 31.");
      state.days = md; state.periodNet = net * md; state.periodLabel = "mensuel";
    }

    paint();
  }

  function paint() {
    var s = state;
    var badge = { quotidien: "Quotidien", hebdomadaire: "Hebdomadaire", mensuel: "Mensuel" }[s.mode];
    $("chResBadge").textContent = badge;

    // main figure = période nette
    $("chMain").textContent = hm(s.periodNet);
    $("chMainCap").textContent = "de travail effectif (" + s.periodLabel + ")";
    $("chResDesc").textContent = hm(s.periodNet) + "  ·  " + dec(s.periodNet) + " h décimales";

    var stats = [
      ["Travail effectif / jour", hm(s.net)],
      ["Durée totale (amplitude)", hm(s.gross)],
      ["Pause déduite", s.brk + " min"],
      ["Format décimal / jour", dec(s.net) + " h"]
    ];
    if (s.mode !== "quotidien") {
      stats.push(["Jours", s.days + (s.mode === "mensuel" ? " j/mois" : " j/sem")]);
      stats.push(["Total " + s.periodLabel, hm(s.periodNet) + " · " + dec(s.periodNet) + " h"]);
    }
    $("chStats").innerHTML = stats.map(function (st) {
      return '<div class="ch-stat"><span class="ch-stat-cap">' + esc(st[0]) + '</span><span class="ch-stat-num">' + esc(st[1]) + "</span></div>";
    }).join("");

    // heures supplémentaires (base légale 35h/sem)
    var ot = $("chOvertime");
    var weeklyMin = s.mode === "hebdomadaire" ? s.periodNet
                  : s.mode === "quotidien" ? s.net * 5
                  : s.periodNet / (s.days / 5);   // approx hebdo à partir du mensuel
    var supMin = Math.max(0, weeklyMin - 35 * 60);
    if (supMin > 0) {
      var t25 = Math.min(supMin, 8 * 60);
      var t50 = Math.max(0, supMin - 8 * 60);
      s.overtime = { supMin: supMin, t25: t25, t50: t50, weeklyMin: weeklyMin };
      ot.hidden = false;
      ot.innerHTML = '<p class="ch-overtime-title">Heures supplémentaires (base 35 h/semaine)</p><ul>' +
        "<li><span>Base " + (s.mode === "quotidien" ? "estimée (× 5 jours)" : "hebdomadaire") + "</span><b>" + hm(weeklyMin) + "</b></li>" +
        "<li><span>Heures supplémentaires</span><b>" + hm(supMin) + "</b></li>" +
        "<li><span>Majorées à +25 % (36e–43e h)</span><b>" + hm(t25) + "</b></li>" +
        "<li><span>Majorées à +50 % (dès 44e h)</span><b>" + hm(t50) + "</b></li></ul>";
    } else {
      s.overtime = null;
      ot.hidden = true;
    }

    // amplitude légale 13h
    var ampWarn = s.gross > 13 * 60
      ? " ⚠️ L'amplitude dépasse la limite légale de 13 h en France."
      : "";
    $("chAmplitude").textContent = "Amplitude journalière : " + hm(s.gross) + " (arrivée → départ, pauses comprises). Temps de travail effectif : " + hm(s.net) + "." + ampWarn;

    showResult();
  }

  /* ---------- share ---------- */
  function shareText() {
    if (!state) return "";
    var s = state, l = ["Calcul Heure — " + { quotidien: "Quotidien", hebdomadaire: "Hebdomadaire", mensuel: "Mensuel" }[s.mode]];
    l.push("Horaire : " + clock(s.start) + " → " + clock(s.end) + (s.wrapped ? " (après minuit)" : "") + " · pause " + s.brk + " min");
    l.push("Travail effectif / jour : " + hm(s.net) + " (" + dec(s.net) + " h)");
    if (s.mode !== "quotidien") l.push("Total " + s.periodLabel + " : " + hm(s.periodNet) + " (" + dec(s.periodNet) + " h)");
    if (s.overtime) l.push("Heures sup : " + hm(s.overtime.supMin) + " (+25 % : " + hm(s.overtime.t25) + ", +50 % : " + hm(s.overtime.t50) + ")");
    l.push("", "Calculez : " + SITE);
    return l.join("\n");
  }
  $("chWa").addEventListener("click", function () {
    if (!state) return;
    window.open("https://wa.me/?text=" + encodeURIComponent(shareText()), "_blank", "noopener");
  });

  $("chShare").addEventListener("click", async function () {
    if (!state) return;
    var text = shareText();
    if (navigator.share) {
      try { await navigator.share({ title: "Calcul Heure", text: text, url: SITE }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); toast("Résultat copié dans le presse-papiers."); }
    catch (e) { toast("Copie impossible. Copiez manuellement."); }
  });

  /* ---------- PDF ---------- */
  $("chPdf").addEventListener("click", function () {
    if (!state) return;
    var ns = window.jspdf;
    if (!ns || !ns.jsPDF) { window.print(); return; }

    var ascii = function (str) { return String(str).replace(/[^\x20-\x7E]/g, function (c) {
      var map = { "é": "e", "è": "e", "ê": "e", "ë": "e", "à": "a", "â": "a", "ù": "u", "û": "u", "ô": "o", "î": "i", "ï": "i", "ç": "c", "É": "E", "È": "E", "À": "A", "→": "->", "×": "x", "⚠️": "!", "’": "'" };
      return map[c] || "";
    }); };

    var s = state;
    var doc = new ns.jsPDF({ unit: "pt", format: "a4" });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var M = 48, cx = W / 2;

    doc.setFillColor(11, 21, 36);
    doc.rect(0, 0, W, 84, "F");
    doc.setTextColor(18, 184, 134).setFont("helvetica", "bold").setFontSize(18);
    doc.text("Calcul Heure", cx, 40, { align: "center" });
    doc.setTextColor(210, 220, 232).setFont("helvetica", "normal").setFontSize(10);
    doc.text(ascii("Mode " + { quotidien: "Quotidien", hebdomadaire: "Hebdomadaire", mensuel: "Mensuel" }[s.mode] +
      "  |  " + clock(s.start) + " -> " + clock(s.end) + "  |  pause " + s.brk + " min"), cx, 62, { align: "center" });

    var y = 130;
    doc.setFont("helvetica", "bold").setFontSize(28).setTextColor(11, 21, 36);
    doc.text(ascii(hm(s.periodNet)), cx, y, { align: "center" }); y += 24;
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(107, 118, 134);
    doc.text(ascii("Travail effectif " + s.periodLabel + " — " + dec(s.periodNet) + " h decimales"), cx, y, { align: "center" }); y += 34;

    var rows = [
      ["Travail effectif / jour", hm(s.net) + "  (" + dec(s.net) + " h)"],
      ["Amplitude (arrivee -> depart)", hm(s.gross)],
      ["Pause deduite", s.brk + " min"]
    ];
    if (s.mode !== "quotidien") rows.push(["Total " + s.periodLabel, hm(s.periodNet) + "  (" + dec(s.periodNet) + " h)"]);
    if (s.overtime) {
      rows.push(["Heures supplementaires", hm(s.overtime.supMin)]);
      rows.push(["  dont +25% (36e-43e h)", hm(s.overtime.t25)]);
      rows.push(["  dont +50% (des 44e h)", hm(s.overtime.t50)]);
    }
    doc.setDrawColor(227, 231, 237);
    rows.forEach(function (r) {
      doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(107, 118, 134);
      doc.text(ascii(r[0]), M, y);
      doc.setFont("helvetica", "bold").setTextColor(26, 36, 51);
      doc.text(ascii(r[1]), W - M, y, { align: "right" });
      y += 14; doc.line(M, y, W - M, y); y += 16;
    });

    y += 8;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(130, 140, 155);
    doc.text(doc.splitTextToSize(ascii("Amplitude journaliere max en France : 13 h. Duree legale du travail : 35 h/semaine. Heures sup majorees +25% (8 premieres) puis +50%."), W - M * 2), M, y);

    doc.setFontSize(8.5).setTextColor(160, 168, 180);
    doc.text(SITE, cx, H - 30, { align: "center" });

    doc.save("calcul-heure-" + s.mode + ".pdf");
    toast("PDF téléchargé.");
  });
})();
