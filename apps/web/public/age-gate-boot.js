(function () {
  try {
    if (localStorage.getItem("xr_age_gate_ok") === "1") return;

    var html = document.documentElement;
    html.classList.add("age-gate-pending");

    var lang = "ru";
    try {
      var saved = localStorage.getItem("xr_lang_pref");
      if (saved === "en" || saved === "ru") lang = saved;
      else if (/^\/en(\/|$)/.test(location.pathname)) lang = "en";
      else {
        var m = document.cookie.match(/(?:^|;\s*)xr_lang=([^;]+)/);
        if (m && (m[1] === "en" || m[1] === "ru")) lang = decodeURIComponent(m[1]);
      }
    } catch (e) {}

    var texts = {
      ru: {
        title: "Только для взрослых 18+",
        lead: "Сайт содержит материалы об онлайн-казино и азартных играх. Перед входом подтвердите возраст и согласие с рисками.",
        points: [
          "Вам уже исполнилось 18 лет",
          "Азартные игры могут вызывать зависимость и финансовые потери",
          "Контент информационный; это не призыв играть и не гарантия выигрыша",
          "Если гемблинг запрещён в вашей юрисдикции — не используйте партнёрские ссылки",
        ],
        note: "Подробнее об ответственной игре:",
        responsibleLink: "ответственная игра",
        responsibleHref: "/ru/legal/responsible-gambling",
        confirm: "Мне есть 18 лет, я согласен",
        leave: "Мне нет 18 / уйти с сайта",
        language: "Язык",
      },
      en: {
        title: "Adults 18+ only",
        lead: "This site covers online casinos and gambling. Confirm your age and that you understand the risks before entering.",
        points: [
          "You are 18 years of age or older",
          "Gambling can be addictive and may cause financial loss",
          "Content is informational — not an invitation to gamble or a promise of winnings",
          "If gambling is restricted where you live, do not use affiliate links",
        ],
        note: "More on responsible gambling:",
        responsibleLink: "responsible gambling",
        responsibleHref: "/en/legal/responsible-gambling",
        confirm: "I am 18+ and I agree",
        leave: "Under 18 / leave site",
        language: "Language",
      },
    };

    var copy = texts[lang] || texts.ru;

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }

    function setLang(next) {
      try {
        localStorage.setItem("xr_lang_pref", next);
        document.cookie = "xr_lang=" + next + ";path=/;max-age=31536000;samesite=lax";
      } catch (e) {}
      var path = location.pathname.replace(/^\/(ru|en)(?=\/|$)/, "/" + next);
      if (path === location.pathname && !/^\/(ru|en)(\/|$)/.test(path)) {
        path = "/" + next + (path === "/" ? "" : path);
      }
      location.href = path + location.search + location.hash;
    }

    function acceptAndGo(href) {
      try {
        localStorage.setItem("xr_age_gate_ok", "1");
        localStorage.setItem("xr_lang_pref", lang);
      } catch (e) {}
      html.classList.remove("age-gate-pending");
      if (root.parentNode) root.parentNode.removeChild(root);
      if (href) location.href = href;
    }

    var root = el("div", "age-gate-boot");
    root.id = "age-gate-boot";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    var blur = el("div", "age-gate-boot__blur");
    blur.setAttribute("aria-hidden", "true");
    root.appendChild(blur);

    var card = el("div", "age-gate-boot__card");

    var top = el("div", "age-gate-boot__top");
    top.appendChild(el("div", "age-gate-boot__badge", "18+"));

    var langs = el("div", "age-gate-boot__langs");
    langs.setAttribute("role", "group");
    langs.setAttribute("aria-label", copy.language);
    ["ru", "en"].forEach(function (code) {
      var btn = el("button", "age-gate-boot__lang" + (code === lang ? " on" : ""), code.toUpperCase());
      btn.type = "button";
      btn.setAttribute("aria-pressed", code === lang ? "true" : "false");
      btn.addEventListener("click", function () {
        if (code !== lang) setLang(code);
      });
      langs.appendChild(btn);
    });
    top.appendChild(langs);
    card.appendChild(top);

    card.appendChild(el("h2", "age-gate-boot__title", copy.title));
    card.appendChild(el("p", "age-gate-boot__lead", copy.lead));

    var list = el("ul", "age-gate-boot__points");
    copy.points.forEach(function (p) {
      list.appendChild(el("li", null, p));
    });
    card.appendChild(list);

    var note = el("p", "age-gate-boot__note");
    note.appendChild(document.createTextNode(copy.note + " "));
    var link = el("a", "age-gate-boot__link", copy.responsibleLink);
    link.href = copy.responsibleHref;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      acceptAndGo(copy.responsibleHref);
    });
    note.appendChild(link);
    card.appendChild(note);

    var actions = el("div", "age-gate-boot__actions");
    var ok = el("button", "age-gate-boot__ok", copy.confirm);
    ok.type = "button";
    ok.addEventListener("click", function () {
      acceptAndGo(null);
    });
    var leave = el("button", "age-gate-boot__leave", copy.leave);
    leave.type = "button";
    leave.addEventListener("click", function () {
      location.href = "https://www.google.com";
    });
    actions.appendChild(ok);
    actions.appendChild(leave);
    card.appendChild(actions);
    root.appendChild(card);

    function mount() {
      if (!document.body) {
        document.addEventListener("DOMContentLoaded", mount, { once: true });
        return;
      }
      document.body.appendChild(root);
    }
    mount();
  } catch (e) {
    try {
      document.documentElement.classList.add("age-gate-pending");
    } catch (e2) {}
  }
})();
