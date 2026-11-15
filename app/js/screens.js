// screens.js
// Draws each screen: Home, Word, Favorites, Settings.
// Each function builds some HTML and puts it inside <main id="screen">.

const screenElement = document.getElementById("screen");

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Makes text safe to put inside HTML.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The link that opens a word page.
function wordLink(word) {
  return "#/word/" + encodeURIComponent(word);
}

// Pronunciation as HTML: the stressed syllable (in CAPS) gets the accent color.
// "ih-FISH-uhnt" -> ih-<span class="stress">FISH</span>-uhnt
function pronunciationHtml(pronunciation) {
  const syllables = pronunciation.split("-");
  const parts = [];
  for (const syllable of syllables) {
    const isCaps = syllable === syllable.toUpperCase() && syllable !== syllable.toLowerCase();
    if (isCaps) {
      parts.push('<span class="stress">' + escapeHtml(syllable) + "</span>");
    } else {
      parts.push(escapeHtml(syllable));
    }
  }
  return parts.join("-");
}

// A list of tappable word chips.
function chipListHtml(words) {
  let html = '<div class="chip-list">';
  for (const word of words) {
    html = html + '<a class="chip" href="' + wordLink(word) + '">' + escapeHtml(word) + "</a>";
  }
  html = html + "</div>";
  return html;
}

// ---------------------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------------------

function showHomeScreen() {
  const recents = getRecents();
  const favorites = getFavorites();
  const wordOfDay = getEntry(getWordOfTheDay());

  let html = '<div class="columns">';

  // ----- left column: search + word of the day -----
  html = html + "<div>";
  html = html + '<h2 class="section-title">Look up a word</h2>';
  html = html +
    '<form class="search-form" id="search-form" autocomplete="off">' +
    '<input class="text-input" id="search-input" type="search" placeholder="Type a word" ' +
    'aria-label="Word to look up" autocapitalize="none" autocorrect="off" spellcheck="false">' +
    '<button class="btn btn-green" type="submit">Look up</button>' +
    "</form>" +
    '<div class="suggestions" id="suggestions"></div>';

  html = html +
    '<div class="stats">' +
    '<span class="stat">' + pixelIcon("gem", 14) + WORD_LIST.length.toLocaleString("en-US") + " words</span>" +
    '<span class="stat stat-star">' + pixelIcon("star", 14) + favorites.length + " saved</span>" +
    "</div>";

  if (wordOfDay !== null) {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    html = html + '<h2 class="section-title">Today</h2>';
    html = html +
      '<a class="card" href="' + wordLink(wordOfDay.word) + '">' +
      '<div class="card-head"><span>Word of the day</span><span>' + escapeHtml(today) + "</span></div>" +
      '<div class="card-body">' +
      '<div class="card-word">' + escapeHtml(wordOfDay.word) + "</div>" +
      '<div class="pron pron-small">' + pronunciationHtml(wordOfDay.pronunciation) + "</div>" +
      '<p class="card-meaning">' + escapeHtml(wordOfDay.meanings[0].text) + "</p>" +
      '<div class="card-open">Open word &gt;</div>' +
      "</div></a>";
  }
  html = html + "</div>";

  // ----- right column: recent searches -----
  html = html + "<div>";
  html = html + '<h2 class="section-title">Recent searches</h2>';
  if (recents.length === 0) {
    html = html + '<p class="empty slot">Words you look up will appear here.</p>';
  } else {
    html = html + chipListHtml(recents);
    html = html + '<p class="note"><button class="link-btn" id="clear-recents" type="button">Clear recent searches</button></p>';
  }
  html = html + "</div>";

  html = html + "</div>";
  screenElement.innerHTML = html;

  // ----- make the search work -----
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const suggestionBox = document.getElementById("suggestions");

  // While typing: show words that start with the typed letters.
  input.addEventListener("input", function () {
    const typed = cleanWord(input.value);
    const suggestions = getSuggestions(typed, 6);
    let listHtml = "";
    for (const word of suggestions) {
      listHtml = listHtml +
        '<a class="suggestion" href="' + wordLink(word) + '">' +
        pixelIcon("search", 14) + escapeHtml(word) + "</a>";
    }
    suggestionBox.innerHTML = listHtml;
  });

  // Pressing Enter or the button: open the typed word.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const typed = cleanWord(input.value);
    if (typed !== "") {
      location.hash = wordLink(typed);
    }
  });

  const clearButton = document.getElementById("clear-recents");
  if (clearButton) {
    clearButton.addEventListener("click", function () {
      clearRecents();
      showHomeScreen();
    });
  }
}

// ---------------------------------------------------------------------------
// Word screen
// ---------------------------------------------------------------------------

