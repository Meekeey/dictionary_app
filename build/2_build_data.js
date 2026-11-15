// 2_build_data.js
// Step 2 of the build: make the one data file the app loads.
//
// Run:  node build/2_build_data.js      (after 1_wordlist.py)
// Output: app/data/dictionary.json.gz
//
// Shape of the data file:
// {
//   "words": {
//     "efficient": {
//       "p": "ih-FISH-uhnt",                       pronunciation
//       "m": [["a", "being effective without..."]], meanings: [part of speech, text]
//       "s": ["effective", "competent"],            similar words
//       "e": ["An efficient engine."]               WordNet examples (0 to 4)
//     }, ...                                        (most common words first)
//   },
//   "forms": { "running": "run", ... },             word forms that open another word
//   "also":  { "building": "build", ... },          words with their own page that are also a form
//   "wotd":  ["efficient", ...]                     word-of-the-day list
// }

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { arpabetToEasy } = require("./arpabet.js");
const { IRREGULAR_FORMS, getBaseCandidates } = require("../app/js/wordforms.js");
const WOTD_WORDS = require("./wotd_words.js");

const WORDNET_DIR = path.join(__dirname, "..", "node_modules", "wordnet-db", "dict");
const OUT_FILE = path.join(__dirname, "..", "app", "data", "dictionary.json.gz");

// WordNet file names and the letter we use for each part of speech.
const PARTS = [
  { file: "noun", letter: "n" },
  { file: "verb", letter: "v" },
  { file: "adj", letter: "a" },
  { file: "adv", letter: "r" }
];

const MAX_SENSES_PER_PART = 2;
const MAX_SIMILAR = 5;
const MAX_EXAMPLES = 4;

// Some word forms are also words of their own ("building", "tired").
// WordNet counts how often each one is used in its texts. A form with a
// count below the limit opens its base word instead ("running" -> "run").
const OWN_PAGE_LIMIT_ING = 8;    // for -ing forms
const OWN_PAGE_LIMIT_ED = 2;     // for -ed forms
const OWN_PAGE_LIMIT_OTHER = 5;  // for plurals and irregular forms

// Words that always keep their own page.
const KEEP_OWN_PAGE = ["pants", "glasses", "jeans", "news", "means", "clothes", "scissors", "thanks", "goods", "wedding"];

// Words that look like a form of another word but are not.
const NOT_A_FORM = ["evening", "wedding", "news", "physics", "shilling", "pants", "glasses"];

// ---------------------------------------------------------------------------
// Reading WordNet
// ---------------------------------------------------------------------------

// Reads a data file (data.noun ...) into a Map: synset offset -> synset.
function readDataFile(fileName) {
  const synsets = new Map();
  const lines = fs.readFileSync(path.join(WORDNET_DIR, "data." + fileName), "utf8").split("\n");

  for (const line of lines) {
    // Skip the license text (starts with spaces) and empty lines.
    if (line === "" || line.startsWith("  ")) {
      continue;
    }

    // A line looks like:  offset lexfile type wordCount word id word id ... pointerCount pointers | gloss
    const barPosition = line.indexOf(" | ");
    const fields = line.slice(0, barPosition).split(" ");
    const gloss = line.slice(barPosition + 3).trim();

    const offset = fields[0];
    const wordCount = parseInt(fields[3], 16); // written in hexadecimal

    // Read the words of the synset.
    const words = [];
    let position = 4;
    for (let i = 0; i < wordCount; i++) {
      // Adjectives can have a marker like "(p)" at the end. Remove it.
      const word = fields[position].replace(/\(.*\)$/, "");
      words.push(word);
      position = position + 2;
    }

    // Read the pointers (links to other synsets).
    const pointerCount = parseInt(fields[position], 10);
    position = position + 1;
    const pointers = [];
    for (let i = 0; i < pointerCount; i++) {
      pointers.push({
        symbol: fields[position],
        offset: fields[position + 1],
        part: fields[position + 2]
      });
      position = position + 4;
    }

    synsets.set(offset, { words: words, pointers: pointers, gloss: gloss });
  }
  return synsets;
}

