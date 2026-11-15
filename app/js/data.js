// data.js
// Loads the dictionary data file (made by the build script).

const DATA_URL = "data/dictionary.json.gz";

// The loaded data. Filled by loadDictionary().
let DICT = { words: {}, forms: {}, also: {}, wotd: [] };

// All the words, most common first. Used for search suggestions.
let WORD_LIST = [];

// Full names of the parts of speech.
const PART_NAMES = { n: "noun", v: "verb", a: "adjective", r: "adverb" };

// Downloads the data file and unpacks it.
async function loadDictionary() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error("Could not load the dictionary file.");
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let text = "";
  // A gzip file starts with the bytes 1f 8b.
  // (Some servers unpack the file for us. Then it is already plain JSON.)
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (isGzip) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }

  DICT = JSON.parse(text);
  WORD_LIST = Object.keys(DICT.words);
}

// Is this word in the dictionary?
function isKnownWord(word) {
  return Object.prototype.hasOwnProperty.call(DICT.words, word);
}

// Returns the entry of a word in an easy shape, or null.
// { word, pronunciation, meanings: [{ part, text }], similar: [], examples: [] }
function getEntry(word) {
  if (!isKnownWord(word)) {
    return null;
  }
  const raw = DICT.words[word];

  const meanings = [];
  for (const item of raw.m) {
    meanings.push({ part: PART_NAMES[item[0]], text: item[1] });
  }

  return {
    word: word,
    pronunciation: raw.p,
    meanings: meanings,
    similar: raw.s,
    examples: raw.e,
    fromClaude: false
  };
}

// Picks the word of the day. The same date always gives the same word.
function getWordOfTheDay() {
  const now = new Date();
  // Number of days since 1 January 1970, in local time.
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.round(localMidnight.getTime() / 86400000);
  const position = dayNumber % DICT.wotd.length;
  return DICT.wotd[position];
}
