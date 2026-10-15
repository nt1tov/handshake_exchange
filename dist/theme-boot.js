(function () {
  var preferences = { language: 'ru', theme: 'auto' };
  try {
    var saved = JSON.parse(localStorage.getItem('handshake-preferences-v1'));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      if (['ru', 'en'].indexOf(saved.language) !== -1) preferences.language = saved.language;
      if (['light', 'dark', 'auto'].indexOf(saved.theme) !== -1) preferences.theme = saved.theme;
    }
  } catch (_) {}
  var systemDark = false;
  try { systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) {}
  var theme = preferences.theme === 'dark' || (preferences.theme === 'auto' && systemDark) ? 'dark' : 'light';
  var root = document.documentElement;
  root.lang = preferences.language;
  root.dataset.theme = theme;
  root.dataset.themePreference = preferences.theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#17191f' : '#f7f8fa');
})();
