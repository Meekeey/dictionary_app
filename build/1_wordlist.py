# 1_wordlist.py
# Step 1 of the build: choose which words go into the dictionary.
# We keep only common words, using word frequency (wordfreq, zipf scale).
#
# Run:  python3 build/1_wordlist.py
# Output: build/wordlist.json   { "word": zipf_frequency, ... }

import json
import os
from wordfreq import zipf_frequency

MIN_ZIPF = 2.5  # 2.5 = about 3 times per 10 million words

HERE = os.path.dirname(os.path.abspath(__file__))
WORDNET_DIR = os.path.join(HERE, "..", "node_modules", "wordnet-db", "dict")
INDEX_FILES = ["index.noun", "index.verb", "index.adj", "index.adv"]

# Collect every single word that WordNet knows.
all_words = set()
for file_name in INDEX_FILES:
    path = os.path.join(WORDNET_DIR, file_name)
    with open(path, encoding="utf-8") as f:
        for line in f:
            # The license text at the top starts with two spaces.
            if line.startswith("  "):
                continue
            word = line.split(" ")[0]
            # Skip phrases (new_york), numbers and words with symbols.
            if not word.isalpha() or not word.isascii():
                continue
            if len(word) < 2 and word not in ("a", "i"):
                continue
            all_words.add(word)

# Keep only the common words.
kept = {}
for word in all_words:
    zipf = zipf_frequency(word, "en")
    if zipf >= MIN_ZIPF:
        kept[word] = round(zipf, 2)

out_path = os.path.join(HERE, "wordlist.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(kept, f)

print("WordNet single words:", len(all_words))
print("Kept (zipf >= " + str(MIN_ZIPF) + "):", len(kept))