// Opens the page of a word. "typed" is what the user asked for.
// If "exact" is true, we do not jump to the base form.
async function showWordScreen(typed, exact) {
  const hashAtStart = location.hash;
  const resolved = resolveWord(typed, exact);

  let entry = null;
  let errorMessage = "";

  if (resolved.word !== "") {
    // The word is in the data file.
    entry = getEntry(resolved.word);
  } else {
    // Not in the data file. Did Claude explain it before?
    entry = getClaudeWord(typed);

    // If not, ask Claude now (needs an API key and internet).
    if (entry === null && getApiKey() !== "" && navigator.onLine) {
      screenElement.innerHTML = '<p class="loading">Asking Claude about "' + escapeHtml(typed) + '"...</p>';
      try {
        entry = await fetchFullEntry(typed);
        if (entry !== null) {
          saveClaudeWord(typed, entry);
        }
      } catch (error) {
        errorMessage = error.message;
      }
      // The user opened another screen while we waited: stop here.
      if (location.hash !== hashAtStart) {
        return;
      }
    }
  }

  if (entry === null) {
    showNotFound(typed, errorMessage);
    return;
  }

  addRecent(entry.word);
  drawWordPage(entry, typed);
  loadExamples(entry, hashAtStart);
}

// Draws the word page (everything except the examples).
function drawWordPage(entry, typed) {
  // Parts of speech, without repeats: ["noun", "verb"]
  const parts = [];
  for (const meaning of entry.meanings) {
    if (!parts.includes(meaning.part)) {
      parts.push(meaning.part);
    }
  }

  let html = "";

  // ----- top row: back and favorite buttons -----
  html = html +
    '<div class="word-top">' +
    '<button class="icon-btn" id="back-button" type="button" aria-label="Back">' + pixelIcon("back", 20) + "</button>" +
    '<button class="icon-btn" id="favorite-button" type="button">' + pixelIcon("star", 22) + "</button>" +
    "</div>";

  html = html + '<div class="columns">';

  // ----- word, part of speech, pronunciation -----
  html = html + '<div class="word-head">';
  html = html + '<h1 class="word-title">' + escapeHtml(entry.word) + "</h1>";
  html = html + '<div class="tag-row">';
  for (const part of parts) {
    html = html + '<span class="tag">' + escapeHtml(part) + "</span>";
  }
  html = html + "</div>";
  html = html +
    '<div class="pron-box slot">' +
    '<span class="pron-label">Say it</span>' +
    '<span class="pron">' + pronunciationHtml(entry.pronunciation) + "</span>" +
    "</div>";

  // Info line about word forms.
  if (typed !== entry.word) {
    // Example: the user typed "running" and we opened "run".
    let text = "<b>" + escapeHtml(typed) + "</b> is a form of <b>" + escapeHtml(entry.word) + "</b>.";
    if (isKnownWord(typed)) {
      text = text + ' <a class="text-link" href="' + wordLink(typed) + '/exact">Open the entry for ' +
        escapeHtml(typed) + "</a>";
    }
    html = html + '<p class="banner">' + text + "</p>";
  } else if (DICT.also[entry.word]) {
    // Example: "building" has its own page, but is also a form of "build".
    const base = DICT.also[entry.word];
    html = html + '<p class="banner">Also a form of <a class="text-link" href="' + wordLink(base) + '">' +
      escapeHtml(base) + "</a>.</p>";
  }
  html = html + "</div>";

  // ----- left column: meaning + similar words -----
  html = html + "<div>";
  html = html + '<h2 class="section-title">Meaning</h2>';
  html = html + '<ul class="meaning-list">';
  for (const meaning of entry.meanings) {
    html = html +
      '<li class="meaning">' +
      '<span class="tag">' + escapeHtml(meaning.part) + "</span>" +
      '<span class="meaning-text">' + escapeHtml(meaning.text) + "</span>" +
      "</li>";
  }
  html = html + "</ul>";

  html = html + '<h2 class="section-title">Similar words</h2>';
  if (entry.similar.length === 0) {
    html = html + '<p class="note">No similar words for this one.</p>';
  } else {
    html = html + chipListHtml(entry.similar);
  }
  html = html + "</div>";

  // ----- right column: examples (filled in by loadExamples) -----
  html = html + "<div>";
  html = html + '<h2 class="section-title">Examples</h2>';
  html = html + '<div id="examples"></div>';
  html = html + "</div>";

  html = html + "</div>";
  screenElement.innerHTML = html;
  window.scrollTo(0, 0);

  // ----- buttons -----
  document.getElementById("back-button").addEventListener("click", function () {
    if (history.length > 1) {
      history.back();
    } else {
      location.hash = "#/";
    }
  });

  const favoriteButton = document.getElementById("favorite-button");

  // Shows the star as on or off.
  function updateFavoriteButton() {
    if (isFavorite(entry.word)) {
      favoriteButton.classList.add("is-favorite");
      favoriteButton.setAttribute("aria-label", "Remove from favorites");
      favoriteButton.setAttribute("aria-pressed", "true");
    } else {
      favoriteButton.classList.remove("is-favorite");
      favoriteButton.setAttribute("aria-label", "Add to favorites");
      favoriteButton.setAttribute("aria-pressed", "false");
    }
  }

  favoriteButton.addEventListener("click", function () {
    if (isFavorite(entry.word)) {
      removeFavorite(entry.word);
    } else {
      addFavorite(entry.word);
    }
    updateFavoriteButton();
  });
  updateFavoriteButton();
}

