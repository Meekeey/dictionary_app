// app.js
// Starts the app and chooses which screen to show.
// The address after "#" tells the screen:
//   #/                  Home
//   #/word/efficient    Word page
//   #/favorites         Favorites
//   #/settings          Settings

// Sets light or dark colors from the saved setting.
function applyTheme() {
  const theme = getTheme();
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    // "auto": follow the device (see style.css).
    document.documentElement.removeAttribute("data-theme");
  }
}

// Marks the tab of the current screen.
function setActiveTab(tabId) {
  const tabIds = ["tab-home", "tab-favorites", "tab-settings"];
  for (const id of tabIds) {
    const tab = document.getElementById(id);
    if (id === tabId) {
      tab.classList.add("active");
      tab.setAttribute("aria-current", "page");
    } else {
      tab.classList.remove("active");
      tab.removeAttribute("aria-current");
    }
  }
}

// Reads the address and shows the right screen.
function showCurrentScreen() {
  // "#/word/efficient" -> ["word", "efficient"]
  const path = location.hash.replace(/^#\/?/, "");
  const parts = path.split("/");
  const screenName = parts[0];

  if (screenName === "word" && parts.length >= 2) {
    const typed = cleanWord(decodeURIComponent(parts[1]));
    const exact = parts[2] === "exact";
    setActiveTab("");
    if (typed === "") {
      showHomeScreen();
    } else {
      showWordScreen(typed, exact);
    }
  } else if (screenName === "favorites") {
    setActiveTab("tab-favorites");
    showFavoritesScreen();
  } else if (screenName === "settings") {
    setActiveTab("tab-settings");
    showSettingsScreen();
  } else {
    setActiveTab("tab-home");
    showHomeScreen();
  }
}

// Draws the pixel icons in the top bar and the tabs.
function drawStaticIcons() {
  document.getElementById("logo-icon").innerHTML = pixelIcon("anvil", 22);
  const iconHolders = document.querySelectorAll("[data-icon]");
  for (const holder of iconHolders) {
    holder.innerHTML = pixelIcon(holder.dataset.icon, 18);
  }
}

// Registers the service worker, so the app works offline.
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.warn("Service worker failed:", error);
    });
  }
}

// Start.
async function startApp() {
  applyTheme();
  drawStaticIcons();
  registerServiceWorker();

  try {
    await loadDictionary();
  } catch (error) {
    document.getElementById("screen").innerHTML =
      '<p class="loading">Could not load the dictionary. Check your connection and reload.</p>';
    return;
  }

  // Show a screen now, and again each time the address changes.
  showCurrentScreen();
  window.addEventListener("hashchange", showCurrentScreen);
}

startApp();
