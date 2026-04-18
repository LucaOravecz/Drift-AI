(function () {
  try {
    var stored = localStorage.getItem("drift-theme");
    var isDark = stored ? stored === "dark" : false;
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  } catch (e) {}
})();