// Draws the numbered examples and a small note under them.
function drawExamples(sentences, note) {
  const box = document.getElementById("examples");
  if (!box) {
    return;
  }

  let html = "";
  if (sentences.length > 0) {
    html = html + '<ol class="example-list">';
    for (let i = 0; i < sentences.length; i++) {
      html = html +
        '<li class="example">' +
        '<span class="example-number">' + (i + 1) + "</span>" +
        "<span>" + escapeHtml(sentences[i]) + "</span>" +
        "</li>";
    }
    html = html + "</ol>";
  }
  if (note !== "") {
    html = html + '<p class="note">' + note + "</p>";
  }
  box.innerHTML = html;
}

// Chooses where the examples come from, then draws them.
async function loadExamples(entry, hashAtStart) {
  const settingsLink = '<a href="#/settings">Settings</a>';

  // Shows the WordNet examples (0 to 4) with a reason.
  function showBuiltIn(reason) {
    let note = "Examples from WordNet. " + reason;
    if (entry.examples.length === 0) {
      note = "No built-in examples for this word. " + reason;
    }
    drawExamples(entry.examples, note);
  }

  // 1. The whole entry came from Claude: it already has 4 examples.
  if (entry.fromClaude) {
    drawExamples(entry.examples, "This word is not in the built-in dictionary. Entry written by Claude and saved on this device.");
    return;
  }

  // 2. Claude wrote examples for this word before: use the saved ones.
  const cached = getCachedExamples(entry.word);
  if (cached !== null) {
    drawExamples(cached, "Examples written by Claude and saved on this device.");
    return;
  }

  // 3. No API key: use WordNet.
  if (getApiKey() === "") {
    showBuiltIn("Add an API key in " + settingsLink + " to get 4 new examples for every word.");
    return;
  }

  // 4. No internet: use WordNet.
  if (!navigator.onLine) {
    showBuiltIn("You are offline, so Claude cannot write new examples right now.");
    return;
  }

  // 5. Ask Claude, then save the answer so we never ask again for this word.
  drawExamples([], "Writing 4 examples...");
  try {
    const sentences = await fetchExamples(entry);
    saveCachedExamples(entry.word, sentences);
    // Only draw if the user is still on this word page.
    if (location.hash === hashAtStart) {
      drawExamples(sentences, "Examples written by Claude and saved on this device.");
    }
  } catch (error) {
    if (location.hash === hashAtStart) {
      showBuiltIn("Claude could not answer (" + escapeHtml(error.message) + "). Check your key in " + settingsLink + ".");
    }
  }
}

