// wordforms.js
// Finds the base form of a word: "running" -> "run", "studies" -> "study".
// This file is used by the app (browser) and by the build script (Node).

// Irregular forms that do not follow a spelling rule.
const IRREGULAR_FORMS = {
  // be, have, do
  am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
  has: "have", had: "have", having: "have",
  does: "do", did: "do", done: "do", goes: "go", went: "go", gone: "go",
  // verbs
  ate: "eat", eaten: "eat", became: "become", began: "begin", begun: "begin",
  bent: "bend", bit: "bite", bitten: "bite", blew: "blow", blown: "blow",
  broke: "break", broken: "break", brought: "bring", built: "build",
  bought: "buy", caught: "catch", chose: "choose", chosen: "choose",
  came: "come", dealt: "deal", dug: "dig", drew: "draw", drawn: "draw",
  drank: "drink", drunk: "drink", drove: "drive", driven: "drive",
  fell: "fall", fallen: "fall", fed: "feed", felt: "feel", fought: "fight",
  found: "find", flew: "fly", flown: "fly", forgot: "forget", forgotten: "forget",
  forgave: "forgive", forgiven: "forgive", froze: "freeze", frozen: "freeze",
  got: "get", gotten: "get", gave: "give", given: "give", grew: "grow", grown: "grow",
  hung: "hang", heard: "hear", hid: "hide", hidden: "hide", held: "hold",
  kept: "keep", knew: "know", known: "know", laid: "lay", led: "lead",
  left: "leave", lent: "lend", lay: "lie", lain: "lie", lit: "light", lost: "lose",
  made: "make", meant: "mean", met: "meet", paid: "pay", rode: "ride", ridden: "ride",
  rang: "ring", rung: "ring", rose: "rise", risen: "rise", ran: "run",
  said: "say", saw: "see", seen: "see", sold: "sell", sent: "send",
  shook: "shake", shaken: "shake", shone: "shine", shot: "shoot",
  showed: "show", shown: "show", sang: "sing", sung: "sing", sank: "sink", sunk: "sink",
  sat: "sit", slept: "sleep", slid: "slide", spoke: "speak", spoken: "speak",
  spent: "spend", stood: "stand", stole: "steal", stolen: "steal",
  stuck: "stick", struck: "strike", swore: "swear", sworn: "swear",
  swept: "sweep", swam: "swim", swum: "swim", took: "take", taken: "take",
  taught: "teach", tore: "tear", torn: "tear", told: "tell", thought: "think",
  threw: "throw", thrown: "throw", understood: "understand",
  woke: "wake", woken: "wake", wore: "wear", worn: "wear", won: "win",
  wrote: "write", written: "write",
  // plural nouns
  children: "child", men: "man", women: "woman", people: "person", feet: "foot",
  teeth: "tooth", mice: "mouse", geese: "goose", lives: "life", knives: "knife",
  wives: "wife", leaves: "leaf", shelves: "shelf", halves: "half", wolves: "wolf",
  thieves: "thief", selves: "self", criteria: "criterion", phenomena: "phenomenon",
  analyses: "analysis", crises: "crisis", theses: "thesis",
  // adjectives
  better: "good", best: "good", worse: "bad", worst: "bad",
  further: "far", farther: "far"
};

const VOWEL_LETTERS = "aeiou";

// Returns a list of possible base forms for a word, using spelling rules.
// Each item is { base: "run", type: "verb" }.
// "type" tells which kind of word the base should be (noun/verb/adjective).
function getBaseCandidates(word) {
  const candidates = [];

  // Helper to add one candidate (base must have at least 2 letters).
  function add(base, type) {
    if (base.length >= 2) {
      candidates.push({ base: base, type: type });
    }
  }

  // --- plural nouns and verbs with -s ---
  if (word.endsWith("ies") && word.length > 4) {
    add(word.slice(0, -3) + "y", "noun-or-verb");       // studies -> study
  }
  if (word.endsWith("es") && word.length > 3) {
    add(word.slice(0, -2), "noun-or-verb");             // watches -> watch
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && word.length > 3) {
    add(word.slice(0, -1), "noun-or-verb");             // cats -> cat
  }

  // --- past tense -ed ---
  if (word.endsWith("ied") && word.length > 4) {
    add(word.slice(0, -3) + "y", "verb");               // tried -> try
  }
  if (word.endsWith("ed") && word.length > 3) {
    const stem = word.slice(0, -2);
    add(stem, "verb");                                  // walked -> walk
    // liked -> like  (but not "seed" -> "see")
    const baseWithE = stem + "e";
    if (!baseWithE.endsWith("ee") || baseWithE.length >= 4) {
      add(baseWithE, "verb");
    }
    // stopped -> stop (double consonant)
    const last = stem[stem.length - 1];
    if (stem.length > 2 && last === stem[stem.length - 2] && !VOWEL_LETTERS.includes(last)) {
      add(stem.slice(0, -1), "verb");
    }
  }

  // --- -ing ---
  if (word.endsWith("ing") && word.length > 4) {
    const stem = word.slice(0, -3);
    add(stem, "verb");                                  // walking -> walk
    add(stem + "e", "verb");                            // making -> make
    const last = stem[stem.length - 1];
    if (stem.length > 2 && last === stem[stem.length - 2] && !VOWEL_LETTERS.includes(last)) {
      add(stem.slice(0, -1), "verb");                   // running -> run
    }
    if (word.endsWith("ying")) {
      add(word.slice(0, -4) + "ie", "verb");            // lying -> lie
    }
  }

  // --- comparing adjectives: -er, -est ---
  const endings = ["er", "est"];
  for (const ending of endings) {
    if (word.endsWith(ending) && word.length > ending.length + 2) {
      const stem = word.slice(0, -ending.length);
      add(stem, "adjective");                           // taller -> tall
      add(stem + "e", "adjective");                     // nicer -> nice
      if (stem.endsWith("i")) {
        add(stem.slice(0, -1) + "y", "adjective");      // happier -> happy
      }
      const last = stem[stem.length - 1];
      if (stem.length > 2 && last === stem[stem.length - 2]) {
        add(stem.slice(0, -1), "adjective");            // bigger -> big
      }
    }
  }

  return candidates;
}

// Finds the base form of a word that is NOT in the dictionary.
// "isKnownWord" is a function that tells if a word is in the dictionary.
// Returns the base word, or "" if nothing was found.
function findBaseForm(word, isKnownWord) {
  // 1. Irregular forms first (went -> go).
  const irregular = IRREGULAR_FORMS[word];
  if (irregular && isKnownWord(irregular)) {
    return irregular;
  }

  // 2. Spelling rules (running -> run).
  const candidates = getBaseCandidates(word);
  for (const candidate of candidates) {
    if (isKnownWord(candidate.base)) {
      return candidate.base;
    }
  }

  return "";
}

// Make the functions available to the Node build script.
if (typeof module !== "undefined") {
  module.exports = { IRREGULAR_FORMS, getBaseCandidates, findBaseForm };
}
