# Python 3
import codecs

# Read the original JS file
with open("dnet-worm-old.js", "r", encoding="utf-8") as f:
    raw = f.read()

# Decode JSON-style escapes into real characters
# Use 'unicode_escape' but surrogates might appear if input is malformed
unescaped = codecs.decode(raw, "unicode_escape")

# Safely write to new file, handling surrogate pairs
with open("dnet-worm-unescaped.js", "w", encoding="utf-8", errors="surrogatepass") as f:
    f.write(unescaped)