// Shown when a word is not in the dictionary.
function showNotFound(typed, errorMessage) {
  const guesses = getDidYouMean(typed, 5);

  let html = "";
  html = html + '<div class="narrow">';
  html = html + '<h1 class="word-title">Word not found</h1>';
  html = html + '<p class="banner">There is no entry for <b>' + escapeHtml(typed) + "</b>.</p>";

  if (guesses.length > 0) {
    html = html + '<h2 class="section-title">Did you mean</h2>';
    html = html + chipListHtml(guesses);
  }

  if (errorMessage !== "") {
    html = html + '<p class="note">Claude could not answer (' + escapeHtml(errorMessage) + ").</p>";
  } else if (getApiKey() === "") {
    html = html + '<p class="note">Tip: add an API key in <a href="#/settings">Settings</a> and Claude will explain words that are not in the built-in dictionary.</p>';
  } else if (!navigator.onLine) {
    html = html + '<p class="note">You are offline. Claude can explain this word when you are online again.</p>';
  }

  html = html + '<div class="button-row"><a class="btn btn-green" href="#/">New search</a></div>';
  html = html + "</div>";
  screenElement.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Favorites screen
// ---------------------------------------------------------------------------

function showFavoritesScreen() {
  const favorites = getFavorites();

  let html = '<div class="narrow">';
  html = html + '<h2 class="section-title">Favorites</h2>';

  if (favorites.length === 0) {
    html = html + '<p class="empty slot">No favorites yet. Open a word and press the star to save it.</p>';
  } else {
    html = html + '<ul class="fav-list">';
    for (const word of favorites) {
      // Find a short meaning to show under the word.
      let entry = getEntry(word);
      if (entry === null) {
        entry = getClaudeWord(word);
      }
      let meaning = "";
      if (entry !== null) {
        meaning = entry.meanings[0].text;
      }

      html = html +
        '<li class="fav-row">' +
        '<a class="fav-link slot" href="' + wordLink(word) + '">' +
        '<div class="fav-word">' + escapeHtml(word) + "</div>" +
        '<div class="fav-meaning">' + escapeHtml(meaning) + "</div>" +
        "</a>" +
        '<button class="icon-btn remove-favorite" type="button" data-word="' + escapeHtml(word) + '" ' +
        'aria-label="Remove ' + escapeHtml(word) + ' from favorites">' + pixelIcon("close", 16) + "</button>" +
        "</li>";
    }
    html = html + "</ul>";
  }
  html = html + "</div>";
  screenElement.innerHTML = html;

  // Each X button removes its word, then we draw the list again.
  const removeButtons = document.querySelectorAll(".remove-favorite");
  for (const button of removeButtons) {
    button.addEventListener("click", function () {
      removeFavorite(button.dataset.word);
      showFavoritesScreen();
    });
  }
}

// ---------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------

function showSettingsScreen() {
  const apiKey = getApiKey();
  const theme = getTheme();

  let keyStatus = "No key saved. Examples come from WordNet.";
  if (apiKey !== "") {
    // Show only the last 4 characters of the key.
    keyStatus = "Key saved (ends with " + escapeHtml(apiKey.slice(-4)) + "). Claude writes the examples.";
  }

  let html = '<div class="narrow">';

  // ----- API key -----
  html = html + '<h2 class="section-title">Claude examples</h2>';
  html = html +
    '<form id="key-form">' +
    '<label class="field-label" for="key-input">Anthropic API key</label>' +
    '<input class="text-input" id="key-input" type="password" placeholder="sk-ant-..." autocomplete="off">' +
    '<div class="button-row">' +
    '<button class="btn btn-green" type="submit">Save key</button>' +
    '<button class="btn btn-plain" id="remove-key" type="button">Remove key</button>' +
    "</div>" +
    "</form>" +
    '<p class="status" id="key-status">' + keyStatus + "</p>" +
    '<p class="settings-text">With a key, Claude writes 4 example sentences the first time you open a word. ' +
    "They are saved, so each word is asked only once.</p>" +
    '<p class="settings-text">The key is stored only in this browser and is sent only to Anthropic.</p>';

  // ----- theme -----
  html = html + '<h2 class="section-title">Colors</h2>';
  html = html + '<div class="button-row">';
  const themes = ["auto", "light", "dark"];
  for (const name of themes) {
    let classes = "btn btn-plain theme-button";
    let pressed = "false";
    if (name === theme) {
      classes = classes + " selected";
      pressed = "true";
    }
    html = html + '<button class="' + classes + '" type="button" data-theme-name="' + name + '" aria-pressed="' + pressed + '">' + name + "</button>";
  }
  html = html + "</div>";
  html = html + '<p class="note">Auto follows the light or dark mode of your device.</p>';

  // ----- saved data -----
  html = html + '<h2 class="section-title">Saved data</h2>';
  html = html +
    '<p class="settings-text">' + countCachedWords() + " words have saved Claude examples on this device.</p>" +
    '<div class="button-row"><button class="btn btn-plain" id="clear-cache" type="button">Delete saved examples</button></div>';

  // ----- about -----
  html = html + '<h2 class="section-title">About</h2>';
  html = html +
    '<p class="settings-text">' + WORD_LIST.length.toLocaleString("en-US") + " common English words. " +
    "Meanings and similar words come from WordNet (Princeton University). " +
    "Pronunciation comes from the CMU Pronouncing Dictionary. Everything works offline, except new Claude examples.</p>";

  html = html + "</div>";
  screenElement.innerHTML = html;

  // ----- buttons -----
  document.getElementById("key-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const typedKey = document.getElementById("key-input").value.trim();
    if (typedKey !== "") {
      saveApiKey(typedKey);
      showSettingsScreen();
    }
  });

  document.getElementById("remove-key").addEventListener("click", function () {
    saveApiKey("");
    showSettingsScreen();
  });

  const themeButtons = document.querySelectorAll(".theme-button");
  for (const button of themeButtons) {
    button.addEventListener("click", function () {
      saveTheme(button.dataset.themeName);
      applyTheme();
      showSettingsScreen();
    });
  }

  document.getElementById("clear-cache").addEventListener("click", function () {
    clearClaudeCache();
    showSettingsScreen();
  });
}
