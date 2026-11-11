(function () {
  try {
    var t = localStorage.getItem("xr_theme");
    if (t !== "light" && t !== "dark") {
      // Prefer cookie if localStorage empty (SSR already used it)
      var m = document.cookie.match(/(?:^|;\s*)xr_theme=([^;]+)/);
      if (m && (m[1] === "light" || m[1] === "dark")) t = m[1];
      else t = "dark";
    }
    document.documentElement.setAttribute("data-theme", t);
    document.cookie = "xr_theme=" + t + ";path=/;max-age=31536000;samesite=lax";
    try {
      localStorage.setItem("xr_theme", t);
    } catch (e) {}
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
