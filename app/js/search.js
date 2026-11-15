// search.js
// Search helpers: autocomplete, "Did you mean", and finding the right word.

// Cleans what the user typed: lower case, only letters.
function cleanWord(text) {
  return text.trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

// Autocomplete: words that start with the typed letters.
// WORD_LIST is sorted by how common a word is, so common words come first.
function getSuggestions(prefix, max) {
  const results = [];
  if (prefix === "") {
    return results;
  }
  for (const word of WORD_LIST) {
    if (word.startsWith(prefix)) {
      results.push(word);
      if (results.length >= max) {
        break;
      }
    }
  }
  return results;
}

// Edit distance: how many small changes turn word "a" into word "b".
// A small change is: add a letter, remove a letter, change a letter,
// or swap two letters that are next to each other ("recieve" -> "receive").
function editDistance(a, b) {
  // table[i][j] = distance between the first i letters of a
  // and the first j letters of b.
  const table = [];
  for (let i = 0; i <= a.length; i++) {
    const row = [];
    for (let j = 0; j <= b.length; j++) {
      row.push(0);
    }
    table.push(row);
  }

  // Turning a word into an empty word: remove every letter.
  for (let i = 0; i <= a.length; i++) {
    table[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    table[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      let changeCost = 1;
      if (a[i - 1] === b[j - 1]) {
        changeCost = 0;
      }
      const remove = table[i - 1][j] + 1;
      const add = table[i][j - 1] + 1;
      const change = table[i - 1][j - 1] + changeCost;
      let best = Math.min(remove, add, change);

      // Two letters swapped: "ie" <-> "ei"
      const canSwap = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (canSwap) {
        const swap = table[i - 2][j - 2] + 1;
        if (swap < best) {
          best = swap;
        }
      }
      table[i][j] = best;
    }
  }
  return table[a.length][b.length];
}

// "Did you mean ...?": the closest words to a misspelled word.
function getDidYouMean(typed, max) {
  // Short words may differ by 1 letter, longer words by 2.
  let maxDistance = 2;
  if (typed.length <= 4) {
    maxDistance = 1;
  }

  const matches = [];
  for (let i = 0; i < WORD_LIST.length; i++) {
    const word = WORD_LIST[i];
    // Skip words with a very different length (faster).
    if (Math.abs(word.length - typed.length) > maxDistance) {
      continue;
    }
    const distance = editDistance(typed, word);
    if (distance <= maxDistance) {
      matches.push({ word: word, distance: distance, rank: i });
    }
  }

  // Closest first. If two are equally close, the more common word first.
  matches.sort(function (a, b) {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.rank - b.rank;
  });

  const results = [];
  for (const match of matches) {
    if (results.length < max) {
      results.push(match.word);
    }
  }
  return results;
}

// Decides which dictionary word to open for what the user typed.
// "running" -> { word: "run", formOf: "running" }
// Returns { word: "" } if nothing was found.
// If "exact" is true, word forms are not used ("running" opens "running").
function resolveWord(typed, exact) {
  // 1. A form that opens its base word.
  if (!exact && DICT.forms[typed]) {
    return { word: DICT.forms[typed], typed: typed };
  }

  // 2. The word itself.
  if (isKnownWord(typed)) {
    return { word: typed, typed: typed };
  }

  // 3. Try the spelling rules (studies -> study).
  const base = findBaseForm(typed, isKnownWord);
  if (base !== "") {
    return { word: base, typed: typed };
  }

  return { word: "", typed: typed };
}
