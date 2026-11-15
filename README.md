# Wordsmith Dictionary

English Dictionary

<img width="1141" height="758" alt="image" src="https://github.com/user-attachments/assets/7a2a4d6f-98ee-4b40-90a7-5920389594e5" />

<img width="1095" height="815" alt="image" src="https://github.com/user-attachments/assets/eca955f2-6d45-4cdc-a0a6-ec7637e3c95d" />


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
