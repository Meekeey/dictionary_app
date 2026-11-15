// claude.js
// Talks to the Anthropic API (Claude) to get example sentences.
// Only used when an API key is saved in Settings.

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-5-5"; // a cheap, fast model

// Sends one question to Claude and returns the answer text.
async function askClaude(question) {
  const apiKey = getApiKey();
  if (apiKey === "") {
    throw new Error("No API key.");
  }

  const response = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Needed to call the API directly from a web page.
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      // Short, simple task: no extra thinking needed, so it answers faster.
      thinking: { type: "disabled" },
      system: "You help intermediate English learners. You write simple, clear, modern English. You reply with JSON only.",
      messages: [{ role: "user", content: question }]
    })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("The API key was not accepted.");
    }
    throw new Error("Claude error " + response.status);
  }

  const result = await response.json();
  if (result.stop_reason === "refusal") {
    throw new Error("Claude could not answer this.");
  }

  // The answer is a list of blocks. We join the text blocks.
  let text = "";
  for (const block of result.content) {
    if (block.type === "text") {
      text = text + block.text;
    }
  }
  return text;
}

// Finds the JSON inside an answer and reads it.
// "open" and "close" are "[" and "]" for a list, or "{" and "}" for an object.
function readJson(text, open, close) {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end === -1) {
    throw new Error("Claude did not send JSON.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

// Asks Claude for 4 example sentences for a dictionary word.
async function fetchExamples(entry) {
  let meaningList = "";
  for (const meaning of entry.meanings) {
    meaningList = meaningList + "- (" + meaning.part + ") " + meaning.text + "\n";
  }

  const question =
    'Write exactly 4 example sentences for the English word "' + entry.word + '".\n' +
    "Its meanings:\n" + meaningList +
    "Rules: each sentence is simple, natural and modern (daily life, work, study). " +
    "Each sentence is 8 to 16 words and uses the word or one of its forms. " +
    "Use the most common meanings.\n" +
    'Reply with only a JSON list of 4 strings, like ["...", "...", "...", "..."].';

  const answer = await askClaude(question);
  const sentences = readJson(answer, "[", "]");

  if (!Array.isArray(sentences) || sentences.length < 4) {
    throw new Error("Claude did not send 4 sentences.");
  }
  // Keep exactly 4, as text.
  const result = [];
  for (let i = 0; i < 4; i++) {
    result.push(String(sentences[i]));
  }
  return result;
}

// Asks Claude for a full entry, for a word that is not in the data file.
// Returns an entry, or null if Claude says it is not a real word.
async function fetchFullEntry(word) {
  const question =
    'Make a dictionary entry for the English word "' + word + '".\n' +
    "Reply with only a JSON object with these keys:\n" +
    '- "found": true if this is a real English word or common expression, false if not\n' +
    '- "word": the base form of the word\n' +
    '- "part": the part of speech (noun, verb, adjective, adverb, ...)\n' +
    '- "pronunciation": easy spelling, NOT IPA. Syllables are joined with "-". ' +
    "The stressed syllable is in CAPITALS. Examples: efficient = ih-FISH-uhnt, " +
    "resilient = rih-ZIL-yuhnt, negotiate = nuh-GOH-shee-ayt, thorough = THUR-oh, deadline = DED-lyn\n" +
    '- "meaning": one simple meaning, in easy words\n' +
    '- "similar": a list of 4 or 5 similar single words\n' +
    '- "examples": a list of exactly 4 simple, modern example sentences (8 to 16 words each)\n' +
    'If the word is not real, reply with {"found": false}.';

  const answer = await askClaude(question);
  const data = readJson(answer, "{", "}");

  if (data.found !== true) {
    return null;
  }
  if (!Array.isArray(data.similar) || !Array.isArray(data.examples) || data.examples.length < 4) {
    throw new Error("Claude sent an incomplete entry.");
  }

  const similar = [];
  for (const item of data.similar) {
    if (similar.length < 5) {
      similar.push(String(item).toLowerCase());
    }
  }
  const examples = [];
  for (let i = 0; i < 4; i++) {
    examples.push(String(data.examples[i]));
  }

  return {
    word: word,
    pronunciation: String(data.pronunciation),
    meanings: [{ part: String(data.part), text: String(data.meaning) }],
    similar: similar,
    examples: examples,
    fromClaude: true
  };
}
