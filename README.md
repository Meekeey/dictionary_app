# Wordsmith Dictionary

English Dictionary

## Run it

```bash
npm start
```

Then open http://localhost:8080

## Rebuild the data file

You only need this if you change the build scripts.

```bash
npm install
```

```bash
pip install wordfreq
```

```bash
npm run build
```

- `build/1_wordlist.py` keeps the common WordNet words (zipf >= 2.5).
- `build/2_build_data.js` makes `app/data/dictionary.json.gz`.
- `npm run test:pronounce` tests the pronunciation converter.

After a change to the app or the data, change `CACHE_NAME` in `app/sw.js`
(v1 -> v2) so phones download the new files.

## Data

- Meanings, similar words, built-in examples: WordNet 3.1 (Princeton University)
- Pronunciation: CMU Pronouncing Dictionary
- Word frequency: wordfreq
