// arpabet.js
// Converts CMU ARPAbet ("IH0 F IH1 SH AH0 N T") into an easy spelling
// ("ih-FISH-uhnt"). The stressed syllable is written in CAPS.

// The vowel sounds of ARPAbet (without the stress number).
const VOWELS = ["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"];

// Short vowels. When stressed, they pull one consonant into their syllable.
const SHORT_VOWELS = ["AE", "EH", "IH", "AH", "UH"];

// How each consonant sound is written.
const CONSONANT_SPELLING = {
  B: "b", CH: "ch", D: "d", DH: "th", F: "f", G: "g", HH: "h", JH: "j",
  K: "k", L: "l", M: "m", N: "n", NG: "ng", P: "p", R: "r", S: "s",
  SH: "sh", T: "t", TH: "th", V: "v", W: "w", Y: "y", Z: "z", ZH: "zh"
};

// Consonant groups that can really start an English syllable.
// (Single consonants are checked separately.)
const VALID_ONSETS = [
  "P L", "P R", "P Y", "B L", "B R", "B Y", "T R", "T W", "D R", "D W",
  "K L", "K R", "K W", "K Y", "G L", "G R", "G W", "G Y",
  "F L", "F R", "F Y", "V Y", "TH R", "SH R", "HH Y", "M Y",
  "S L", "S W", "S P", "S T", "S K", "S M", "S N", "S F",
  "S P L", "S P R", "S P Y", "S T R", "S K R", "S K W", "S K Y"
];

// Is this list of consonants allowed at the start of a syllable?
function isValidOnset(consonants) {
  if (consonants.length === 0) {
    return true;
  }
  if (consonants.length === 1) {
    // "NG" never starts a syllable in English.
    return consonants[0] !== "NG";
  }
  return VALID_ONSETS.includes(consonants.join(" "));
}

// Step 1: turn "IH1" into { sound: "IH", stress: 1, isVowel: true }.
function parsePhones(arpabet) {
  const phones = [];
  const parts = arpabet.trim().split(/\s+/);
  for (const part of parts) {
    const lastChar = part[part.length - 1];
    let sound = part;
    let stress = -1;
    if (lastChar >= "0" && lastChar <= "9") {
      sound = part.slice(0, -1);
      stress = Number(lastChar);
    }
    phones.push({ sound: sound, stress: stress, isVowel: VOWELS.includes(sound) });
  }
  return phones;
}

// Step 2: split the phones into syllables.
// Each syllable is { onset: [...], vowel: "IH", stress: 1, coda: [...] }.
function splitSyllables(phones) {
  const syllables = [];
  let waiting = []; // consonants seen since the last vowel

  for (const phone of phones) {
    if (!phone.isVowel) {
      waiting.push(phone.sound);
      continue;
    }

    let onset = waiting;
    if (syllables.length > 0) {
      // Maximal onset rule: give this vowel the longest valid onset.
      // The consonants that do not fit stay with the previous syllable.
      let start = 0;
      while (!isValidOnset(waiting.slice(start))) {
        start = start + 1;
      }
      const previous = syllables[syllables.length - 1];
      previous.coda = waiting.slice(0, start);
      onset = waiting.slice(start);
    }

    syllables.push({ onset: onset, vowel: phone.sound, stress: phone.stress, coda: [] });
    waiting = [];
  }

  // Consonants left at the end of the word close the last syllable.
  if (syllables.length > 0) {
    syllables[syllables.length - 1].coda = waiting;
  }

  // A stressed short vowel takes one following consonant ("happy" = HAP-ee).
  for (let i = 0; i < syllables.length - 1; i++) {
    const current = syllables[i];
    const next = syllables[i + 1];
    const isStressed = current.stress === 1 || current.stress === 2;
    const isShort = SHORT_VOWELS.includes(current.vowel);
    if (isStressed && isShort && current.coda.length === 0 && next.onset.length > 0) {
      current.coda.push(next.onset.shift());
    }
  }

  return syllables;
}

// Step 3: choose the spelling of one vowel.
function spellVowel(syllable) {
  const vowel = syllable.vowel;
  const isClosed = syllable.coda.length > 0;         // ends with a consonant
  const isStressed = syllable.stress === 1 || syllable.stress === 2;
  const startsWithConsonant = syllable.onset.length > 0;
  const beforeR = syllable.coda[0] === "R";

  if (vowel === "AE") { return "a"; }
  if (vowel === "EH") {
    if (beforeR) { return "ai"; }                    // "care" = KAIR
    if (isClosed) { return "e"; }
    return "eh";
  }
  if (vowel === "IH") {
    if (beforeR) { return "ee"; }                    // "here" = HEER
    if (isClosed) { return "i"; }
    return "ih";
  }
  if (vowel === "AH") {
    if (isStressed && isClosed) { return "u"; }      // "cup" = KUP
    return "uh";
  }
  if (vowel === "AA") { return "ah"; }
  if (vowel === "AO") {
    if (beforeR) { return "o"; }                     // "more" = MOR
    return "aw";
  }
  if (vowel === "AW") { return "ow"; }
  if (vowel === "AY") {
    if (startsWithConsonant) { return "y"; }
    return "eye";
  }
  if (vowel === "ER") { return "ur"; }
  if (vowel === "EY") { return "ay"; }
  if (vowel === "IY") { return "ee"; }
  if (vowel === "OW") { return "oh"; }
  if (vowel === "OY") { return "oy"; }
  if (vowel === "UH" || vowel === "UW") { return "oo"; }
  return vowel.toLowerCase();
}

// Step 4: write one syllable as text.
function spellSyllable(syllable) {
  let text = "";
  for (const consonant of syllable.onset) {
    text = text + CONSONANT_SPELLING[consonant];
  }
  text = text + spellVowel(syllable);
  for (const consonant of syllable.coda) {
    text = text + CONSONANT_SPELLING[consonant];
  }
  if (syllable.stress === 1) {
    text = text.toUpperCase();
  }
  return text;
}

// Main function: "HH AE1 P IY0" -> "HAP-ee"
function arpabetToEasy(arpabet) {
  const phones = parsePhones(arpabet);
  const syllables = splitSyllables(phones);
  const parts = [];
  for (const syllable of syllables) {
    parts.push(spellSyllable(syllable));
  }
  return parts.join("-");
}

module.exports = { arpabetToEasy, splitSyllables, parsePhones };
