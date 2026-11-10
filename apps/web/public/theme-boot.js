(function () {
  try {
    var t = localStorage.getItem("xr_theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
