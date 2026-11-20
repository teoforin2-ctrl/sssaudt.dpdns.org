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
        title: "Только для совершеннолетних 18+",
        lead: "Сайт содержит материалы об онлайн-казино и азартных играх. Перед входом подтвердите возраст и согласие с рисками.",
        points: [
          "Вам 18 лет или больше",
          "Азартные игры могут вызывать зависимость и приводить к финансовым потерям",
          "Контент носит информационный характер — это не призыв к игре и не обещание выигрыша",
          "Если азартные игры запрещены в вашей юрисдикции, не используйте партнёрские ссылки",
        ],
        note: "Подробнее об ответственной игре:",
        responsibleLink: "Политика ответственной игры на сайте",
        responsibleHref: "/ru/legal/responsible-gambling",
        confirm: "Мне 18+, согласен",
        leave: "Мне меньше 18 / покинуть сайт",
        language: "Язык",
      },
      en: {
        title: "Adults 18+ only",
        lead: "This site covers online casinos and gambling. Confirm your age and that you understand the risks before entering.",
        points: [
          "You are 18 years of age or older",
          "Gambling can be addictive and may lead to financial loss",
          "Content is informational — not a call to gamble or a promise of winnings",
          "If gambling is prohibited in your jurisdiction, do not use affiliate links",
        ],
        note: "More on responsible gambling:",
        responsibleLink: "Our responsible gambling policy",
        responsibleHref: "/en/legal/responsible-gambling",
        confirm: "I am 18+, I agree",
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
    root.setAttribute("aria-labelledby", "age-gate-boot-title");
    root.setAttribute("aria-label", copy.title);

    var blur = el("div", "age-gate-boot__blur");
    blur.setAttribute("aria-hidden", "true");
    root.appendChild(blur);

    var card = el("div", "age-gate-boot__card");

    var brand = el("div", "age-gate-boot__brand");
    var logo = document.createElement("img");
    logo.className = "age-gate-boot__logo";
    logo.src = "/img/brand/logo.webp";
    logo.alt = "SSS Audit";
    logo.width = 180;
    logo.height = 48;
    logo.decoding = "async";
    brand.appendChild(logo);
    card.appendChild(brand);

    var badge = el("div", "age-gate-boot__badge");
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>18+</span>';
    card.appendChild(badge);

    var titleEl = el("h2", "age-gate-boot__title", copy.title);
    titleEl.id = "age-gate-boot-title";
    card.appendChild(titleEl);
    card.appendChild(el("p", "age-gate-boot__lead", copy.lead));

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
    card.appendChild(langs);

    var list = el("ul", "age-gate-boot__points");
    copy.points.forEach(function (p) {
      var li = el("li");
      var check = el("span", "age-gate-boot__check");
      check.setAttribute("aria-hidden", "true");
      check.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      li.appendChild(check);
      li.appendChild(el("span", null, p));
      list.appendChild(li);
    });
    card.appendChild(list);

    var note = el("p", "age-gate-boot__note");
    note.appendChild(document.createTextNode(copy.note + " "));
    var ext = el("a", "age-gate-boot__ext", "BeGambleAware");
    ext.href = "https://www.begambleaware.org/";
    ext.target = "_blank";
    ext.rel = "noopener noreferrer";
    note.appendChild(ext);
    card.appendChild(note);

    var policy = el("p", "age-gate-boot__policy");
    var link = el("a", "age-gate-boot__link", copy.responsibleLink);
    link.href = copy.responsibleHref;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      acceptAndGo(copy.responsibleHref);
    });
    policy.appendChild(link);
    card.appendChild(policy);

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
