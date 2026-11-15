// storage.js
// Saves favorites, recent searches, cached examples and settings
// in the browser (localStorage). Everything stays on this device.

const KEY_FAVORITES = "wordsmith.favorites";       // list of words
const KEY_RECENTS = "wordsmith.recents";           // list of words, newest first
const KEY_EXAMPLES = "wordsmith.examples";         // { word: [4 sentences] }
const KEY_CLAUDE_WORDS = "wordsmith.claudeWords";  // { word: entry made by Claude }
const KEY_API_KEY = "wordsmith.apiKey";
const KEY_THEME = "wordsmith.theme";               // "auto", "light" or "dark"

const MAX_RECENTS = 20;

// ----- basic read and write -----

// Reads a JSON value. Returns "fallback" if nothing is saved.
function readStorage(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) {
      return fallback;
    }
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

// Saves a JSON value.
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage can be full or blocked. The app still works without it.
    console.warn("Could not save " + key, error);
  }
}

// ----- favorites -----

function getFavorites() {
  return readStorage(KEY_FAVORITES, []);
}

function isFavorite(word) {
  return getFavorites().includes(word);
}

function addFavorite(word) {
  const favorites = getFavorites();
  if (!favorites.includes(word)) {
    favorites.unshift(word); // newest first
    writeStorage(KEY_FAVORITES, favorites);
  }
}

function removeFavorite(word) {
  const favorites = getFavorites();
  const position = favorites.indexOf(word);
  if (position !== -1) {
    favorites.splice(position, 1);
    writeStorage(KEY_FAVORITES, favorites);
  }
}

// ----- recent searches -----

function getRecents() {
  return readStorage(KEY_RECENTS, []);
}

function addRecent(word) {
  const recents = getRecents();

  // If the word is already in the list, remove the old copy.
  const position = recents.indexOf(word);
  if (position !== -1) {
    recents.splice(position, 1);
  }

  recents.unshift(word); // newest first

  // Keep only the last 20.
  while (recents.length > MAX_RECENTS) {
    recents.pop();
  }
  writeStorage(KEY_RECENTS, recents);
}

function clearRecents() {
  writeStorage(KEY_RECENTS, []);
}

// ----- cached examples (from Claude) -----

// Returns the 4 saved sentences for a word, or null.
function getCachedExamples(word) {
  const all = readStorage(KEY_EXAMPLES, {});
  if (all[word]) {
    return all[word];
  }
  return null;
}

function saveCachedExamples(word, sentences) {
  const all = readStorage(KEY_EXAMPLES, {});
  all[word] = sentences;
  writeStorage(KEY_EXAMPLES, all);
}

// ----- cached full entries (words that Claude explained) -----

function getClaudeWord(word) {
  const all = readStorage(KEY_CLAUDE_WORDS, {});
  if (all[word]) {
    return all[word];
  }
  return null;
}

function saveClaudeWord(word, entry) {
  const all = readStorage(KEY_CLAUDE_WORDS, {});
  all[word] = entry;
  writeStorage(KEY_CLAUDE_WORDS, all);
}

// How many words have saved Claude content?
function countCachedWords() {
  const examples = readStorage(KEY_EXAMPLES, {});
  const claudeWords = readStorage(KEY_CLAUDE_WORDS, {});
  return Object.keys(examples).length + Object.keys(claudeWords).length;
}

function clearClaudeCache() {
  writeStorage(KEY_EXAMPLES, {});
  writeStorage(KEY_CLAUDE_WORDS, {});
}

// ----- settings -----

function getApiKey() {
  return readStorage(KEY_API_KEY, "");
}

function saveApiKey(apiKey) {
  writeStorage(KEY_API_KEY, apiKey);
}

function getTheme() {
  return readStorage(KEY_THEME, "auto");
}

function saveTheme(theme) {
  writeStorage(KEY_THEME, theme);
}