// Reads an index file (index.noun ...) into a Map: word -> list of synset offsets.
// The offsets are ordered from the most common sense to the least common.
function readIndexFile(fileName) {
  const index = new Map();
  const lines = fs.readFileSync(path.join(WORDNET_DIR, "index." + fileName), "utf8").split("\n");

  for (const line of lines) {
    if (line === "" || line.startsWith("  ")) {
      continue;
    }
    const fields = line.trim().split(" ");
    const word = fields[0];
    const synsetCount = parseInt(fields[2], 10);
    // The synset offsets are the last fields of the line.
    const offsets = fields.slice(fields.length - synsetCount);
    index.set(word, offsets);
  }
  return index;
}

// Reads index.sense to count how often each word is used in WordNet's
// tagged texts. Returns a Map: word -> total count.
function readUseCounts() {
  const counts = new Map();
  const lines = fs.readFileSync(path.join(WORDNET_DIR, "index.sense"), "utf8").split("\n");
  for (const line of lines) {
    if (line === "") {
      continue;
    }
    // A line looks like:  building%1:06:00:: 02916498 1 48
    const fields = line.split(" ");
    const word = fields[0].split("%")[0];
    const count = parseInt(fields[3], 10);
    const before = counts.get(word) || 0;
    counts.set(word, before + count);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Splits a gloss into the meaning and the example sentences.
// 'being effective; "an efficient engine"' -> meaning + ["an efficient engine"]
function splitGloss(gloss) {
  const examples = [];
  const matches = gloss.match(/"[^"]+"/g);
  if (matches) {
    for (const match of matches) {
      examples.push(match.slice(1, -1));
    }
  }

  let meaning = gloss;
  const firstQuote = gloss.indexOf('"');
  if (firstQuote !== -1) {
    meaning = gloss.slice(0, firstQuote);
  }
  // Keep only the first part ("flee; take to one's heels" -> "flee").
  const firstSemicolon = meaning.indexOf(";");
  if (firstSemicolon !== -1) {
    meaning = meaning.slice(0, firstSemicolon);
  }
  meaning = meaning.trim().replace(/[:,]+$/, "").trim();

  return { meaning: meaning, examples: examples };
}

// Makes an example look like a sentence: capital first letter, final period.
function tidyExample(text) {
  let result = text.trim();
  result = result[0].toUpperCase() + result.slice(1);
  const lastChar = result[result.length - 1];
  if (lastChar !== "." && lastChar !== "!" && lastChar !== "?") {
    result = result + ".";
  }
  return result;
}

// Adds an item to a list if it is not there yet.
function addUnique(list, item) {
  if (!list.includes(item)) {
    list.push(item);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // The CMU package is an ES module, so we load it with import().
  const cmu = await import("cmu-pronouncing-dictionary");

  const wordlist = JSON.parse(fs.readFileSync(path.join(__dirname, "wordlist.json"), "utf8"));
  const useCounts = readUseCounts();

  console.log("Reading WordNet...");
  const data = {};
  const index = {};
  for (const part of PARTS) {
    data[part.letter] = readDataFile(part.file);
    index[part.letter] = readIndexFile(part.file);
  }
  // In pointers, "s" (adjective satellite) lives in the adjective file.
  data["s"] = data["a"];

  // Returns the real senses of a word for one part of speech.
  // Senses where the word is a name (London, Smith) are skipped.
  function getSenses(word, partLetter) {
    const senses = [];
    const offsets = index[partLetter].get(word) || [];
    for (const offset of offsets) {
      const synset = data[partLetter].get(offset);

      // Is the word written with a capital letter in this synset? Then it is a name.
      let isName = false;
      for (const synsetWord of synset.words) {
        if (synsetWord.toLowerCase() === word && synsetWord !== word) {
          isName = true;
        }
      }
      if (!isName) {
        senses.push(synset);
      }
    }
    return senses;
  }

  // ----- Pass 1: find which words get an entry -----
  console.log("Choosing words...");
  const sensesOfWord = {}; // word -> { n: [...], v: [...], a: [...], r: [...] }
  let missingPronunciation = 0;

  for (const word of Object.keys(wordlist)) {
    // Every word must have a pronunciation.
    if (!cmu.dictionary[word]) {
      missingPronunciation = missingPronunciation + 1;
      continue;
    }

    const senses = {};
    let total = 0;
    for (const part of PARTS) {
      senses[part.letter] = getSenses(word, part.letter);
      total = total + senses[part.letter].length;
    }
    if (total > 0) {
      sensesOfWord[word] = senses;
    }
  }

  // Can this word be opened in the app?
  function isEntry(word) {
    return sensesOfWord[word] !== undefined;
  }

  // ----- Pass 2: build each entry -----
  console.log("Building entries...");

  // Most common words first. The app uses this order for search suggestions.
  const sortedWords = Object.keys(sensesOfWord).sort(function (a, b) {
    return wordlist[b] - wordlist[a];
  });

  const words = {};
  for (const word of sortedWords) {
    const senses = sensesOfWord[word];

    const meanings = [];
    const examples = [];
    const similar = [];
    const shownSynsets = [];  // the senses we show
    const otherSynsets = [];  // the senses we do not show

    // Adds a group of words to the similar list, most common words first.
    // Only words that have their own entry are added.
    function addSimilarWords(groupWords) {
      const group = [];
      for (const groupWord of groupWords) {
        const candidate = groupWord.toLowerCase();
        if (candidate !== word && isEntry(candidate)) {
          addUnique(group, candidate);
        }
      }
      group.sort(function (a, b) {
        return wordlist[b] - wordlist[a];
      });
      for (const candidate of group) {
        if (similar.length < MAX_SIMILAR) {
          addUnique(similar, candidate);
        }
      }
    }

    // Collects all the words of a list of synsets.
    function wordsOf(synsets) {
      let result = [];
      for (const synset of synsets) {
        result = result.concat(synset.words);
      }
      return result;
    }

    // Follows one kind of link ("&", "@" ...) and returns the linked synsets.
    function linkedSynsets(synsets, symbol) {
      const result = [];
      for (const synset of synsets) {
        for (const pointer of synset.pointers) {
          if (pointer.symbol === symbol) {
            result.push(data[pointer.part].get(pointer.offset));
          }
        }
      }
      return result;
    }

    // Meanings and examples: the first 1 to 2 senses of each part of speech.
    for (const part of PARTS) {
      const list = senses[part.letter];
      for (let i = 0; i < list.length; i++) {
        const synset = list[i];
        if (i >= MAX_SENSES_PER_PART) {
          otherSynsets.push(synset);
          continue;
        }
        shownSynsets.push(synset);

        const gloss = splitGloss(synset.gloss);
        meanings.push([part.letter, gloss.meaning]);

        // Keep only examples that really use this word.
        const stem = word.slice(0, Math.max(3, word.length - 2));
        for (const example of gloss.examples) {
          const usesWord = example.toLowerCase().includes(stem);
          if (usesWord && example.length >= 12 && examples.length < MAX_EXAMPLES) {
            addUnique(examples, tidyExample(example));
          }
        }
      }
    }

    // Similar words, best groups first:
    // 1. words in the same synsets as the shown senses
    addSimilarWords(wordsOf(shownSynsets));
    // 2. words in the same synsets as the other senses
    addSimilarWords(wordsOf(otherSynsets));
    // 3. "similar to" links (adjectives)
    addSimilarWords(wordsOf(linkedSynsets(shownSynsets, "&")));
    addSimilarWords(wordsOf(linkedSynsets(otherSynsets, "&")));
    // If we still have fewer than 4, use related words:
    const moreGeneral = linkedSynsets(shownSynsets, "@");
    if (similar.length < 4) {
      addSimilarWords(wordsOf(linkedSynsets(shownSynsets, "^")));  // "see also" links
      addSimilarWords(wordsOf(linkedSynsets(shownSynsets, "$")));  // verb groups
    }
    if (similar.length < 4) {
      addSimilarWords(wordsOf(moreGeneral));                       // more general words
    }
    if (similar.length < 4) {
      addSimilarWords(wordsOf(linkedSynsets(shownSynsets, "~")));  // more specific words
    }
    if (similar.length < 4) {
      // words with the same general word ("deadline" and "curfew" are both times)
      const before = similar.length;
      addSimilarWords(wordsOf(linkedSynsets(moreGeneral, "~")));
      // use only as many as needed to reach 4
      similar.length = Math.min(similar.length, Math.max(before, 4));
    }

    words[word] = {
      p: arpabetToEasy(cmu.dictionary[word]),
      m: meanings,
      s: similar,
      e: examples
    };
  }

  // ----- Word forms -----
  // Decide which forms open another word ("running" -> "run", "went" -> "go").
  console.log("Finding word forms...");
  const forms = {};

  // Does this base word have the right part of speech?
  function baseHasType(base, type) {
    if (!isEntry(base)) {
      return false;
    }
    const senses = sensesOfWord[base];
    if (type === "verb") {
      return senses.v.length > 0;
    }
    if (type === "adjective") {
      return senses.a.length > 0;
    }
    return senses.n.length > 0 || senses.v.length > 0;
  }

  // Finds the base word of a form, or null if there is none.
  // Returns { base: "run", limit: 8 }.
  function findBase(word) {
    if (NOT_A_FORM.includes(word)) {
      return null;
    }
    const irregular = IRREGULAR_FORMS[word];
    if (irregular && isEntry(irregular)) {
      return { base: irregular, limit: OWN_PAGE_LIMIT_OTHER };
    }
    const candidates = getBaseCandidates(word);
    for (const candidate of candidates) {
      // "taller", "tallest": too many false matches ("number" is not "numb"),
      // so these are only used for words without their own page.
      if (candidate.type === "adjective" && isEntry(word)) {
        continue;
      }
      if (baseHasType(candidate.base, candidate.type)) {
        let limit = OWN_PAGE_LIMIT_OTHER;
        if (word.endsWith("ing")) {
          limit = OWN_PAGE_LIMIT_ING;
        }
        if (word.endsWith("ed")) {
          limit = OWN_PAGE_LIMIT_ED;
        }
        return { base: candidate.base, limit: limit };
      }
    }
    return null;
  }

  const also = {};
  const wordsToCheck = sortedWords.concat(Object.keys(IRREGULAR_FORMS));
  for (const word of wordsToCheck) {
    const found = findBase(word);
    if (found === null) {
      continue;
    }

    // Does the word have a page of its own that is used often enough?
    let keepsOwnPage = false;
    if (isEntry(word)) {
      const count = useCounts.get(word) || 0;
      if (count >= found.limit || KEEP_OWN_PAGE.includes(word)) {
        keepsOwnPage = true;
      }
    }

    if (keepsOwnPage) {
      also[word] = found.base;    // "building": own page, with a link to "build"
    } else {
      forms[word] = found.base;   // "running": opens "run"
    }
  }

  // ----- Word of the day list -----
  const wotd = [];
  for (const word of WOTD_WORDS) {
    if (isEntry(word)) {
      wotd.push(word);
    } else {
      console.log("  Word of the day not in dictionary, skipped:", word);
    }
  }

  // ----- Write the file -----
  const json = JSON.stringify({ words: words, forms: forms, also: also, wotd: wotd });
  const gzipped = zlib.gzipSync(json, { level: 9 });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, gzipped);

  console.log("Words in dictionary:", sortedWords.length);
  console.log("Skipped (no pronunciation):", missingPronunciation);
  console.log("Word forms:", Object.keys(forms).length);
  console.log("JSON size:   ", (json.length / 1024 / 1024).toFixed(2), "MB");
  console.log("Gzipped size:", (gzipped.length / 1024 / 1024).toFixed(2), "MB");
}

main();
