// test_pronounce.js
// Run:  node build/test_pronounce.js
// Shows the easy pronunciation of some test words.

const { arpabetToEasy } = require("./arpabet.js");

// Words to test. "expected" is filled in only where we know the answer.
const TESTS = [
  { word: "efficient", expected: "ih-FISH-uhnt" },
  { word: "resilient", expected: "rih-ZIL-yuhnt" },
  { word: "negotiate", expected: "nuh-GOH-shee-ayt" },
  { word: "thorough", expected: "THUR-oh" },
  { word: "deadline", expected: "DED-lyn" },
  { word: "happy", expected: "HAP-ee" },
  { word: "computer", expected: "" },
  { word: "measure", expected: "" },
  { word: "algorithm", expected: "" },
  { word: "university", expected: "" }
];

async function main() {
  // The CMU package is an ES module, so we load it with import().
  const cmu = await import("cmu-pronouncing-dictionary");

  for (const test of TESTS) {
    const arpabet = cmu.dictionary[test.word];
    const easy = arpabetToEasy(arpabet);

    let status = "";
    if (test.expected !== "") {
      if (easy === test.expected) {
        status = "PASS";
      } else {
        status = "FAIL (expected " + test.expected + ")";
      }
    }
    console.log(test.word.padEnd(12) + easy.padEnd(22) + arpabet.padEnd(30) + status);
  }
}

main();
